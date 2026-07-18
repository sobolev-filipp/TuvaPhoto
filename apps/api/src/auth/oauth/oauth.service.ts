import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { VkProvider, YandexProvider, type OAuthProfile, type OAuthProvider } from './providers'

@Injectable()
export class OAuthService {
  private readonly providers: OAuthProvider[]

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.providers = [
      new YandexProvider({
        clientId: config.get('YANDEX_CLIENT_ID'),
        clientSecret: config.get('YANDEX_CLIENT_SECRET'),
      }),
      new VkProvider({
        clientId: config.get('VK_CLIENT_ID'),
        clientSecret: config.get('VK_CLIENT_SECRET'),
      }),
    ]
  }

  /** Только настроенные провайдеры — фронт покажет ровно их. */
  listEnabled() {
    return this.providers
      .filter((p) => p.isConfigured())
      .map((p) => ({ key: p.key, name: p.displayName }))
  }

  private get(key: string): OAuthProvider {
    const provider = this.providers.find((p) => p.key === key)
    if (!provider || !provider.isConfigured()) {
      throw new NotFoundException('Провайдер недоступен')
    }
    return provider
  }

  /** URL коллбэка, который должен совпадать с зарегистрированным у провайдера. */
  redirectUri(key: string): string {
    const base = this.config.get<string>('OAUTH_REDIRECT_BASE') ?? 'http://localhost:3000/api'
    return `${base}/auth/oauth/${key}/callback`
  }

  authorizeUrl(key: string, state: string): string {
    const provider = this.get(key)
    return provider.authorizeUrl(state, this.redirectUri(key))
  }

  /**
   * Обмен кода на сессию пользователя. Логика связывания:
   *  1) аккаунт провайдера уже привязан — это тот же пользователь;
   *  2) есть пользователь с тем же email — привязываем соцвход к нему;
   *  3) иначе — создаём нового (без пароля и телефона, почта уже подтверждена).
   */
  async resolveUser(key: string, code: string) {
    const provider = this.get(key)

    let profile: OAuthProfile
    try {
      profile = await provider.exchange(code, this.redirectUri(key))
    } catch {
      // Наружу не выносим детали обмена — только факт неудачи.
      throw new BadRequestException('Не удалось войти через провайдера')
    }

    const existing = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: { provider: key, providerAccountId: profile.providerAccountId },
      },
      include: { user: true },
    })
    if (existing) return existing.user

    if (profile.email) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: profile.email } })
      if (byEmail) {
        await this.prisma.oAuthAccount.create({
          data: { provider: key, providerAccountId: profile.providerAccountId, userId: byEmail.id },
        })
        return byEmail
      }
    }

    // Провайдер мог не отдать email (в VK его надо явно разрешать) — тогда
    // ставим синтетический, чтобы не нарушить уникальность и не спутать с чужим.
    const email = profile.email ?? `${key}_${profile.providerAccountId}@oauth.local`

    return this.prisma.user.create({
      data: {
        email,
        name: profile.name,
        role: 'CLIENT',
        emailVerifiedAt: profile.email ? new Date() : null,
        oauthAccounts: {
          create: { provider: key, providerAccountId: profile.providerAccountId },
        },
      },
    })
  }

  /**
   * Привязка соцаккаунта к УЖЕ вошедшему пользователю (из профиля).
   * В отличие от resolveUser не создаёт нового пользователя и не логинит по
   * email: только цепляет аккаунт провайдера к конкретному userId.
   */
  async linkToUser(key: string, code: string, userId: string) {
    const provider = this.get(key)

    let profile: OAuthProfile
    try {
      profile = await provider.exchange(code, this.redirectUri(key))
    } catch {
      throw new BadRequestException('Не удалось получить данные провайдера')
    }

    const existing = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: { provider: key, providerAccountId: profile.providerAccountId },
      },
    })

    if (existing) {
      // Уже привязан к этому же пользователю — считаем успехом (идемпотентно).
      if (existing.userId === userId) return
      // К другому — красть чужую привязку нельзя.
      throw new ConflictException('Этот аккаунт уже привязан к другому профилю')
    }

    await this.prisma.oAuthAccount.create({
      data: { provider: key, providerAccountId: profile.providerAccountId, userId },
    })
  }

  /** Что подключено и что вообще доступно — для раздела в профиле. */
  async connections(userId: string) {
    const linked = await this.prisma.oAuthAccount.findMany({
      where: { userId },
      select: { provider: true, createdAt: true },
    })
    const linkedSet = new Set(linked.map((l) => l.provider))

    return this.providers
      .filter((p) => p.isConfigured())
      .map((p) => ({
        key: p.key,
        name: p.displayName,
        linked: linkedSet.has(p.key),
        linkedAt: linked.find((l) => l.provider === p.key)?.createdAt ?? null,
      }))
  }

  /**
   * Отвязка. Не даём отвязать последний способ входа: у пользователя без
   * пароля соцаккаунт — единственный вход, снять его = потерять доступ.
   */
  async unlink(userId: string, key: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { oauthAccounts: true },
    })
    if (!user) throw new NotFoundException()

    const hasThis = user.oauthAccounts.some((a) => a.provider === key)
    if (!hasThis) return

    const hasPassword = Boolean(user.passwordHash)
    const otherOauth = user.oauthAccounts.filter((a) => a.provider !== key).length > 0
    if (!hasPassword && !otherOauth) {
      throw new ConflictException(
        'Нельзя отвязать единственный способ входа. Сначала задайте пароль.',
      )
    }

    await this.prisma.oAuthAccount.deleteMany({ where: { userId, provider: key } })
  }
}
