-- Задняя картинка обложки (передняя — уже существующий imageId).
ALTER TABLE "CoverVariant" ADD COLUMN "backImageId" TEXT;

ALTER TABLE "CoverVariant" ADD CONSTRAINT "CoverVariant_backImageId_fkey"
  FOREIGN KEY ("backImageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ссылка альбома на готовую обложку (CoverVariant).
ALTER TABLE "Album" ADD COLUMN "coverVariantId" TEXT;

ALTER TABLE "Album" ADD CONSTRAINT "Album_coverVariantId_fkey"
  FOREIGN KEY ("coverVariantId") REFERENCES "CoverVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Album_coverVariantId_idx" ON "Album"("coverVariantId");
