import { Injectable, NotFoundException } from '@nestjs/common';
import { BookStatus } from '@easybookshelf/database';
import { Prisma } from '@easybookshelf/database';
import { PrismaService } from '../prisma/prisma.service';

const bookInclude = {
  publisher: { select: { id: true, name: true } },
  prices: { orderBy: { effectiveFrom: 'desc' as const }, take: 1 },
  categories: { include: { category: true } },
  languages: { include: { language: true } },
} satisfies Prisma.BookInclude;

type BookWithRelations = Prisma.BookGetPayload<{ include: typeof bookInclude }>;

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  async listBooks(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
    language?: string;
    featured?: boolean;
  }) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 20, 50);
    const skip = (page - 1) * pageSize;

    const where: Prisma.BookWhereInput = {
      status: BookStatus.approved,
      ...(params.featured ? { featured: true } : {}),
      ...(params.search
        ? {
            OR: [
              { title: { contains: params.search, mode: 'insensitive' } },
              { authorName: { contains: params.search, mode: 'insensitive' } },
              { subtitle: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(params.category
        ? { categories: { some: { category: { slug: params.category } } } }
        : {}),
      ...(params.language
        ? { languages: { some: { language: { code: params.language } } } }
        : {}),
    };

    const [books, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        include: bookInclude,
      }),
      this.prisma.book.count({ where }),
    ]);

    return {
      data: books.map((b) => this.toListItem(b)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getBookBySlug(slug: string) {
    const book = await this.prisma.book.findFirst({
      where: { slug, status: BookStatus.approved },
      include: bookInclude,
    });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    return this.toDetail(book);
  }

  private toListItem(book: BookWithRelations) {
    return {
      ...this.toBookBase(book),
      prices: this.toPrice(book.prices[0]),
      categories: book.categories.map((c) => ({
        id: c.category.id,
        name: c.category.name,
        slug: c.category.slug,
      })),
      languages: book.languages.map((l) => ({
        id: l.language.id,
        code: l.language.code,
        name: l.language.name,
      })),
    };
  }

  private toDetail(book: BookWithRelations) {
    return {
      ...this.toBookBase(book),
      description: book.description,
      prices: this.toPrice(book.prices[0]),
      categories: book.categories.map((c) => ({
        id: c.category.id,
        name: c.category.name,
        slug: c.category.slug,
      })),
      languages: book.languages.map((l) => ({
        id: l.language.id,
        code: l.language.code,
        name: l.language.name,
        nativeName: l.language.nativeName,
        rtl: l.language.rtl,
      })),
    };
  }

  private toBookBase(book: BookWithRelations) {
    return {
      id: book.id,
      title: book.title,
      subtitle: book.subtitle,
      slug: book.slug,
      description: book.description,
      isbn: book.isbn,
      authorName: book.authorName,
      coverImageUrl: book.coverImageUrl,
      format: book.format,
      previewPageCount: book.previewPageCount,
      status: book.status,
      publisherId: book.publisherId,
      publisherName: book.publisher.name,
      featured: book.featured,
      publishedAt: book.publishedAt?.toISOString() ?? null,
    };
  }

  private toPrice(price: BookWithRelations['prices'][0] | undefined) {
    if (!price) return null;
    return {
      purchasePrice: Number(price.purchasePrice),
      rental15Price: Number(price.rental15Price),
      rental30Price: Number(price.rental30Price),
      currency: price.currency,
    };
  }
}
