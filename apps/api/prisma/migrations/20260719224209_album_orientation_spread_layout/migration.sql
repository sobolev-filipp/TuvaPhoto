-- Ориентация альбома (альбомная/книжная) и режим разворота (1 фото / 2 фото).

CREATE TYPE "AlbumOrientation" AS ENUM ('LANDSCAPE', 'PORTRAIT');
CREATE TYPE "SpreadLayout" AS ENUM ('SINGLE', 'DOUBLE');

ALTER TABLE "Album" ADD COLUMN "orientation" "AlbumOrientation" NOT NULL DEFAULT 'LANDSCAPE';

ALTER TABLE "Spread" ADD COLUMN "layout" "SpreadLayout" NOT NULL DEFAULT 'SINGLE';
ALTER TABLE "Spread" ADD COLUMN "rightImageId" TEXT;
ALTER TABLE "Spread" ADD CONSTRAINT "Spread_rightImageId_fkey"
  FOREIGN KEY ("rightImageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
