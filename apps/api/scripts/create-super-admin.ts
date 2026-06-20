/**
 * Bootstrap a super_admin account (Firebase + Postgres).
 *
 * Usage (from repo root):
 *   pnpm dev:create-super-admin -- --phone=9876543210
 *   pnpm dev:create-super-admin -- --phone=9876543210 --reclaim-phone
 *
 * Requires apps/api/.env with Firebase Admin credentials and DATABASE_URL.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient, UserRoleType } from '@easybookshelf/database';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const prisma = new PrismaClient();

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length).trim();

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1].trim();
  }

  return undefined;
}

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function initFirebaseAdmin() {
  if (getApps().length) return;

  const cwd = resolve(__dirname, '..');
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    const absolutePath = resolve(cwd, serviceAccountPath);
    const serviceAccount = JSON.parse(readFileSync(absolutePath, 'utf8')) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };

    initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    });
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_* in apps/api/.env',
    );
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
}

async function ensureFirebaseUser(email: string, password: string): Promise<string> {
  const auth = getAuth();

  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, {
      password,
      emailVerified: true,
      displayName: 'Super Admin',
    });
    return existing.uid;
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: string }).code)
        : '';
    if (code !== 'auth/user-not-found') throw err;

    const created = await auth.createUser({
      email,
      password,
      emailVerified: true,
      displayName: 'Super Admin',
    });
    return created.uid;
  }
}

async function main() {
  loadEnvFile(resolve(__dirname, '../.env'));

  const email =
    parseArg('email') ??
    process.env.SUPER_ADMIN_EMAIL ??
    'rahmanswords@gmail.com';
  const password =
    parseArg('password') ??
    process.env.SUPER_ADMIN_PASSWORD ??
    'Admin4123';
  const phone = parseArg('phone') ?? process.env.SUPER_ADMIN_PHONE;

  if (password.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  if (!phone) {
    console.error(
      'Mobile number is required for SMS OTP. Pass --phone=9876543210 or set SUPER_ADMIN_PHONE in apps/api/.env',
    );
    process.exit(1);
  }

  const phoneDigits = phone.replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(phoneDigits.length === 12 && phoneDigits.startsWith('91') ? phoneDigits.slice(2) : phoneDigits)) {
    console.error('Enter a valid 10-digit Indian mobile number.');
    process.exit(1);
  }
  const normalizedPhone =
    phoneDigits.length === 12 && phoneDigits.startsWith('91')
      ? phoneDigits.slice(2)
      : phoneDigits.length === 11 && phoneDigits.startsWith('0')
        ? phoneDigits.slice(1)
        : phoneDigits;
  const reclaimPhone = process.argv.includes('--reclaim-phone');

  initFirebaseAdmin();
  const firebaseUid = await ensureFirebaseUser(email, password);
  console.log(`Firebase user ready: ${email} (${firebaseUid})`);

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    include: { roles: true },
  });
  const existingByUid = existingByEmail
    ? null
    : await prisma.user.findUnique({
        where: { firebaseUid },
        include: { roles: true },
      });
  const existing = existingByEmail ?? existingByUid;

  const phoneOwner = await prisma.user.findUnique({
    where: { phone: normalizedPhone },
    select: { id: true, email: true, phone: true },
  });

  if (phoneOwner && phoneOwner.id !== existing?.id) {
    if (!reclaimPhone) {
      console.error(
        `Phone ${normalizedPhone} is already used by ${phoneOwner.email ?? phoneOwner.id}.`,
      );
      console.error(
        'Use a different number, or pass --reclaim-phone to detach it from the other account (dev only).',
      );
      process.exit(1);
    }

    await prisma.user.update({
      where: { id: phoneOwner.id },
      data: { phone: null, phoneVerifiedAt: null },
    });
    console.log(
      `Detached phone ${normalizedPhone} from ${phoneOwner.email ?? phoneOwner.id}`,
    );
  }

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          firebaseUid,
          email,
          displayName: 'Super Admin',
          status: 'active',
          phoneVerifiedAt: null,
          phone: normalizedPhone,
        },
        include: { roles: true },
      })
    : await prisma.user.create({
        data: {
          firebaseUid,
          email,
          displayName: 'Super Admin',
          status: 'active',
          phoneVerifiedAt: null,
          phone: normalizedPhone,
        },
        include: { roles: true },
      });

  const hasSuperAdmin = user.roles.some((r) => r.role === UserRoleType.super_admin);
  if (!hasSuperAdmin) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        role: UserRoleType.super_admin,
        scopeType: 'global',
      },
    });
  }

  const removed = await prisma.userRole.deleteMany({
    where: {
      userId: user.id,
      role: { not: UserRoleType.super_admin },
    },
  });

  console.log(`Database user: ${user.id}`);
  console.log(`Removed ${removed.count} non–super_admin role(s).`);
  console.log('OTP verification required on next admin sign-in (phoneVerifiedAt cleared).');
  console.log('');
  console.log('Sign in at http://localhost:3002/login');
  console.log(`  Email:    ${email}`);
  console.log('  Password: (as configured)');
  console.log('  OTP:      use email or mobile; dev code in API console when PHONE_OTP_DEV_MODE=true');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
