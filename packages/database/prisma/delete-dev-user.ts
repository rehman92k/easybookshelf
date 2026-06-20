import { PrismaClient } from '@prisma/client';

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

async function deleteUser(userId: string, label: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { publisher: true },
  });

  if (!user) {
    console.error(`User not found: ${label}`);
    process.exit(1);
  }

  console.log(`Deleting user: ${user.email ?? user.phone ?? user.id}`);

  await prisma.$transaction(async (tx) => {
    await tx.entitlement.deleteMany({ where: { userId } });

    const orders = await tx.order.findMany({
      where: { userId },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);

    if (orderIds.length > 0) {
      await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.order.deleteMany({ where: { userId } });
      console.log(`  Removed ${orderIds.length} order(s)`);
    }

    const publisherId = user.publisher?.id;
    if (publisherId) {
      const salesCount = await tx.orderItem.count({ where: { publisherId } });
      if (salesCount > 0) {
        throw new Error(
          `${salesCount} order item(s) reference this publisher. ` +
            'Cannot delete safely (other users may be affected). Use a fresh test account.',
        );
      }

      await tx.settlement.deleteMany({ where: { publisherId } });
      await tx.commissionRateHistory.deleteMany({ where: { publisherId } });

      const booksDeleted = await tx.book.deleteMany({ where: { publisherId } });
      if (booksDeleted.count > 0) {
        console.log(`  Removed ${booksDeleted.count} book(s)`);
      }
    }

    await tx.user.delete({ where: { id: userId } });
  });

  console.log('Database user deleted.');
  if (user.firebaseUid) {
    console.log(
      `\nAlso delete this user in Firebase Console → Authentication:\n  ${user.email ?? user.firebaseUid}`,
    );
  }
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

  if (!email && !phone && !id) {
    console.error(
      'Usage: pnpm dev:delete-user --email=user@example.com\n' +
        '       pnpm dev:delete-user --phone=9876543210\n' +
        '       pnpm dev:delete-user --id=<uuid>',
    );
    process.exit(1);
  }

  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`No user with email: ${email}`);
      process.exit(1);
    }
    await deleteUser(user.id, email);
    return;
  }

  if (phone) {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      console.error(`No user with phone: ${phone}`);
      process.exit(1);
    }
    await deleteUser(user.id, phone);
    return;
  }

  if (id) {
    await deleteUser(id, id);
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
