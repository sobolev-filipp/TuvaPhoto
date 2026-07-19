import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ProfileSubLayout } from './ProfileSubLayout'
import { ordersApi, type ApiMyOrder, type OrderStatus } from '@/lib/api'
import { formatPrice } from '@/domain/pricing'

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Ожидает оплаты',
  PAID: 'Оплачен',
  REFUND_PENDING: 'Ожидание возврата',
  REFUNDED: 'Деньги возвращены',
  CANCELLED: 'Отменён',
}

const STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: 'border-gold/40 bg-gold/10 text-gold',
  PAID: 'border-green-400/40 bg-green-500/10 text-green-300',
  REFUND_PENDING: 'border-orange-400/40 bg-orange-500/10 text-orange-300',
  REFUNDED: 'border-white/20 bg-white/5 text-white/60',
  CANCELLED: 'border-red-400/40 bg-red-500/10 text-red-300',
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })

function OrderRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-white/50">{label}</span>
      <span className="text-right font-medium text-bone">{value}</span>
    </div>
  )
}

function OrderItem({ order }: { order: ApiMyOrder }) {
  return (
    <div className="rounded-2xl border border-white/[.09] bg-surface-2 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="font-display text-[16px] font-bold">№{order.number}</span>
        <span className="text-[13px] text-white/45">{dateFmt.format(new Date(order.createdAt))}</span>
        <span
          className={`ml-auto flex-none rounded-full border px-2.5 py-1 text-[12px] font-semibold ${STATUS_CLASS[order.status]}`}
        >
          {STATUS_LABEL[order.status]}
        </span>
      </div>

      {order.category && <OrderRow label="Категория" value={order.category} />}
      <OrderRow label="Виды съёмки" value={order.shootTypes.join(', ') || '—'} />
      {order.cover && <OrderRow label="Обложка" value={order.cover} />}
      <OrderRow label="Итого" value={formatPrice(order.total)} />
      <OrderRow
        label="Внесено"
        value={`${formatPrice(order.amountPaid)} из ${formatPrice(order.total)}`}
      />
      {order.status === 'PENDING' && order.remaining > 0 && (
        <OrderRow label="Осталось внести" value={formatPrice(order.remaining)} />
      )}

      {order.payToken && order.status === 'PENDING' && order.remaining > 0 && (
        <Link
          to={`/pay/${order.payToken}`}
          className="mt-4 inline-block rounded-full bg-gold px-5 py-2.5 text-[14px] font-bold text-on-gold transition-colors hover:bg-gold-hover hover:text-on-gold"
        >
          Доплатить {formatPrice(order.remaining)}
        </Link>
      )}
    </div>
  )
}

export function OrdersPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['my-orders'], queryFn: ordersApi.mine })

  return (
    <ProfileSubLayout title="Мои заказы">
      {isLoading && <p className="text-white/50">Загружаем заказы…</p>}
      {isError && <p className="text-red-300">Не удалось загрузить заказы.</p>}
      {data?.length === 0 && (
        <div className="rounded-2xl border border-white/[.09] bg-surface-2 p-6 text-center">
          <p className="m-0 mb-4 text-white/55">У вас пока нет заказов.</p>
          <Link
            to="/constructor"
            className="inline-block rounded-full bg-gold px-6 py-3 text-[15px] font-bold text-on-gold hover:text-on-gold"
          >
            Собрать альбом
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {data?.map((o) => (
          <OrderItem key={o.number} order={o} />
        ))}
      </div>
    </ProfileSubLayout>
  )
}
