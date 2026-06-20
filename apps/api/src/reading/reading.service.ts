import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookFileFormat,
  BookStatus,
  EntitlementStatus,
  ProcessingStatus,
  Prisma,
} from '@easybookshelf/database';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpsertReadingProgressDto } from './dto/upsert-reading-progress.dto';

export type ReadingMode = 'none' | 'preview' | 'full';

@Injectable()
export class ReadingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getAccessBySlug(slug: string, userId?: string | null) {
    const book = await this.prisma.book.findFirst({
      where: { slug, status: BookStatus.approved },
      include: {
        files: {
          where: { processingStatus: ProcessingStatus.ready },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    return this.buildAccessResponse(book, userId);
  }

  async getAccessById(bookId: string, userId?: string | null) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, status: BookStatus.approved },
      include: {
        files: {
          where: { processingStatus: ProcessingStatus.ready },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    return this.buildAccessResponse(book, userId);
  }

  async getBookFile(
    bookId: string,
    format: BookFileFormat,
    requestedMode: 'preview' | 'full',
    userId?: string | null,
  ) {
    const access = await this.getAccessById(bookId, userId);

    if (requestedMode === 'full' && access.mode !== 'full') {
      throw new ForbiddenException({
        code: 'FULL_ACCESS_DENIED',
        message: 'Purchase or rent this book to read the full version',
      });
    }

    if (access.mode === 'none') {
      throw new ForbiddenException({
        code: 'READING_NOT_AVAILABLE',
        message: 'This book is not available for reading',
      });
    }

    if (!access.formats.includes(format)) {
      throw new NotFoundException({
        code: 'FORMAT_NOT_FOUND',
        message: `No ${format.toUpperCase()} file available for this book`,
      });
    }

    const file = await this.prisma.bookFile.findFirst({
      where: {
        bookId,
        format,
        processingStatus: ProcessingStatus.ready,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!file) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'Book file not found',
      });
    }

    const stored = await this.storage.getObject(file.s3KeyOriginal);
    const extension = format === BookFileFormat.epub ? 'epub' : 'pdf';
    const book = await this.prisma.book.findUniqueOrThrow({ where: { id: bookId } });

    return {
      buffer: stored.buffer,
      contentType: stored.contentType,
      fileName: `${book.slug}.${extension}`,
      access,
    };
  }

  async getProgress(userId: string, bookId: string) {
    const progress = await this.prisma.readingProgress.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });

    if (!progress) {
      return null;
    }

    return this.toProgress(progress);
  }

  async listHistory(userId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(pageSize, 1), 50);
    const skip = (safePage - 1) * safePageSize;

    const where = {
      userId,
      book: { status: BookStatus.approved },
    };

    const [rows, total] = await Promise.all([
      this.prisma.readingProgress.findMany({
        where,
        include: {
          book: {
            select: {
              id: true,
              title: true,
              slug: true,
              authorName: true,
              coverImageUrl: true,
            },
          },
        },
        orderBy: { lastReadAt: 'desc' },
        skip,
        take: safePageSize,
      }),
      this.prisma.readingProgress.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        bookId: row.bookId,
        format: row.format,
        progressPercent: Number(row.progressPercent),
        lastReadAt: row.lastReadAt.toISOString(),
        book: row.book,
      })),
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  async upsertProgress(userId: string, bookId: string, dto: UpsertReadingProgressDto) {
    await this.getAccessById(bookId, userId);

    const progress = await this.prisma.readingProgress.upsert({
      where: { userId_bookId: { userId, bookId } },
      create: {
        userId,
        bookId,
        format: dto.format,
        position: dto.position as Prisma.InputJsonValue,
        progressPercent: dto.progressPercent,
        lastReadAt: new Date(),
      },
      update: {
        format: dto.format,
        position: dto.position as Prisma.InputJsonValue,
        progressPercent: dto.progressPercent,
        lastReadAt: new Date(),
      },
    });

    return this.toProgress(progress);
  }

  private async buildAccessResponse(
    book: {
      id: string;
      slug: string;
      title: string;
      format: string;
      previewPageCount: number;
      previewChapterCount: number;
      files: { format: BookFileFormat }[];
    },
    userId?: string | null,
  ) {
    const formats = [...new Set(book.files.map((f) => f.format))];
    const hasEntitlement = userId ? await this.hasActiveEntitlement(userId, book.id) : false;
    const previewPageCount = book.previewPageCount > 0 ? book.previewPageCount : 20;
    const previewAvailable = formats.length > 0;

    let mode: ReadingMode = 'none';
    if (hasEntitlement) {
      mode = 'full';
    } else if (previewAvailable) {
      mode = 'preview';
    }

    return {
      bookId: book.id,
      slug: book.slug,
      title: book.title,
      bookFormat: book.format,
      mode,
      formats,
      previewPageCount,
      previewChapterCount: book.previewChapterCount,
      hasEntitlement,
    };
  }

  private async hasActiveEntitlement(userId: string, bookId: string) {
    const entitlement = await this.prisma.entitlement.findFirst({
      where: {
        userId,
        bookId,
        status: EntitlementStatus.active,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    return Boolean(entitlement);
  }

  private toProgress(progress: {
    id: string;
    bookId: string;
    format: BookFileFormat;
    position: unknown;
    progressPercent: { toNumber?: () => number } | number;
    lastReadAt: Date;
  }) {
    const percent =
      typeof progress.progressPercent === 'number'
        ? progress.progressPercent
        : progress.progressPercent.toNumber?.() ?? Number(progress.progressPercent);

    return {
      id: progress.id,
      bookId: progress.bookId,
      format: progress.format,
      position: progress.position as Record<string, unknown>,
      progressPercent: percent,
      lastReadAt: progress.lastReadAt.toISOString(),
    };
  }
}
