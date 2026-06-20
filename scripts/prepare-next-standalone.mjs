import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const appRoot = resolve(process.argv[2] ?? process.cwd());
const pkg = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'));
const appName = pkg.name.startsWith('@')
  ? pkg.name.split('/').pop()
  : pkg.name;

const nextDir = join(appRoot, '.next');
const standaloneAppDir = join(nextDir, 'standalone', 'apps', appName);
const serverPath = join(standaloneAppDir, 'server.js');

if (!existsSync(serverPath)) {
  console.error(`Standalone server not found at ${serverPath}. Run next build first.`);
  process.exit(1);
}

for (const [src, dest, label] of [
  [join(nextDir, 'static'), join(standaloneAppDir, '.next', 'static'), 'static assets'],
  [join(appRoot, 'public'), join(standaloneAppDir, 'public'), 'public assets'],
]) {
  if (!existsSync(src)) {
    console.warn(`Skip ${label}: ${src} does not exist`);
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`Copied ${label} to ${dest}`);
}
