import { copyFileSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../public');
mkdirSync(publicDir, { recursive: true });

function resolvePdfjsRoot() {
  try {
    return dirname(require.resolve('pdfjs-dist/package.json'));
  } catch {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
    const matches = [
      join(repoRoot, 'node_modules/pdfjs-dist/package.json'),
      join(repoRoot, 'node_modules/.pnpm/pdfjs-dist@5.4.296/node_modules/pdfjs-dist/package.json'),
    ];
    for (const pkgPath of matches) {
      if (existsSync(pkgPath)) return dirname(pkgPath);
    }
    throw new Error('pdfjs-dist is not installed. Run pnpm install first.');
  }
}

const pdfjsRoot = resolvePdfjsRoot();

copyFileSync(
  join(pdfjsRoot, 'build/pdf.worker.min.mjs'),
  join(publicDir, 'pdf.worker.min.mjs'),
);

for (const dir of ['cmaps', 'standard_fonts']) {
  cpSync(join(pdfjsRoot, dir), join(publicDir, dir), { recursive: true });
}

console.log('Copied PDF.js worker, cmaps, and standard_fonts to public/');
