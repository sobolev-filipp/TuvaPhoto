import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** Данные «О фотографе» с бэкенда — их вводит владелец. */
export interface AboutData {
  fio: string
  role: string
  desc: string
  email: string
  address: string
  /** Телефон в красивом виде: +7 (923) 388-27-07. Пустая строка, если не задан. */
  phone: string
  /** Готовая ссылка tel: или null, если телефон не задан. */
  phoneHref: string | null
  tg: string
  vk: string
  max: string
  photoUrl: string | null
}

/**
 * Единый источник контактов владельца для футера, контактов и кнопок звонка.
 * Данные редко меняются — держим их в кэше подольше.
 */
export function useAbout() {
  return useQuery({
    queryKey: ['about'],
    queryFn: () => api<AboutData>('/about', { skipRefresh: true }),
    staleTime: 5 * 60 * 1000,
  })
}
