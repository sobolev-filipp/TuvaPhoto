/**
 * Провайдеры соцвхода. Каждый умеет построить URL авторизации и обменять
 * код на профиль. Провайдер «включён» только если заданы его ключи в env —
 * так ненастроенный VK просто не появляется в списке, а не отдаёт ошибку.
 */

export interface OAuthProfile {
  /** Идентификатор аккаунта у провайдера — стабильный ключ связи. */
  providerAccountId: string
  email: string | null
  name: string
}

export interface OAuthProvider {
  readonly key: 'yandex' | 'vk'
  readonly displayName: string
  isConfigured(): boolean
  authorizeUrl(state: string, redirectUri: string): string
  exchange(code: string, redirectUri: string): Promise<OAuthProfile>
}

interface Creds {
  clientId?: string
  clientSecret?: string
}

/** Яндекс ID. Документация: https://yandex.ru/dev/id/doc/ */
export class YandexProvider implements OAuthProvider {
  readonly key = 'yandex' as const
  readonly displayName = 'Яндекс'

  constructor(private readonly creds: Creds) {}

  isConfigured() {
    return Boolean(this.creds.clientId && this.creds.clientSecret)
  }

  authorizeUrl(state: string, redirectUri: string) {
    const p = new URLSearchParams({
      response_type: 'code',
      client_id: this.creds.clientId!,
      redirect_uri: redirectUri,
      state,
    })
    return `https://oauth.yandex.ru/authorize?${p}`
  }

  async exchange(code: string, redirectUri: string): Promise<OAuthProfile> {
    const tokenRes = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.creds.clientId!,
        client_secret: this.creds.clientSecret!,
        redirect_uri: redirectUri,
      }),
    })
    if (!tokenRes.ok) throw new Error(`Яндекс: обмен кода не удался (${tokenRes.status})`)
    const token = (await tokenRes.json()) as { access_token?: string }
    if (!token.access_token) throw new Error('Яндекс: не выдал токен')

    const infoRes = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { authorization: `OAuth ${token.access_token}` },
    })
    if (!infoRes.ok) throw new Error(`Яндекс: профиль недоступен (${infoRes.status})`)
    const info = (await infoRes.json()) as {
      id: string
      default_email?: string
      real_name?: string
      display_name?: string
      login?: string
    }

    return {
      providerAccountId: String(info.id),
      email: info.default_email ?? null,
      name: info.real_name || info.display_name || info.login || 'Пользователь Яндекс',
    }
  }
}

/** VK (классический OAuth oauth.vk.com). */
export class VkProvider implements OAuthProvider {
  readonly key = 'vk' as const
  readonly displayName = 'VK'

  constructor(private readonly creds: Creds) {}

  isConfigured() {
    return Boolean(this.creds.clientId && this.creds.clientSecret)
  }

  authorizeUrl(state: string, redirectUri: string) {
    const p = new URLSearchParams({
      client_id: this.creds.clientId!,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'email',
      state,
      v: '5.131',
    })
    return `https://oauth.vk.com/authorize?${p}`
  }

  async exchange(code: string, redirectUri: string): Promise<OAuthProfile> {
    const tokenUrl = new URL('https://oauth.vk.com/access_token')
    tokenUrl.search = new URLSearchParams({
      client_id: this.creds.clientId!,
      client_secret: this.creds.clientSecret!,
      redirect_uri: redirectUri,
      code,
    }).toString()

    const tokenRes = await fetch(tokenUrl)
    if (!tokenRes.ok) throw new Error(`VK: обмен кода не удался (${tokenRes.status})`)
    const token = (await tokenRes.json()) as {
      access_token?: string
      user_id?: number
      email?: string
    }
    if (!token.access_token || !token.user_id) throw new Error('VK: не выдал токен')

    // Имя VK в токене не отдаёт — берём отдельным запросом.
    let name = 'Пользователь VK'
    const infoUrl = new URL('https://api.vk.com/method/users.get')
    infoUrl.search = new URLSearchParams({
      user_ids: String(token.user_id),
      access_token: token.access_token,
      v: '5.131',
    }).toString()
    const infoRes = await fetch(infoUrl)
    if (infoRes.ok) {
      const info = (await infoRes.json()) as {
        response?: { first_name?: string; last_name?: string }[]
      }
      const u = info.response?.[0]
      if (u) name = [u.first_name, u.last_name].filter(Boolean).join(' ') || name
    }

    return {
      providerAccountId: String(token.user_id),
      email: token.email ?? null,
      name,
    }
  }
}
