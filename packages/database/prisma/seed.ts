import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Platform config defaults (v1.3)
  const configs = [
    {
      key: 'default_commission_rate',
      value: 0.1,
    },
    {
      key: 'purchase_commission_rate',
      value: 0.15,
    },
    {
      key: 'rental_commission_rate',
      value: 0.1,
    },
    {
      key: 'subscriber_purchase_discount_rate',
      value: 0.1,
    },
    {
      key: 'default_currency',
      value: 'INR',
    },
    {
      key: 'min_book_price',
      value: 9,
    },
    {
      key: 'max_book_price',
      value: 9999,
    },
    {
      key: 'min_rental_price',
      value: 9,
    },
    {
      key: 'max_rental_price',
      value: 999,
    },
  ];

  for (const config of configs) {
    await prisma.platformConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: { key: config.key, value: config.value },
    });
  }

  // Subscription plans (admin-configurable defaults)
  const existingPlans = await prisma.subscriptionPlan.count();
  if (existingPlans === 0) {
    await prisma.subscriptionPlan.createMany({
      data: [
        {
          name: 'Ad-Free Monthly',
          price: 30,
          currency: 'INR',
          interval: 'monthly',
          active: true,
        },
        {
          name: 'Ad-Free Yearly',
          price: 300,
          currency: 'INR',
          interval: 'yearly',
          active: true,
        },
      ],
    });
  }

  // Default languages
  const languages = [
    { code: 'en', name: 'English', nativeName: 'English', rtl: false },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', rtl: false },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', rtl: false },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', rtl: false },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', rtl: false },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी', rtl: false },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', rtl: true },
  ];

  for (const lang of languages) {
    await prisma.language.upsert({
      where: { code: lang.code },
      update: lang,
      create: lang,
    });
  }

  // Default categories
  const categories = [
    { name: 'Fiction', slug: 'fiction', sortOrder: 1 },
    { name: 'Non-Fiction', slug: 'non-fiction', sortOrder: 2 },
    { name: 'Academic', slug: 'academic', sortOrder: 3 },
    { name: 'Children', slug: 'children', sortOrder: 4 },
    { name: 'Self-Help', slug: 'self-help', sortOrder: 5 },
    { name: 'Biography', slug: 'biography', sortOrder: 6 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
  }

  // Demo publisher + sample books
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo-publisher@easybookshelf.local' },
    update: {},
    create: {
      email: 'demo-publisher@easybookshelf.local',
      displayName: 'EasyBookshelf Demo Publisher',
      status: 'active',
      roles: {
        create: [{ role: 'publisher', scopeType: 'global' }],
      },
    },
  });

  const demoPublisher = await prisma.publisher.upsert({
    where: { slug: 'easybookshelf-demo' },
    update: { status: 'approved' },
    create: {
      userId: demoUser.id,
      type: 'publisher',
      name: 'EasyBookshelf Demo Press',
      slug: 'easybookshelf-demo',
      description: 'Sample publisher for development and demos',
      status: 'approved',
    },
  });

  const categoryBySlug = Object.fromEntries(
    (await prisma.category.findMany()).map((c) => [c.slug, c.id]),
  );
  const languageByCode = Object.fromEntries(
    (await prisma.language.findMany()).map((l) => [l.code, l.id]),
  );

  const sampleBooks = [
    {
      slug: 'the-great-gatsby',
      title: 'The Great Gatsby',
      subtitle: null,
      authorName: 'F. Scott Fitzgerald',
      isbn: '9780743273565',
      description:
        'A portrait of the Jazz Age in all of its decadence and excess, Gatsby captured the spirit of the author\'s generation.',
      format: 'epub' as const,
      featured: true,
      categories: ['fiction'],
      languages: ['en'],
      prices: { purchase: 299, rental15: 49, rental30: 79 },
    },
    {
      slug: 'atomic-habits',
      title: 'Atomic Habits',
      subtitle: 'An Easy & Proven Way to Build Good Habits',
      authorName: 'James Clear',
      isbn: '9780735211292',
      description:
        'Tiny changes, remarkable results — a guide to breaking bad habits and building good ones.',
      format: 'both' as const,
      featured: true,
      categories: ['self-help', 'non-fiction'],
      languages: ['en'],
      prices: { purchase: 399, rental15: 59, rental30: 99 },
    },
    {
      slug: 'pride-and-prejudice',
      title: 'Pride and Prejudice',
      subtitle: null,
      authorName: 'Jane Austen',
      isbn: '9780141439518',
      description:
        'A romantic novel of manners that charts the emotional development of Elizabeth Bennet.',
      format: 'epub' as const,
      featured: false,
      categories: ['fiction'],
      languages: ['en'],
      prices: { purchase: 199, rental15: 39, rental30: 59 },
    },
    {
      slug: 'sapiens',
      title: 'Sapiens',
      subtitle: 'A Brief History of Humankind',
      authorName: 'Yuval Noah Harari',
      isbn: '9780062316097',
      description:
        'How Homo sapiens came to dominate the world — from the Stone Age to the twenty-first century.',
      format: 'pdf' as const,
      featured: true,
      categories: ['non-fiction'],
      languages: ['en'],
      prices: { purchase: 449, rental15: 69, rental30: 109 },
    },
    {
      slug: 'brief-history-of-time',
      title: 'A Brief History of Time',
      subtitle: null,
      authorName: 'Stephen Hawking',
      isbn: '9780553380163',
      description:
        'A landmark volume in science writing exploring cosmology, black holes, and the nature of time.',
      format: 'epub' as const,
      featured: false,
      categories: ['academic', 'non-fiction'],
      languages: ['en'],
      prices: { purchase: 349, rental15: 55, rental30: 89 },
    },
    {
      slug: 'malgudi-days',
      title: 'Malgudi Days',
      subtitle: null,
      authorName: 'R. K. Narayan',
      isbn: '9780143039655',
      description:
        'Timeless short stories set in the fictional South Indian town of Malgudi.',
      format: 'epub' as const,
      featured: false,
      categories: ['fiction'],
      languages: ['en', 'hi'],
      prices: { purchase: 249, rental15: 45, rental30: 69 },
    },
    {
      slug: 'wings-of-fire',
      title: 'Wings of Fire',
      subtitle: 'An Autobiography',
      authorName: 'A. P. J. Abdul Kalam',
      isbn: '9788173711468',
      description:
        'The inspiring journey of India\'s missile man from humble beginnings to the presidency.',
      format: 'both' as const,
      featured: true,
      categories: ['biography', 'non-fiction'],
      languages: ['en', 'hi'],
      prices: { purchase: 199, rental15: 35, rental30: 55 },
    },
    {
      slug: 'panchatantra',
      title: 'Panchatantra',
      subtitle: 'Classic Tales for Children',
      authorName: 'Vishnu Sharma',
      isbn: '9788129115300',
      description:
        'Ancient Indian collection of interrelated animal fables in Sanskrit verse and prose.',
      format: 'epub' as const,
      featured: false,
      categories: ['children'],
      languages: ['hi'],
      prices: { purchase: 149, rental15: 29, rental30: 45 },
    },
    {
      slug: 'godan',
      title: 'Godan',
      subtitle: null,
      authorName: 'Munshi Premchand',
      isbn: '9789353491542',
      description:
        'A masterpiece of Hindi literature portraying rural Indian life and social injustice.',
      format: 'epub' as const,
      featured: false,
      categories: ['fiction'],
      languages: ['hi'],
      prices: { purchase: 179, rental15: 32, rental30: 49 },
    },
    {
      slug: 'thinking-fast-and-slow',
      title: 'Thinking, Fast and Slow',
      subtitle: null,
      authorName: 'Daniel Kahneman',
      isbn: '9780374533557',
      description:
        'Nobel laureate Daniel Kahneman reveals the two systems that drive the way we think.',
      format: 'pdf' as const,
      featured: false,
      categories: ['self-help', 'non-fiction'],
      languages: ['en'],
      prices: { purchase: 499, rental15: 75, rental30: 119 },
    },
  ];

  for (const book of sampleBooks) {
    const coverImageUrl = book.isbn
      ? `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`
      : null;

    const existing = await prisma.book.findUnique({ where: { slug: book.slug } });

    const bookRecord = existing
      ? await prisma.book.update({
          where: { slug: book.slug },
          data: {
            title: book.title,
            subtitle: book.subtitle,
            authorName: book.authorName,
            isbn: book.isbn,
            description: book.description,
            coverImageUrl,
            format: book.format,
            featured: book.featured,
            status: 'approved',
            publishedAt: new Date('2024-01-01'),
          },
        })
      : await prisma.book.create({
          data: {
            publisherId: demoPublisher.id,
            title: book.title,
            subtitle: book.subtitle,
            slug: book.slug,
            authorName: book.authorName,
            isbn: book.isbn,
            description: book.description,
            coverImageUrl,
            format: book.format,
            featured: book.featured,
            status: 'approved',
            publishedAt: new Date('2024-01-01'),
            previewPageCount: 20,
          },
        });

    const priceCount = await prisma.bookPrice.count({ where: { bookId: bookRecord.id } });
    if (priceCount === 0) {
      await prisma.bookPrice.create({
        data: {
          bookId: bookRecord.id,
          purchasePrice: book.prices.purchase,
          rental15Price: book.prices.rental15,
          rental30Price: book.prices.rental30,
          currency: 'INR',
        },
      });
    }

    await prisma.bookCategory.deleteMany({ where: { bookId: bookRecord.id } });
    await prisma.bookCategory.createMany({
      data: book.categories.map((slug) => ({
        bookId: bookRecord.id,
        categoryId: categoryBySlug[slug],
      })),
      skipDuplicates: true,
    });

    await prisma.bookLanguage.deleteMany({ where: { bookId: bookRecord.id } });
    await prisma.bookLanguage.createMany({
      data: book.languages.map((code) => ({
        bookId: bookRecord.id,
        languageId: languageByCode[code],
      })),
      skipDuplicates: true,
    });
  }

  console.log(`Seeded ${sampleBooks.length} sample books.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
