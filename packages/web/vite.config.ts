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
        name: 'PT Finance Tools',
        short_name: 'PT Finance',
        description: 'Portuguese net wage and loan calculators',
        theme_color: '#ffffff',
        // TODO: replace with real app icons (192x192 / 512x512 PNG) before shipping;
        // this SVG is the stock Vite placeholder so the manifest doesn't reference missing files.
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
})
