-- Переработка статусов заказа: отмена → возврат средств; учёт внесённой суммы;
-- ссылка на доплату.

-- Новые статусы (ADD VALUE в PG17 допустим вне непосредственного использования).
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUND_PENDING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

-- Учёт оплаты и возврата.
ALTER TABLE "Order" ADD COLUMN "amountPaid" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "refundAmount" INTEGER;
ALTER TABLE "Order" ADD COLUMN "payToken" TEXT;
CREATE UNIQUE INDEX "Order_payToken_key" ON "Order"("payToken");
