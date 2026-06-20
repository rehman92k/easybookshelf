import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookFileFormat,
  BookFormat,
  BookStatus,
  ProcessingStatus,
} from '@easybookshelf/database';
import { PrismaService } from '../prisma/prisma.service';

const bookInclude = {
  publisher: {
    include: {
      user: { select: { id: true, email: true, displayName: true } },
    },
  },
  prices: { orderBy: { effectiveFrom: 'desc' as const }, take: 1 },
  files: { orderBy: { createdAt: 'desc' as const } },
  categories: { include: { category: true } },
  languages: { include: { language: true } },
};

@Injectable()
export class AdminBooksService {
  constructor(private readonly prisma: PrismaService) {}

  async listBooks(
    page = 1,
    pageSize = 20,
    status: BookStatus = BookStatus.pending_review,
    search?: string,
  ) {
    const skip = (page - 1) * pageSize;
    const where = {
      status,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { authorName: { contains: search, mode: 'insensitive' as const } },
              { publisher: { name: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [books, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: bookInclude,
      }),
      this.prisma.book.count({ where }),
    ]);

    return {
      data: books.map((book) => this.toAdminBook(book)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getBook(bookId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      include: bookInclude,
    });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    return this.toAdminBook(book);
  }

  async approveBook(bookId: string, actorId: string, ipAddress?: string) {
    const book = await this.prisma.book.findUnique({ where: { id: bookId } });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    if (book.status !== BookStatus.pending_review) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Only books pending review can be approved',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.book.update({
        where: { id: bookId },
        data: {
          status: BookStatus.approved,
          publishedAt: new Date(),
          rejectionReason: null,
        },
        include: bookInclude,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'admin.book.approve',
          resourceType: 'book',
          resourceId: bookId,
          metadata: { title: book.title },
          ipAddress,
        },
      });

      return result;
    });

    return this.toAdminBook(updated);
  }

  async rejectBook(
    bookId: string,
    rejectionReason: string,
    actorId: string,
    ipAddress?: string,
  ) {
    const book = await this.prisma.book.findUnique({ where: { id: bookId } });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    if (book.status !== BookStatus.pending_review) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Only books pending review can be rejected',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.book.update({
        where: { id: bookId },
        data: {
          status: BookStatus.rejected,
          rejectionReason,
        },
        include: bookInclude,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'admin.book.reject',
          resourceType: 'book',
          resourceId: bookId,
          metadata: { title: book.title, rejectionReason },
          ipAddress,
        },
      });

      return result;
    });

    return this.toAdminBook(updated);
  }

  private toAdminBook(book: {
    id: string;
    title: string;
    subtitle: string | null;
    slug: string;
    description: string | null;
    isbn: string | null;
    authorName: string;
    coverImageUrl: string | null;
    format: BookFormat;
    previewPageCount: number;
    status: BookStatus;
    rejectionReason: string | null;
    featured: boolean;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    publisher: {
      id: string;
      name: string;
      slug: string;
      type: string;
      status: string;
      user: { id: string; email: string | null; displayName: string };
    };
    prices: {
      purchasePrice: unknown;
      rental15Price: unknown;
      rental30Price: unknown;
      currency: string;
    }[];
    files: {
      id: string;
      format: BookFileFormat;
      processingStatus: ProcessingStatus;
      fileSizeBytes: bigint | null;
      createdAt: Date;
    }[];
    categories: { category: { id: string; name: string; slug: string } }[];
    languages: { language: { id: string; code: string; name: string } }[];
  }) {
    const price = book.prices[0];

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
      rejectionReason: book.rejectionReason,
      featured: book.featured,
      publishedAt: book.publishedAt?.toISOString() ?? null,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
      prices: price
        ? {
            purchasePrice: Number(price.purchasePrice),
            rental15Price: Number(price.rental15Price),
            rental30Price: Number(price.rental30Price),
            currency: price.currency,
          }
        : null,
      files: book.files.map((file) => ({
        id: file.id,
        format: file.format,
        processingStatus: file.processingStatus,
        fileSizeBytes: file.fileSizeBytes ? Number(file.fileSizeBytes) : null,
        createdAt: file.createdAt.toISOString(),
      })),
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
      publisher: {
        id: book.publisher.id,
        name: book.publisher.name,
        slug: book.publisher.slug,
        type: book.publisher.type,
        status: book.publisher.status,
      },
      publisherUser: {
        id: book.publisher.user.id,
        email: book.publisher.user.email,
        displayName: book.publisher.user.displayName,
      },
    };
  }
}
