import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Salário líquido — ferramentas financeiras PT',
        short_name: 'Salário líquido',
        description:
          'Simulador do salário líquido em Portugal: retenção na fonte, subsídio de alimentação, duodécimos e IRS Jovem. Tudo calculado no dispositivo.',
        lang: 'pt-PT',
        start_url: '/',
        display: 'standalone',
        background_color: '#f5f7f8',
        theme_color: '#00674a',
        // TODO: replace with real app icons (192x192 / 512x512 PNG) before shipping;
        // a single SVG satisfies the manifest but not every install surface.
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
})
