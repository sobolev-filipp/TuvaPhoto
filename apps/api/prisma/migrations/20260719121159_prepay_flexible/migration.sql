-- Гибкая предоплата: процент (20/30/40/50), своя сумма (≥20%) или полная оплата.

-- Переименование значения enum без потери данных (было PREPAY50 → стало PREPAY).
ALTER TYPE "PayType" RENAME VALUE 'PREPAY50' TO 'PREPAY';

-- Процент предоплаты для пресетов; NULL при своей сумме или полной оплате.
ALTER TABLE "Order" ADD COLUMN "prepayPercent" INTEGER;

-- Все прежние заказы с предоплатой были ровно 50%.
UPDATE "Order" SET "prepayPercent" = 50 WHERE "payType" = 'PREPAY';
