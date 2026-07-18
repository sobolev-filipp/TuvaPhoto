import { Photo } from '@/components/Photo'
import { about, CONTACT_PHONE_HREF } from '@/domain/demoData'

const socials = [
  { key: 'tg', href: about.tg, label: 'Telegram' },
  { key: 'vk', href: about.vk, label: 'ВКонтакте' },
].filter((s) => s.href)

export function ContactsPage() {
  return (
    <div className="animate-fade-up mx-auto max-w-[1240px] px-4 pt-[70px] pb-[100px] md:px-10">
      <div className="mb-3.5 font-mono text-[13px] font-bold tracking-[.14em] text-gold uppercase">
        Контакты
      </div>
      <h1 className="font-display m-0 mb-12 text-[32px] leading-[1.03] font-extrabold md:text-[48px]">
        О фотографе
      </h1>

      <div className="grid gap-12 md:grid-cols-[380px_1fr]">
        <div className="max-w-[360px] overflow-hidden rounded-[22px] border border-white/[.09]">
          <div className="aspect-[4/5]">
            <Photo src={about.photoUrl} alt={about.fio} placeholder="Фото фотографа" loading="eager" />
          </div>
        </div>

        <div>
          <h2 className="font-display m-0 mb-2 text-[26px] leading-tight font-bold md:text-[32px]">
            {about.fio}
          </h2>
          <div className="mb-6 text-sm font-semibold text-gold">{about.role}</div>
          <p className="m-0 mb-9 max-w-[560px] text-base leading-[1.7] text-white/70">{about.desc}</p>

          <div className="mb-9 flex max-w-[460px] flex-col gap-4 border-y border-white/[.09] py-6">
            <div className="flex justify-between gap-4">
              <span className="text-white/50">Телефон</span>
              <a href={CONTACT_PHONE_HREF} className="font-semibold">
                {about.phone}
              </a>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">Email</span>
              <a href={`mailto:${about.email}`} className="font-semibold">
                {about.email}
              </a>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">Адрес</span>
              <span className="text-right font-semibold">{about.address}</span>
            </div>
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
