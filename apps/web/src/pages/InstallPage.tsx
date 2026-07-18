import { Link } from 'react-router-dom'
import { useInstall } from '@/pwa/useInstall'

const steps = [
  {
    platform: 'Android · Chrome',
    items: [
      'Откройте сайт в Chrome.',
      'Нажмите «Установить» на плашке или ⋮ → «Установить приложение».',
      'Подтвердите — иконка появится на рабочем столе.',
    ],
  },
  {
    platform: 'iPhone · Safari',
    items: [
      'Откройте сайт в Safari (в других браузерах установка недоступна).',
      'Нажмите кнопку «Поделиться» внизу экрана.',
      'Выберите «На экран „Домой“» и подтвердите.',
    ],
  },
  {
    platform: 'Компьютер · Chrome, Edge',
    items: [
      'Откройте сайт в браузере.',
      'Нажмите значок установки в адресной строке справа.',
      'Приложение откроется отдельным окном без вкладок.',
    ],
  },
]

const perks = [
  { title: 'Открывается в один тап', desc: 'Иконка на экране — не нужно искать вкладку или ссылку.' },
  { title: 'Работает без интернета', desc: 'Просмотренные альбомы и каталог остаются доступны офлайн.' },
  { title: 'Всегда свежая версия', desc: 'Когда выходит обновление, приложение само предложит его установить.' },
]

export function InstallPage() {
  const { installed, canPrompt, promptInstall } = useInstall()

  return (
    <div className="animate-fade-up mx-auto max-w-[1240px] px-4 pt-[70px] pb-[100px] md:px-10">
      <div className="mb-3.5 font-mono text-[13px] font-bold tracking-[.14em] text-gold uppercase">
        Приложение
      </div>
      <h1 className="font-display m-0 mb-2.5 text-[32px] leading-[1.03] font-extrabold md:text-[48px]">
        ТуваФото под рукой
      </h1>

      {installed ? (
        <div className="mt-8 flex max-w-[560px] items-center gap-3 rounded-2xl border border-gold/30 bg-gold/[.08] p-6">
          <span className="text-2xl text-gold">✓</span>
          <div>
            <div className="font-display text-[15px] font-bold">Приложение уже установлено</div>
            <p className="mt-1 mb-0 text-sm text-white/60">
              Вы открыли ТуваФото как приложение — устанавливать ничего не нужно.
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="m-0 mb-9 max-w-[560px] text-base text-white/60">
            Сайт можно установить как приложение — он займёт меньше места, чем одна фотография из
            альбома, и будет работать даже там, где связь пропадает.
          </p>

          {canPrompt && (
            <button
              type="button"
              onClick={() => void promptInstall()}
              className="mb-12 rounded-full bg-gold px-[30px] py-4 text-[15px] font-bold text-on-gold transition-colors hover:bg-gold-hover"
            >
              Установить приложение
            </button>
          )}

          <div className="mb-14 grid gap-5 md:grid-cols-3">
            {perks.map((p) => (
              <div key={p.title} className="rounded-2xl border border-white/[.07] bg-surface-2 p-6">
                <div className="font-display mb-2 text-[15px] font-bold">{p.title}</div>
                <p className="m-0 text-sm leading-relaxed text-white/55">{p.desc}</p>
              </div>
            ))}
          </div>

          <h2 className="font-display m-0 mb-7 text-[26px] leading-[1.05] font-bold md:text-[32px]">
            Как установить
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.platform} className="rounded-2xl border border-white/[.07] bg-surface-2 p-6">
                <div className="mb-4 font-mono text-[11px] tracking-[.12em] text-gold uppercase">
                  {s.platform}
                </div>
                <ol className="m-0 flex list-none flex-col gap-3 p-0">
                  {s.items.map((item, i) => (
                    <li key={item} className="flex gap-3 text-sm leading-relaxed text-white/70">
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white/[.06] text-xs font-bold text-gold">
                        {i + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-14">
        <Link to="/catalog" className="text-sm font-semibold">
          ← Смотреть каталог альбомов
        </Link>
      </div>
    </div>
  )
}
