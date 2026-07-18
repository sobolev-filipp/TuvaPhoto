/**
 * Генерирует PNG-иконки PWA из логотипа-монумента.
 * Запуск: npm run icons --workspace apps/web
 *
 * Maskable-вариант рисуется с запасом по краям: Android обрезает иконку
 * под форму устройства, и без запаса монумент срезается.
 */
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(dir, '..', 'public', 'icons')

const INK = '#0B0B0E'
const GOLD = '#E4B45C'

/** @param {number} scale доля холста, которую занимает монумент */
const monument = (scale) => {
  const pad = (1 - scale) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${INK}"/>
  <svg x="${(pad * 100).toFixed(2)}%" y="${(pad * 100).toFixed(2)}%" width="${(scale * 100).toFixed(2)}%" height="${(scale * 100).toFixed(2)}%" viewBox="0 0 40 66">
    <g fill="${GOLD}">
      <path d="M18.5 38 L20 5 L21.5 38 Z"/>
      <circle cx="20" cy="3.4" r="2"/>
      <circle cx="20" cy="45" r="7.6" fill="none" stroke="${GOLD}" stroke-width="1.9"/>
      <path d="M12.6 47.5 c-3.2 .5 -4.9 3 -5.1 6.6 l2.9 0 c.2 -2.8 1.2 -4.3 3.2 -5.1 Z"/>
      <path d="M27.4 47.5 c3.2 .5 4.9 3 5.1 6.6 l-2.9 0 c-.2 -2.8 -1.2 -4.3 -3.2 -5.1 Z"/>
      <path d="M9.5 54.5 h21 l-2.7 8.5 h-15.6 Z"/>
    </g>
  </svg>
</svg>`
}

const targets = [
  { file: 'icon-192.png', size: 192, scale: 0.72 },
  { file: 'icon-512.png', size: 512, scale: 0.72 },
  { file: 'icon-512-maskable.png', size: 512, scale: 0.52 },
]

await mkdir(outDir, { recursive: true })

for (const { file, size, scale } of targets) {
  await sharp(Buffer.from(monument(scale)), { density: 384 })
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, file))
  console.log('✓', file, `${size}×${size}`)
}
