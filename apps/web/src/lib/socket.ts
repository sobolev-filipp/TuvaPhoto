import { io, type Socket } from 'socket.io-client'
import { getAccessToken } from './api'

/**
 * Сокет админки. Токен передаём в рукопожатии функцией, а не значением: при
 * авто-переподключении socket.io заберёт уже свежий токен (он мог обновиться).
 * Подключаемся к тому же origin — vite/прокси прод-сервера ведёт /socket.io на API.
 */
export function connectAdminSocket(): Socket {
  return io({
    auth: (cb: (data: { token: string | null }) => void) => cb({ token: getAccessToken() }),
    // Без autoConnect по умолчанию сокет соединяется сразу — нам это и нужно.
    reconnection: true,
  })
}
