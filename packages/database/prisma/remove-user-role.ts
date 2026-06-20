import { PrismaClient, UserRoleType } from '@prisma/client';

const prisma = new PrismaClient();

const VALID_ROLES = new Set<string>(Object.values(UserRoleType));

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

async function listRoles(userId: string) {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: { role: true, scopeType: true },
    orderBy: { role: 'asc' },
  });
  return roles;
}

async function removeRole(userId: string, role: UserRoleType, label: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`User not found: ${label}`);
    process.exit(1);
  }

  const before = await listRoles(userId);
  if (before.length === 0) {
    console.error(`User has no roles: ${user.email ?? user.phone ?? user.id}`);
    process.exit(1);
  }

  const hasRole = before.some((entry) => entry.role === role);
  if (!hasRole) {
    console.error(`User does not have role "${role}". Current roles: ${before.map((r) => r.role).join(', ')}`);
    process.exit(1);
  }

  console.log(`User: ${user.email ?? user.phone ?? user.id}`);
  console.log(`Roles before: ${before.map((r) => r.role).join(', ')}`);

  const deleted = await prisma.userRole.deleteMany({
    where: { userId, role },
  });

  if (deleted.count === 0) {
    console.error(`Could not remove role "${role}"`);
    process.exit(1);
  }

  const after = await listRoles(userId);
  console.log(`Removed role: ${role}`);
  console.log(`Roles after: ${after.length > 0 ? after.map((r) => r.role).join(', ') : '(none)'}`);
  console.log('\nSign out and sign in again so your access token picks up the new roles.');
}

async function main() {
  const force = process.argv.includes('--force');
  if (process.env.NODE_ENV === 'production' && !force) {
    console.error('Refusing to run in production. Pass --force if you really mean it.');
    process.exit(1);
  }

  const email = parseArg('email');
  const phone = parseArg('phone');
  const id = parseArg('id');
  const roleInput = parseArg('role');

  if (!roleInput) {
    console.error(
      'Usage: pnpm dev:remove-role --email=user@example.com --role=reader\n' +
        '       pnpm dev:remove-role --phone=9876543210 --role=reader\n' +
        '       pnpm dev:remove-role --id=<uuid> --role=reader\n' +
        '\nRoles: reader, author, publisher, publisher_staff, admin_content, admin_finance, super_admin',
    );
    process.exit(1);
  }

  if (!VALID_ROLES.has(roleInput)) {
    console.error(`Invalid role "${roleInput}". Valid: ${[...VALID_ROLES].join(', ')}`);
    process.exit(1);
  }

  const role = roleInput as UserRoleType;

  if (!email && !phone && !id) {
    console.error('Provide --email, --phone, or --id');
    process.exit(1);
  }

  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`No user with email: ${email}`);
      process.exit(1);
    }
    await removeRole(user.id, role, email);
    return;
  }

  if (phone) {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      console.error(`No user with phone: ${phone}`);
      process.exit(1);
    }
    await removeRole(user.id, role, phone);
    return;
  }

  if (id) {
    await removeRole(id, role, id);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
