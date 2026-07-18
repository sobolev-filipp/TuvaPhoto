import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import * as argon2 from 'argon2'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import type { LoginDto, RegisterDto } from './dto/auth.dto'

/** Сколько живёт код 2FA. */
const CODE_TTL_MS = 10 * 60 * 1000
/** Больше попыток — код сгорает: 4 цифры это всего 10 000 вариантов. */
const MAX_CODE_ATTEMPTS = 5
/** Сколько живёт сессия (refresh-токен). */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
/** Время жизни access-токена. */
const ACCESS_TTL = '15m'
/** Сколько живёт ссылка сброса пароля. */
const RESET_TTL_MS = 60 * 60 * 1000

export interface RequestMeta {
  ip?: string
  userAgent?: string
}

export interface AccessPayload {
  sub: string
  role: string
  sid: string
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  /* ------------------------------------------------------------ хэши */

  /**
   * Refresh-токен и код 2FA хэшируем sha256, а не argon2. Argon2 намеренно
   * медленный — это нужно паролям, у которых мало энтропии. Здесь значения
   * либо криптослучайные (токен), либо живут 10 минут с лимитом попыток (код),
   * поэтому подбор по хэшу не грозит, а refresh дёргается на каждом запросе.
   */
  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }

  private safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a)
    const bb = Buffer.from(b)
    // timingSafeEqual падает на разной длине — сравниваем длину отдельно.
    return ba.length === bb.length && timingSafeEqual(ba, bb)
  }

  /* ------------------------------------------------- регистрация и вход */

  async register(dto: RegisterDto, meta: RequestMeta) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) {
      throw new ConflictException('Пользователь с таким email уже зарегистрирован')
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id })

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        phone: dto.phone,
        passwordHash,
        role: 'CLIENT',
      },
    })

    await this.recordConsent(user.id, 'PERSONAL_DATA', meta)

    // Регистрация не логинит сразу: тем же кодом подтверждаем, что почта
    // действительно принадлежит человеку.
    return this.startTwoFactor(user.id, user.email, user.name)
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })

    // Пароля нет у тех, кто заходил через Яндекс/VK — им сюда нельзя.
    if (!user?.passwordHash) {
      // Тратим время как на реальной проверке, чтобы по скорости ответа нельзя
      // было отличить «нет такого пользователя» от «неверный пароль».
      await argon2.hash(dto.password, { type: argon2.argon2id })
      throw new UnauthorizedException('Неверный email или пароль')
    }

    const ok = await argon2.verify(user.passwordHash, dto.password)
    if (!ok) throw new UnauthorizedException('Неверный email или пароль')

    await this.recordConsent(user.id, 'PERSONAL_DATA', meta)

    return this.startTwoFactor(user.id, user.email, user.name)
  }

  /* ---------------------------------------------------------------- 2FA */

  private async startTwoFactor(userId: string, email: string, name: string) {
    // Старые неиспользованные коды гасим: иначе у пользователя одновременно
    // живёт несколько валидных кодов.
    await this.prisma.twoFactorCode.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    })

    // randomInt, а не Math.random: код — секрет.
    const code = String(randomBytes(4).readUInt32BE(0) % 10000).padStart(4, '0')

    const challenge = await this.prisma.twoFactorCode.create({
      data: {
        userId,
        codeHash: this.hash(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    })

    await this.mail.sendTwoFactorCode(email, name, code)

    return { challengeId: challenge.id, email }
  }

  async verify(challengeId: string, code: string, meta: RequestMeta) {
    const challenge = await this.prisma.twoFactorCode.findUnique({
      where: { id: challengeId },
      include: { user: true },
    })

    const invalid = new UnauthorizedException('Неверный или истёкший код')

    if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) throw invalid

    if (challenge.attempts >= MAX_CODE_ATTEMPTS) {
      await this.prisma.twoFactorCode.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      })
      throw new UnauthorizedException('Слишком много попыток, запросите новый код')
    }

    if (!this.safeEqual(challenge.codeHash, this.hash(code))) {
      await this.prisma.twoFactorCode.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      })
      throw invalid
    }

    await this.prisma.twoFactorCode.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    })

    // Успешный ввод кода подтверждает и владение почтой.
    if (!challenge.user.emailVerifiedAt) {
      await this.prisma.user.update({
        where: { id: challenge.user.id },
        data: { emailVerifiedAt: new Date() },
      })
    }

    const session = await this.issueSession(challenge.user.id, challenge.user.role, meta)
    return { ...session, user: this.toPublicUser(challenge.user) }
  }

  /* --------------------------------------------- профиль фотографа */

  /**
   * Заполнение данных о фотографе при первом входе владельца. Пишет ФИО, адрес
   * и телефон в синглтон About (блок «О фотографе» на сайте) и снимает флаг
   * mustCompleteProfile. Остальные поля About (роль, описание, соцсети) владелец
   * заполнит позже в админке.
   */
  async completeProfile(userId: string, data: { fio: string; address: string; phone: string }) {
    await this.prisma.about.upsert({
      where: { id: 'about' },
      create: {
        id: 'about',
        fio: data.fio,
        role: 'Фотограф',
        desc: '',
        phone: data.phone,
        email: '',
        address: data.address,
      },
      update: { fio: data.fio, address: data.address, phone: data.phone },
    })

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { mustCompleteProfile: false },
    })

    return this.toPublicUser(user)
  }

  /* ------------------------------------------------------------ сессии */

  /** Выдать сессию напрямую (для соцвхода: второй фактор не нужен, личность
      уже подтвердил провайдер). */
  async issueSessionForUser(userId: string, role: string, meta: RequestMeta) {
    return this.issueSession(userId, role, meta)
  }

  private async issueSession(userId: string, role: string, meta: RequestMeta) {
    const refreshToken = randomBytes(48).toString('base64url')

    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.hash(refreshToken),
        ip: meta.ip,
        userAgent: meta.userAgent,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })

    const accessToken = await this.signAccess({ sub: userId, role, sid: session.id })

    return { accessToken, refreshToken, sessionId: session.id }
  }

  private signAccess(payload: AccessPayload) {
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TTL,
    })
  }

  /**
   * Обновление пары токенов с ротацией: старый refresh перестаёт действовать
   * сразу. Если им попробуют воспользоваться повторно (значит, он утёк) —
   * запрос не пройдёт.
   */
  async refresh(refreshToken: string, meta: RequestMeta) {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Сессия недействительна')
    }

    const next = randomBytes(48).toString('base64url')

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        tokenHash: this.hash(next),
        lastSeenAt: new Date(),
        ip: meta.ip ?? session.ip,
        userAgent: meta.userAgent ?? session.userAgent,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })

    const accessToken = await this.signAccess({
      sub: session.userId,
      role: session.user.role,
      sid: session.id,
    })

    return { accessToken, refreshToken: next, user: this.toPublicUser(session.user) }
  }

  /* ------------------------------------------------- сброс пароля */

  /**
   * Запрос сброса. Ответ всегда одинаковый (см. контроллер), поэтому здесь
   * молча выходим, если пользователя нет или у него нет пароля (соцвход).
   */
  async requestPasswordReset(email: string, webOrigin: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user?.passwordHash) return

    // Старые неиспользованные ссылки гасим — валидной должна быть одна.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    })

    const token = randomBytes(32).toString('base64url')
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    })

    const url = `${webOrigin}/reset-password?token=${token}`
    await this.mail.sendPasswordReset(user.email, url)
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hash(token) },
    })

    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Ссылка недействительна или истекла')
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id })

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, mustChangeCredentials: false },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      // Сброс пароля закрывает все сессии: если аккаунт увели, злоумышленника
      // выкинет вместе со сменой пароля.
      this.prisma.session.deleteMany({ where: { userId: record.userId } }),
    ])
  }

  /* ------------------------------------------------- смена пароля */

  /** Смена пароля из раздела «Безопасность»: текущий пароль обязателен. */
  async changePassword(userId: string, currentSessionId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user?.passwordHash) {
      throw new UnauthorizedException('У этого аккаунта нет пароля')
    }

    const ok = await argon2.verify(user.passwordHash, currentPassword)
    if (!ok) throw new UnauthorizedException('Текущий пароль неверный')

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id })
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } })

    // Остальные сессии закрываем: сменил пароль — разлогинить старые устройства.
    await this.prisma.session.deleteMany({ where: { userId, NOT: { id: currentSessionId } } })
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return
    await this.prisma.session
      .delete({ where: { tokenHash: this.hash(refreshToken) } })
      .catch(() => {
        // Сессии уже нет — для клиента это всё равно успешный выход.
      })
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true },
    })

    return sessions.map((s) => ({ ...s, current: s.id === currentSessionId }))
  }

  async revokeSession(userId: string, sessionId: string) {
    // Условие по userId обязательно: без него любой авторизованный пользователь
    // мог бы закрыть чужую сессию, зная её id.
    const { count } = await this.prisma.session.deleteMany({ where: { id: sessionId, userId } })
    if (count === 0) throw new UnauthorizedException('Сессия не найдена')
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    const { count } = await this.prisma.session.deleteMany({
      where: { userId, NOT: { id: currentSessionId } },
    })
    return { revoked: count }
  }

  /* ------------------------------------------------------------ прочее */

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new UnauthorizedException()
    return this.toPublicUser(user)
  }

  /**
   * Смена логина и пароля. Используется для обязательной замены заводских
   * доступов владельца при первом входе, но подходит любому пользователю.
   *
   * Защита: требуем текущий пароль (перехваченной сессии мало), проверяем
   * занятость нового email, после смены завершаем все прочие сессии — если
   * кто-то параллельно сидел под старым паролем, его выкинет.
   */
  async changeCredentials(
    userId: string,
    currentSessionId: string,
    dto: { currentPassword: string; newEmail: string; newPassword: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user?.passwordHash) {
      // У соцвхода пароля нет — им эта операция недоступна.
      throw new UnauthorizedException('Смена пароля недоступна для этого аккаунта')
    }

    const ok = await argon2.verify(user.passwordHash, dto.currentPassword)
    if (!ok) throw new UnauthorizedException('Текущий пароль неверный')

    if (dto.newEmail !== user.email) {
      const taken = await this.prisma.user.findUnique({ where: { email: dto.newEmail } })
      if (taken) throw new ConflictException('Этот email уже занят')
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id })

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.newEmail,
        passwordHash,
        emailVerifiedAt: new Date(),
        mustChangeCredentials: false,
      },
    })

    await this.prisma.session.deleteMany({ where: { userId, NOT: { id: currentSessionId } } })

    return this.toPublicUser(updated)
  }

  toPublicUser(user: {
    id: string
    email: string
    name: string
    role: string
    phone?: string | null
    mustChangeCredentials?: boolean
    mustCompleteProfile?: boolean
  }) {
    // Наружу — только безопасные поля: passwordHash не должен покидать сервис
    // даже случайно.
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone ?? null,
      mustChangeCredentials: user.mustChangeCredentials ?? false,
      mustCompleteProfile: user.mustCompleteProfile ?? false,
    }
  }

  private async recordConsent(
    userId: string,
    kind: 'PERSONAL_DATA' | 'REVIEW_PUBLISH',
    meta: RequestMeta,
  ) {
    await this.prisma.consent.create({
      data: {
        userId,
        kind,
        policyVersion: this.config.get<string>('POLICY_VERSION') ?? 'unknown',
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    })
  }

  sessionTtlMs() {
    return SESSION_TTL_MS
  }
}
