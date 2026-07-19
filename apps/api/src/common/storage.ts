import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Абсолютный путь к папке загруженных файлов. STORAGE_DIR из .env может быть
 * относительным (по умолчанию ./uploads) — приводим к абсолютному и создаём
 * папку, если её ещё нет. Позже вместо диска можно подключить S3.
 */
export function storageDir(): string {
  const dir = resolve(process.env.STORAGE_DIR ?? './uploads')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Публичный URL файла по его пути внутри хранилища. */
export const publicUrl = (path: string): string => `/uploads/${path}`
