/**
 * Fabrique les bibliothèques des scènes du tableau dans public/scene-libs/ (non versionné) :
 *   - three.js : three.js + contrôles, chargeur GLB (avec décodeur meshopt), environnement, étiquettes ;
 *   - chart.js : Chart.js (graphiques).
 * Lancé avant `vite` (predev, seulement s'il en manque) et `vite build` (prebuild, toujours).
 */
import { access, copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/scene-libs');
await mkdir(out, { recursive: true });

// Avant `vite` (predev), on ne refait pas des bibliothèques déjà là ; --force les refait toujours
const present = await Promise.all(['three.js', 'chart.js'].map((f) => access(resolve(out, f)).then(() => true, () => false)));
if (!process.argv.includes('--force') && present.every(Boolean)) process.exit(0);

await build({
  configFile: false,
  root,
  logLevel: 'warn',
  publicDir: false,
  build: {
    outDir: out,
    emptyOutDir: false,
    minify: true,
    sourcemap: false,
    lib: { entry: resolve(root, 'scene-libs/three.ts'), formats: ['iife'], name: 'THREE', fileName: () => 'three.js' },
    rolldownOptions: { output: { exports: 'default' } },
  },
});

await copyFile(resolve(root, 'node_modules/chart.js/dist/chart.umd.min.js'), resolve(out, 'chart.js'));
console.log('Bibliothèques des scènes : public/scene-libs/ (three.js, chart.js)');
