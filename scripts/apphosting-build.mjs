import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.env.APPHOSTING_BACKEND ?? 'reader';

const scripts = {
  reader: 'apphosting:build:reader',
  publisher: 'apphosting:build:publisher',
  admin: 'apphosting:build:admin',
};

const script = scripts[target];
if (!script) {
  console.error(
    `Unknown APPHOSTING_BACKEND="${target}". Expected one of: ${Object.keys(scripts).join(', ')}`,
  );
  process.exit(1);
}

execSync(`pnpm run ${script}`, { cwd: repoRoot, stdio: 'inherit', env: process.env });
