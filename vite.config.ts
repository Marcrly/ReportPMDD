import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const BEIGE = '#F3EDE2';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Nowa wersja instaluje sie w tle, a aplikacja pyta, czy odswiezyc.
      // Dzieki temu aktualizacja nigdy nie przerywa wypelniania wpisu.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'ReportPMDD: dziennik objawów',
        short_name: 'ReportPMDD',
        description: 'Codzienny dziennik objawów PMDD i PMS z analizą cyklu i eksportem do Excela.',
        lang: 'pl',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: BEIGE,
        theme_color: BEIGE,
        categories: ['health', 'lifestyle', 'medical'],
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        globIgnores: ['**/*vietnamese*', '**/*cyrillic*', '**/*greek*'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
