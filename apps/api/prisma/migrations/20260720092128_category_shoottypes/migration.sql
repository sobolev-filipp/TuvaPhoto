-- Виды съёмки, доступные в категории (M2M). Список видов в конструкторе и
-- редакторе альбома зависит от выбранной категории.
CREATE TABLE "_CategoryToShootType" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToShootType_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_CategoryToShootType_B_index" ON "_CategoryToShootType"("B");
ALTER TABLE "_CategoryToShootType" ADD CONSTRAINT "_CategoryToShootType_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_CategoryToShootType" ADD CONSTRAINT "_CategoryToShootType_B_fkey"
  FOREIGN KEY ("B") REFERENCES "ShootType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
