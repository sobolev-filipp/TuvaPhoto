import { Photo } from '@/components/Photo'
import { useAbout } from '@/domain/useAbout'

export function ContactsPage() {
  const { data: about, isLoading } = useAbout()

  const socials = [
    { key: 'tg', href: about?.tg, label: 'Telegram' },
    { key: 'vk', href: about?.vk, label: 'ВКонтакте' },
  ].filter((s) => s.href && s.href.trim().length > 0)

  return (
    <div className="animate-fade-up mx-auto max-w-[1240px] px-4 pt-[70px] pb-[100px] sm:px-6 md:px-10">
      <div className="mb-3.5 font-mono text-[13px] font-bold tracking-[.14em] text-gold uppercase">
        Контакты
      </div>
      <h1 className="font-display m-0 mb-12 text-[28px] leading-[1.03] font-extrabold min-[420px]:text-[32px] md:text-[48px]">
        О фотографе
      </h1>

      <div className="grid gap-10 md:grid-cols-[340px_1fr] md:gap-12">
        <div className="w-full max-w-[360px] overflow-hidden rounded-[22px] border border-white/[.09]">
          <div className="aspect-[4/5]">
            <Photo src={about?.photoUrl} alt={about?.fio ?? ''} placeholder="Фото фотографа" loading="eager" />
          </div>
        </div>

        <div className="min-w-0">
          <h2 className="font-display m-0 mb-2 text-[24px] leading-tight font-bold min-[420px]:text-[26px] md:text-[32px]">
            {about?.fio || (isLoading ? '' : 'Фотограф')}
          </h2>
          {about?.role && <div className="mb-6 text-sm font-semibold text-gold">{about.role}</div>}
          {about?.desc && (
            <p className="m-0 mb-9 max-w-[560px] text-base leading-[1.7] text-white/70">{about.desc}</p>
          )}

          <div className="mb-9 flex max-w-[460px] flex-col gap-4 border-y border-white/[.09] py-6">
            {about?.phone && about.phoneHref && (
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                <span className="text-white/50">Телефон</span>
                <a href={about.phoneHref} className="font-semibold">
                  {about.phone}
                </a>
              </div>
            )}
            {about?.email && (
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                <span className="text-white/50">Email</span>
                <a href={`mailto:${about.email}`} className="font-semibold break-all">
                  {about.email}
                </a>
              </div>
            )}
            {about?.address && (
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                <span className="text-white/50">Адрес</span>
                <span className="font-semibold sm:text-right">{about.address}</span>
              </div>
            )}
          </div>

          {socials.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {socials.map((s) => (
                <a
                  key={s.key}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-[11px] border border-white/[.14] bg-white/[.04] px-5 py-3 text-sm font-semibold text-white/70 transition-colors hover:border-gold hover:bg-gold/[.12] hover:text-gold"
                >
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
