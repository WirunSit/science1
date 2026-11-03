import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
// Which lab to build/serve: LAB=heat-lab npm run dev
const lab = process.env.LAB ?? 'heat-lab';

export default defineConfig({
  root: resolve(root, 'apps', lab),
  base: './',
  resolve: {
    alias: {
      '@shared': resolve(root, 'apps/shared'),
      '@content': resolve(root, 'content'),
    },
  },
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: resolve(root, 'dist', lab),
    emptyOutDir: true,
    // Fonts and everything else must be inlined: the lab has to work offline from file://
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
  server: { port: 5173, fs: { allow: [root] } },
});
