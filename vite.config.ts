import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createRequire, isBuiltin } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);

const rejectMissingBrowserModules: Plugin = {
  name: 'reject-missing-browser-modules',
  enforce: 'pre',
  apply: 'build',
  async resolveId(id, importer) {
    if (!isBuiltin(id)) return;
    const resolved = await this.resolve(id, importer, { skipSelf: true });
    if (!resolved?.id.includes('__vite-browser-external')) return resolved;

    // Respect explicit browser:false mappings. These intentionally disable
    // platform-specific branches, unlike an accidentally missing Node shim.
    if (importer && !importer.startsWith('\0')) {
      let directory = dirname(importer.split('?')[0]);
      while (directory !== dirname(directory)) {
        const manifest = join(directory, 'package.json');
        if (existsSync(manifest)) {
          const { browser } = JSON.parse(readFileSync(manifest, 'utf8'));
          if (browser && typeof browser === 'object' &&
            (browser[id] === false || browser[id.replace(/^node:/, '')] === false)) return resolved;
        }
        directory = dirname(directory);
      }
    }
    this.error(`Missing browser implementation for ${id}, imported by ${importer}`);
  },
};

export default defineConfig({
  base: './',
  plugins: [react(), rejectMissingBrowserModules],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-intl'],
    alias: [
      // These Node-style imports are used by Atlaskit's browser code. Resolve
      // actual browser implementations instead of Vite's empty external stubs.
      { find: /^(?:node:)?events$/, replacement: require.resolve('events/') },
      { find: /^(?:node:)?buffer$/, replacement: require.resolve('buffer/') },
      { find: /^(?:node:)?string_decoder$/, replacement: require.resolve('string_decoder/') },
      { find: /^(?:node:)?process$/, replacement: require.resolve('process/browser.js') },
    ],
  },
  css: {
    // Some upstream Compiled card styles contain invalid pseudo-element
    // selectors. Discard those rules as browsers do, preserving minification
    // and surfacing the parser warnings instead of failing the whole build.
    lightningcss: { errorRecovery: true },
  },
  build: {
    outDir: 'build',
    manifest: true,
    // Preserve the existing GitHub Pages deployment folder and short chunk names.
    rolldownOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
