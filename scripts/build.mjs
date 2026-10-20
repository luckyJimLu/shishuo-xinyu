import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const path of ['index.html', 'data', 'README.md']) {
  await cp(path, `dist/${path}`, { recursive: true });
}
console.log('Built static site into dist/');
