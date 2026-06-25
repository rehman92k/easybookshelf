import { Injectable, NotFoundException } from '@nestjs/common';
import { BookStatus } from '@easybookshelf/database';
import { PlatformConfigService } from '../commerce/platform-config.service';
import { serializeBookPrice } from '../commerce/rental-pricing';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformConfig: PlatformConfigService,
  ) {}

  async list(userId: string) {
    const [rows, periodDays] = await Promise.all([
      this.prisma.wishlist.findMany({
      where: {
        userId,
        book: { status: BookStatus.approved },
      },
      include: {
        book: {
          include: {
            prices: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { addedAt: 'desc' },
      }),
      this.platformConfig.getRentalPeriodDays(),
    ]);

    return rows.map((row) => ({
      bookId: row.bookId,
      addedAt: row.addedAt.toISOString(),
      book: {
        id: row.book.id,
        title: row.book.title,
        slug: row.book.slug,
        authorName: row.book.authorName,
        coverImageUrl: row.book.coverImageUrl,
        prices: serializeBookPrice(row.book.prices[0], periodDays),
      },
    }));
  }

  async add(userId: string, bookSlug: string) {
    const book = await this.prisma.book.findFirst({
      where: { slug: bookSlug, status: BookStatus.approved },
    });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    await this.prisma.wishlist.upsert({
      where: { userId_bookId: { userId, bookId: book.id } },
      create: { userId, bookId: book.id },
      update: {},
    });

    return { bookId: book.id, bookSlug: book.slug, saved: true };
  }

  async remove(userId: string, bookSlug: string) {
    const book = await this.prisma.book.findFirst({
      where: { slug: bookSlug, status: BookStatus.approved },
    });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    await this.prisma.wishlist.deleteMany({
      where: { userId, bookId: book.id },
    });

    return { bookId: book.id, bookSlug: book.slug, saved: false };
  }

  async check(userId: string, bookSlug: string) {
    const book = await this.prisma.book.findFirst({
      where: { slug: bookSlug, status: BookStatus.approved },
      select: { id: true },
    });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    const row = await this.prisma.wishlist.findUnique({
      where: { userId_bookId: { userId, bookId: book.id } },
    });

    return { bookSlug, saved: Boolean(row) };
  }
}
