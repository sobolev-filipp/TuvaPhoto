import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Book } from '@/components/Book'
import { shareApi } from '@/lib/api'

/** Размеры страницы книги под ориентацию. */
const bookSize = (orientation: 'LANDSCAPE' | 'PORTRAIT') =>
  orientation === 'PORTRAIT' ? { pw: 210, ph: 290 } : { pw: 320, ph: 224 }

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })

/** Публичный просмотр демо-альбома по секретной ссылке /share/:token. */
export function SharePage() {
  const { token } = useParams<{ token: string }>()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['share', token],
    queryFn: () => shareApi.get(token as string),
    enabled: !!token,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-[100px] text-white/50 md:px-10">
        Загружаем альбом…
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-[100px] text-center md:px-10">
        <h1 className="font-display m-0 mb-4 text-[32px] font-extrabold">Ссылка недоступна</h1>
        <p className="text-white/55">Возможно, срок действия ссылки истёк или она неверна.</p>
      </div>
    )
  }

  if (data.expired) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-[100px] text-center md:px-10">
        <h1 className="font-display m-0 mb-4 text-[32px] font-extrabold">Срок просмотра истёк</h1>
        <p className="text-white/55">
          Демо-альбом «{data.title}» больше недоступен для просмотра. Если нужна ссылка снова —
          свяжитесь с фотографом.
        </p>
      </div>
    )
  }

  const { pw, ph } = bookSize(data.orientation)
  const pages = data.spreads.map((s, i) => ({
    id: `${token}-${i}`,
    label: s.label,
    imageUrl: s.imageUrl,
    layout: s.layout,
    rightImageUrl: s.rightImageUrl,
  }))

  return (
    <div className="animate-fade-up mx-auto max-w-[1240px] px-4 pt-10 pb-[100px] md:px-10">
      <div className="mb-8 text-center">
        <div className="mb-2 font-mono text-[12px] font-bold tracking-[.14em] text-gold uppercase">
          Ваш готовый альбом
        </div>
        <h1 className="font-display m-0 text-[28px] leading-[1.05] font-extrabold md:text-[40px]">
          {data.title}
        </h1>
        {data.subtitle && <p className="mt-2 text-[15px] text-white/60">{data.subtitle}</p>}
      </div>

      <div className="flex justify-center">
        <Book
          title={data.title}
          subtitle={data.subtitle}
          pw={pw}
          ph={ph}
          pages={pages}
          coverUrl={data.coverUrl}
          backCoverUrl={data.backCoverUrl}
        />
      </div>

      <p className="mt-8 text-center text-[13px] text-white/40">
        Ссылка действует до {dateFmt.format(new Date(data.expiresAt))}. Нажмите «Во весь экран» под
        книгой для крупного просмотра.
      </p>
    </div>
  )
}
