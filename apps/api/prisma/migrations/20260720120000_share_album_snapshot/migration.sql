-- Пересобираем ShareAlbum под снимок демо, привязанный к оплаченному заказу.
-- Таблица была заглушкой без использования — очищаем перед NOT NULL orderId.
DELETE FROM "ShareAlbum";

ALTER TABLE "ShareAlbum" DROP COLUMN "albumId";
ALTER TABLE "ShareAlbum" ADD COLUMN "orderId" TEXT NOT NULL;
ALTER TABLE "ShareAlbum" ADD COLUMN "orientation" "AlbumOrientation" NOT NULL DEFAULT 'LANDSCAPE';
ALTER TABLE "ShareAlbum" ADD COLUMN "coverImageId" TEXT;
ALTER TABLE "ShareAlbum" ADD COLUMN "backCoverImageId" TEXT;
ALTER TABLE "ShareAlbum" ADD COLUMN "contentDeletedAt" TIMESTAMP(3);
ALTER TABLE "ShareAlbum" ADD COLUMN "diskUrl" TEXT;
ALTER TABLE "ShareAlbum" ADD COLUMN "downloadUntil" TIMESTAMP(3);
ALTER TABLE "ShareAlbum" ALTER COLUMN "subtitle" SET DEFAULT '';

CREATE INDEX "ShareAlbum_orderId_idx" ON "ShareAlbum"("orderId");

ALTER TABLE "ShareAlbum" ADD CONSTRAINT "ShareAlbum_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShareAlbum" ADD CONSTRAINT "ShareAlbum_coverImageId_fkey"
  FOREIGN KEY ("coverImageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShareAlbum" ADD CONSTRAINT "ShareAlbum_backCoverImageId_fkey"
  FOREIGN KEY ("backCoverImageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Развороты демо (снимок).
CREATE TABLE "ShareSpread" (
  "id" TEXT NOT NULL,
  "shareAlbumId" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT '',
  "layout" "SpreadLayout" NOT NULL DEFAULT 'SINGLE',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "imageId" TEXT,
  "rightImageId" TEXT,
  CONSTRAINT "ShareSpread_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShareSpread_shareAlbumId_idx" ON "ShareSpread"("shareAlbumId");

ALTER TABLE "ShareSpread" ADD CONSTRAINT "ShareSpread_shareAlbumId_fkey"
  FOREIGN KEY ("shareAlbumId") REFERENCES "ShareAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShareSpread" ADD CONSTRAINT "ShareSpread_imageId_fkey"
  FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShareSpread" ADD CONSTRAINT "ShareSpread_rightImageId_fkey"
  FOREIGN KEY ("rightImageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
