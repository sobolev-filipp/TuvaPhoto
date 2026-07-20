-- Флаг: показывать альбом в конструкторе как «готовый вариант».
ALTER TABLE "Album" ADD COLUMN "inConstructor" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Album_inConstructor_idx" ON "Album"("inConstructor");
