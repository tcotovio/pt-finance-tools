import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The only host-specific thing about this build is the URL it is served under.
// GitHub Pages project sites live at /<repo>/, so the Pages workflow sets
// VITE_BASE; every root-serving host (Netlify, Cloudflare, a custom domain,
// and the dev server) keeps the default. Moving host is this one variable.
const base = process.env.VITE_BASE ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Ferramentas financeiras — Portugal',
        short_name: 'Ferramentas PT',
        description:
          'Salário líquido e crédito à habitação em Portugal: retenção na fonte, subsídio de alimentação, duodécimos, IRS Jovem, e quanto pode pedir ao banco com os limites do Banco de Portugal. Tudo calculado no dispositivo.',
        lang: 'pt-PT',
        // Relative, so they follow `base` instead of pinning the app to the
        // domain root.
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#f5f7f8',
        theme_color: '#00674a',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            // Inset for Android's safe zone; source in icons/icon-maskable.svg.
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
