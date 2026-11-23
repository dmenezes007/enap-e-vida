import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  if (mode === 'server') {
    return {
      define: {'process.env.NODE_ENV': JSON.stringify('production')},
      build: {
        copyPublicDir: false,
        rolldownOptions: {output: {entryFileNames: 'server.mjs'}},
      },
    };
  }

  const isPages = mode === 'pages';
  const base = isPages ? '/enap-e-vida/' : '/';
  return {
    base,
    build: {copyPublicDir: !isPages},
    plugins: [
      {
        name: 'enap-app-html',
        transformIndexHtml: {
          order: 'pre',
          handler(_html, {filename}) {
            if (path.resolve(filename) === path.join(import.meta.dirname, 'index.html')) {
              return fs.readFileSync(path.join(import.meta.dirname, 'src', 'index.html'), 'utf8');
            }
          },
        },
      },
      react(),
      tailwindcss(),
      isPages && {
        name: 'copy-pages-brand-assets',
        apply: 'build',
        generateBundle(): void {
          for (const fileName of [
            'enap-e-vida.png',
            'apple-touch-icon.png',
            'pwa-192x192.png',
            'pwa-512x512.png',
            'pwa-maskable-512x512.png',
          ]) {
            this.emitFile({
              type: 'asset',
              fileName,
              source: fs.readFileSync(path.join(import.meta.dirname, 'public', fileName)),
            });
          }
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['enap-e-vida.png', 'apple-touch-icon.png'],
        manifest: {
          id: base,
          name: 'Enap e-Vida',
          short_name: 'Enap e-Vida',
          description:
            'Experiência institucional integrada da Enap: acolhimento, Jornada de Ambientação, PQVT, participação e diversidade.',
          theme_color: '#173640',
          background_color: '#FFF2DE',
          display: 'standalone',
          start_url: base,
          scope: base,
          lang: 'pt-BR',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Segurança (§28): nunca armazenar em cache da PWA rotas de API, formulários pessoais, dados bancários ou sensíveis.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,svg,woff,woff2,png,jpg}'],
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /\/api\//,
              handler: 'NetworkOnly',
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      !isPages && {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(import.meta.dirname, 'dist');
          const srcAssets = path.resolve(import.meta.dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': import.meta.dirname,
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
