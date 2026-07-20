import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, ApiError, type AdminAlbumListItem } from '@/lib/api'
import { formatPrice } from '@/domain/pricing'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AlbumEditor } from './AlbumEditor'

const orientationLabel = (o: AdminAlbumListItem['orientation']) =>
  o === 'PORTRAIT' ? 'Книжная' : 'Альбомная'

export function AlbumsTab() {
  const qc = useQueryClient()
  const albums = useQuery({ queryKey: ['admin', 'albums'], queryFn: adminApi.albums })

  // null — список; 'new' — создание; id — правка.
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [confirming, setConfirming] = useState<AdminAlbumListItem | null>(null)
  const [delError, setDelError] = useState<string | null>(null)

  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteAlbum(id),
    onSuccess: () => {
      setConfirming(null)
      void qc.invalidateQueries({ queryKey: ['admin', 'albums'] })
    },
    onError: (e: unknown) =>
      setDelError(e instanceof ApiError ? e.message : 'Не удалось удалить альбом'),
  })

  if (editing !== null) {
    return <AlbumEditor id={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-display m-0 text-[22px] font-extrabold">Альбомы</h2>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="cursor-pointer rounded-full bg-gold px-4 py-2 text-[13px] font-bold text-on-gold transition-colors hover:bg-gold-hover"
        >
          + Добавить
        </button>
      </div>

      {albums.isLoading && <p className="text-white/50">Загружаем альбомы…</p>}
      {albums.isError && <p className="text-red-300">Не удалось загрузить альбомы.</p>}
      {albums.data?.length === 0 && <p className="text-white/50">Альбомов пока нет.</p>}

      <div className="flex flex-col gap-3">
        {albums.data?.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-4 rounded-2xl border border-white/[.09] bg-surface-2 p-3 sm:p-4"
          >
            <div className="h-16 w-16 flex-none overflow-hidden rounded-xl border border-white/[.1] bg-white/[.03]">
              {a.coverUrl ? (
                <img src={a.coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] text-white/30">нет фото</div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-[15px] font-bold">{a.name}</span>
                {!a.isPublished && (
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/45">
                    черновик
                  </span>
                )}
                {a.isFeatured && (
                  <span className="rounded-full border border-gold/40 px-2 py-0.5 text-[11px] text-gold">
                    на главной
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[13px] text-white/45">
                {a.category} · {orientationLabel(a.orientation)} · {a.spreadsCount} разв. · от{' '}
                {formatPrice(a.price)}
              </div>
            </div>

            <div className="flex flex-none gap-2">
              <button
                type="button"
                onClick={() => setEditing(a.id)}
                className="cursor-pointer rounded-lg border border-white/15 px-3 py-1.5 text-[13px] font-semibold text-bone transition-colors hover:border-gold/50 hover:text-gold"
              >
                Изменить
              </button>
              <button
                type="button"
                onClick={() => {
                  setDelError(null)
                  setConfirming(a)
                }}
                className="cursor-pointer rounded-lg border border-red-400/30 px-3 py-1.5 text-[13px] font-semibold text-red-300 transition-colors hover:border-red-400/60"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirming && (
        <ConfirmDialog
          title="Удалить альбом"
          message={`Удалить альбом «${confirming.name}»? Это действие необратимо.`}
          busy={del.isPending}
          error={delError}
          onConfirm={() => del.mutate(confirming.id)}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  )
}
