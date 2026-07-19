-- Обложки привязываются к категории (детсад/школа/…), а не к виду съёмки.

-- Флаг «можно выбирать обложку» у категории.
ALTER TABLE "Category" ADD COLUMN "allowCover" BOOLEAN NOT NULL DEFAULT false;

-- Категория заказа (для истории/фильтров).
ALTER TABLE "Order" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Неявная M2M Category ↔ CoverVariant (A=Category, B=CoverVariant по алфавиту).
CREATE TABLE "_CategoryToCoverVariant" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToCoverVariant_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_CategoryToCoverVariant_B_index" ON "_CategoryToCoverVariant"("B");
ALTER TABLE "_CategoryToCoverVariant" ADD CONSTRAINT "_CategoryToCoverVariant_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_CategoryToCoverVariant" ADD CONSTRAINT "_CategoryToCoverVariant_B_fkey"
  FOREIGN KEY ("B") REFERENCES "CoverVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
