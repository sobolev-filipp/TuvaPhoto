import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import os from 'node:os'

/**
 * Печатает при старте dev-сервера понятные адреса: локальный (этот компьютер) и
 * сетевой (открыть с телефона/другого устройства в той же сети). Vite показывает
 * их и сам, но в общем логе `concurrently` сетевой адрес легко пропустить.
 */
function startupBanner(): Plugin {
  return {
    name: 'tuvafoto-startup-banner',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address()
        const port = typeof addr === 'object' && addr ? addr.port : 5173
        // Все внешние IPv4-адреса машины (Wi-Fi/Ethernet).
        const lan: string[] = []
        for (const list of Object.values(os.networkInterfaces())) {
          for (const net of list ?? []) {
            if (net.family === 'IPv4' && !net.internal) lan.push(net.address)
          }
        }
        // Печатаем чуть позже вывода самого Vite, чтобы баннер был снизу.
        setTimeout(() => {
          const line = '─'.repeat(46)
          console.log(`\n  ${line}`)
          console.log('   ТуваФото — сайт запущен')
          console.log(`   • На этом компьютере:    http://localhost:${port}`)
          if (lan.length > 0) {
            for (const ip of lan) {
              console.log(`   • С телефона/устройства: http://${ip}:${port}`)
            }
            console.log('     (устройство должно быть в той же Wi-Fi/сети)')
          } else {
            console.log('   • Сетевой адрес не найден — проверьте подключение к сети')
          }
          console.log(`  ${line}\n`)
        }, 120)
      })
    },
  }
}

export default defineConfig({
  plugins: [
    startupBanner(),
    react(),
    tailwindcss(),
    VitePWA({
      // prompt = сами показываем плашку «доступно обновление» вместо тихого автообновления
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'ТуваФото — выпускные фотоальбомы',
        short_name: 'ТуваФото',
        description:
          'Авторские фотокниги для выпускных классов и детских садов: каталог, конструктор альбома, заказ.',
        lang: 'ru',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0B0B0E',
        theme_color: '#0B0B0E',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
        runtimeCaching: [
          {
            // Фото альбомов: отдаём из кэша, обновляем в фоне.
            urlPattern: /\/uploads\/.*\.(?:png|jpg|jpeg|webp|avif)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'tuvafoto-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    // host: true — слушаем на всех интерфейсах, чтобы открыть с телефона по
    // адресу вида http://<IP-компа>:5173 (запросы к /api и сокет идут через прокси).
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
      // WebSocket админки (socket.io). ws:true — иначе рукопожатие не проксируется.
      '/socket.io': { target: 'http://localhost:3000', changeOrigin: true, ws: true },
    },
  },
})
