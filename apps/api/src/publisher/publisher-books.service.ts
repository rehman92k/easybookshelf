import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookFileFormat,
  BookFormat,
  BookStatus,
  ProcessingStatus,
} from '@easybookshelf/database';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PublisherService } from './publisher.service';
import { CreatePublisherBookDto } from './dto/create-publisher-book.dto';
import { UpdatePublisherBookDto } from './dto/update-publisher-book.dto';

const bookInclude = {
  prices: { orderBy: { effectiveFrom: 'desc' as const }, take: 1 },
  files: { orderBy: { createdAt: 'desc' as const } },
  categories: { include: { category: true } },
  languages: { include: { language: true } },
};

@Injectable()
export class PublisherBooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisherService: PublisherService,
    private readonly storage: StorageService,
  ) {}

  async listBooks(userId: string, page = 1, pageSize = 20) {
    const publisher = await this.publisherService.requirePublisher(userId);
    const skip = (page - 1) * pageSize;

    const where = { publisherId: publisher.id };

    const [books, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: bookInclude,
      }),
      this.prisma.book.count({ where }),
    ]);

    return {
      data: books.map((book) => this.toPublisherBook(book)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getBook(userId: string, bookId: string) {
    const publisher = await this.publisherService.requirePublisher(userId);
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, publisherId: publisher.id },
      include: bookInclude,
    });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    return this.toPublisherBook(book);
  }

  async createBook(userId: string, dto: CreatePublisherBookDto) {
    const publisher = await this.publisherService.requirePublisher(userId);
    const slug = await this.generateUniqueSlug(dto.title);

    const book = await this.prisma.$transaction(async (tx) => {
      const created = await tx.book.create({
        data: {
          publisherId: publisher.id,
          title: dto.title,
          subtitle: dto.subtitle,
          slug,
          description: dto.description,
          isbn: dto.isbn,
          authorName: dto.authorName,
          format: dto.format,
          previewPageCount: dto.previewPageCount ?? 0,
          status: BookStatus.draft,
        },
      });

      await tx.bookPrice.create({
        data: {
          bookId: created.id,
          purchasePrice: dto.prices.purchase,
          rental15Price: dto.prices.rental15,
          rental30Price: dto.prices.rental30,
          currency: 'INR',
        },
      });

      await tx.bookCategory.createMany({
        data: dto.categoryIds.map((categoryId) => ({
          bookId: created.id,
          categoryId,
        })),
      });

      await tx.bookLanguage.createMany({
        data: dto.languageIds.map((languageId) => ({
          bookId: created.id,
          languageId,
        })),
      });

      return tx.book.findUniqueOrThrow({
        where: { id: created.id },
        include: bookInclude,
      });
    });

    return this.toPublisherBook(book);
  }

  async updateBook(userId: string, bookId: string, dto: UpdatePublisherBookDto) {
    const publisher = await this.publisherService.requirePublisher(userId);
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, publisherId: publisher.id },
    });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    this.assertBookEditable(book.status);

    const hasUpdates =
      dto.title !== undefined ||
      dto.subtitle !== undefined ||
      dto.description !== undefined ||
      dto.authorName !== undefined ||
      dto.isbn !== undefined ||
      dto.format !== undefined ||
      dto.previewPageCount !== undefined ||
      dto.prices !== undefined ||
      dto.categoryIds !== undefined ||
      dto.languageIds !== undefined;

    if (!hasUpdates) {
      throw new BadRequestException({
        code: 'NO_UPDATES',
        message: 'No fields to update',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.book.update({
        where: { id: book.id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.subtitle !== undefined && { subtitle: dto.subtitle }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.authorName !== undefined && { authorName: dto.authorName }),
          ...(dto.isbn !== undefined && { isbn: dto.isbn }),
          ...(dto.format !== undefined && { format: dto.format }),
          ...(dto.previewPageCount !== undefined && { previewPageCount: dto.previewPageCount }),
          ...this.reReviewDataIfApproved(book.status),
        },
      });

      if (dto.prices) {
        await tx.bookPrice.create({
          data: {
            bookId: book.id,
            purchasePrice: dto.prices.purchase,
            rental15Price: dto.prices.rental15,
            rental30Price: dto.prices.rental30,
            currency: 'INR',
          },
        });
      }

      if (dto.categoryIds) {
        await tx.bookCategory.deleteMany({ where: { bookId: book.id } });
        await tx.bookCategory.createMany({
          data: dto.categoryIds.map((categoryId) => ({
            bookId: book.id,
            categoryId,
          })),
        });
      }

      if (dto.languageIds) {
        await tx.bookLanguage.deleteMany({ where: { bookId: book.id } });
        await tx.bookLanguage.createMany({
          data: dto.languageIds.map((languageId) => ({
            bookId: book.id,
            languageId,
          })),
        });
      }

      return tx.book.findUniqueOrThrow({
        where: { id: book.id },
        include: bookInclude,
      });
    });

    return this.toPublisherBook(updated);
  }

  async uploadFile(
    userId: string,
    bookId: string,
    file: Express.Multer.File,
    format: BookFileFormat,
  ) {
    const publisher = await this.publisherService.requirePublisher(userId);
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, publisherId: publisher.id },
      include: { files: true },
    });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    this.assertBookEditable(book.status);

    this.validateFile(file, format);

    const extension = format === BookFileFormat.epub ? '.epub' : '.pdf';
    const key = `books/${publisher.id}/${book.id}/${randomUUID()}${extension}`;
    const contentType = format === BookFileFormat.epub ? 'application/epub+zip' : 'application/pdf';

    const stored = await this.storage.putObject(key, file.buffer, contentType);

    const existing = book.files.find((f) => f.format === format);
    if (existing) {
      await this.prisma.bookFile.delete({ where: { id: existing.id } });
    }

    const bookFile = await this.prisma.bookFile.create({
      data: {
        bookId: book.id,
        format,
        s3KeyOriginal: stored.key,
        fileSizeBytes: BigInt(stored.sizeBytes),
        checksumSha256: stored.checksumSha256,
        processingStatus: ProcessingStatus.ready,
      },
    });

    const derivedFormat = this.deriveBookFormat(
      book.format,
      book.files.filter((f) => f.format !== format),
      format,
    );
    if (derivedFormat !== book.format) {
      await this.prisma.book.update({
        where: { id: book.id },
        data: {
          format: derivedFormat,
          ...this.reReviewDataIfApproved(book.status),
        },
      });
    } else if (book.status === BookStatus.approved) {
      await this.prisma.book.update({
        where: { id: book.id },
        data: this.reReviewDataIfApproved(book.status),
      });
    }

    return this.toBookFile(bookFile);
  }

  async uploadCover(userId: string, bookId: string, file: Express.Multer.File) {
    const publisher = await this.publisherService.requirePublisher(userId);
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, publisherId: publisher.id },
    });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    this.assertBookEditable(book.status);

    this.validateCoverFile(file);

    const ext = extname(file.originalname.toLowerCase()) || '.jpg';
    const key = `covers/${publisher.id}/${book.id}/${randomUUID()}${ext}`;
    const contentType = file.mimetype || this.guessImageContentType(ext);

    const stored = await this.storage.putPublicObject(key, file.buffer, contentType);
    if (!stored.publicUrl) {
      throw new BadRequestException({
        code: 'COVER_URL_UNAVAILABLE',
        message: 'Cover was stored but a public URL could not be generated',
      });
    }

    const updated = await this.prisma.book.update({
      where: { id: book.id },
      data: {
        coverImageUrl: stored.publicUrl,
        ...this.reReviewDataIfApproved(book.status),
      },
      include: bookInclude,
    });

    return this.toPublisherBook(updated);
  }

  async deleteBook(userId: string, bookId: string) {
    const publisher = await this.publisherService.requirePublisher(userId);
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, publisherId: publisher.id },
    });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    if (book.status !== BookStatus.draft && book.status !== BookStatus.rejected) {
      throw new BadRequestException({
        code: 'BOOK_NOT_DELETABLE',
        message: 'Only draft or rejected books can be deleted',
      });
    }

    await this.prisma.book.delete({ where: { id: book.id } });
    return { success: true };
  }

  async submitForReview(userId: string, bookId: string) {
    const publisher = await this.publisherService.requirePublisher(userId);
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, publisherId: publisher.id },
      include: { files: true, prices: true },
    });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    if (book.status !== BookStatus.draft && book.status !== BookStatus.rejected) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Only draft or rejected books can be submitted',
      });
    }

    if (book.files.length === 0) {
      throw new BadRequestException({
        code: 'FILES_REQUIRED',
        message: 'Upload at least one book file before submitting',
      });
    }

    if (book.prices.length === 0) {
      throw new BadRequestException({
        code: 'PRICES_REQUIRED',
        message: 'Book prices are required before submitting',
      });
    }

    this.assertFormatFilesMatch(book.format, book.files);

    const updated = await this.prisma.book.update({
      where: { id: book.id },
      data: {
        status: BookStatus.pending_review,
        rejectionReason: null,
      },
      include: bookInclude,
    });

    return this.toPublisherBook(updated);
  }

  private assertBookEditable(status: BookStatus) {
    if (
      status !== BookStatus.draft &&
      status !== BookStatus.rejected &&
      status !== BookStatus.approved
    ) {
      throw new ForbiddenException({
        code: 'BOOK_NOT_EDITABLE',
        message: 'This book cannot be edited while it is awaiting admin review',
      });
    }
  }

  private reReviewDataIfApproved(status: BookStatus) {
    if (status === BookStatus.approved) {
      return {
        status: BookStatus.pending_review,
        publishedAt: null,
      };
    }
    return {};
  }

  private validateFile(file: Express.Multer.File, format: BookFileFormat) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'File is required' });
    }

    const maxBytes = 150 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'File must be 150 MB or smaller',
      });
    }

    const name = file.originalname.toLowerCase();
    const ext = extname(name);
    if (format === BookFileFormat.epub && ext !== '.epub') {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'EPUB uploads must use a .epub file',
      });
    }
    if (format === BookFileFormat.pdf && ext !== '.pdf') {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'PDF uploads must use a .pdf file',
      });
    }
  }

  private validateCoverFile(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Cover image is required' });
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'Cover image must be 5 MB or smaller',
      });
    }

    const ext = extname(file.originalname.toLowerCase());
    const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp']);
    if (!allowed.has(ext)) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'Cover must be JPG, PNG, or WebP',
      });
    }
  }

  private guessImageContentType(ext: string) {
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    return 'image/jpeg';
  }

  private deriveBookFormat(
    current: BookFormat,
    existingFiles: { format: BookFileFormat }[],
    uploadedFormat: BookFileFormat,
  ): BookFormat {
    const formats = new Set(existingFiles.map((f) => f.format));
    formats.add(uploadedFormat);

    if (formats.has(BookFileFormat.epub) && formats.has(BookFileFormat.pdf)) {
      return BookFormat.both;
    }
    if (formats.has(BookFileFormat.epub)) return BookFormat.epub;
    if (formats.has(BookFileFormat.pdf)) return BookFormat.pdf;
    return current;
  }

  private assertFormatFilesMatch(
    format: BookFormat,
    files: { format: BookFileFormat }[],
  ) {
    const hasEpub = files.some((f) => f.format === BookFileFormat.epub);
    const hasPdf = files.some((f) => f.format === BookFileFormat.pdf);

    if (format === BookFormat.epub && !hasEpub) {
      throw new BadRequestException({
        code: 'EPUB_REQUIRED',
        message: 'This book requires an EPUB file',
      });
    }
    if (format === BookFormat.pdf && !hasPdf) {
      throw new BadRequestException({
        code: 'PDF_REQUIRED',
        message: 'This book requires a PDF file',
      });
    }
    if (format === BookFormat.both && (!hasEpub || !hasPdf)) {
      throw new BadRequestException({
        code: 'BOTH_FORMATS_REQUIRED',
        message: 'This book requires both EPUB and PDF files',
      });
    }
  }

  private async generateUniqueSlug(title: string) {
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);

    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = `${base}-${Math.random().toString(36).slice(2, 8)}`;
      const existing = await this.prisma.book.findUnique({ where: { slug } });
      if (!existing) return slug;
    }

    return `${base}-${randomUUID().slice(0, 8)}`;
  }

  private toPublisherBook(book: {
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
      files: book.files.map((file) => this.toBookFile(file)),
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

  private toBookFile(file: {
    id: string;
    format: BookFileFormat;
    processingStatus: ProcessingStatus;
    fileSizeBytes: bigint | null;
    createdAt: Date;
  }) {
    return {
      id: file.id,
      format: file.format,
      processingStatus: file.processingStatus,
      fileSizeBytes: file.fileSizeBytes ? Number(file.fileSizeBytes) : null,
      createdAt: file.createdAt.toISOString(),
    };
  }
}
