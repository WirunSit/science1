// Builds every lab in apps/ (except shared) into dist/<lab>/index.html. Run: npm run build
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';
import { root } from './content';

const labs = readdirSync(resolve(root, 'apps'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'shared' && existsSync(resolve(root, 'apps', d.name, 'index.html')))
  .map((d) => d.name);

for (const lab of labs) {
  process.env.LAB = lab;
  await build({ configFile: resolve(root, 'vite.config.ts'), logLevel: 'warn' });
  console.log(`dist/${lab}/index.html`);
}
