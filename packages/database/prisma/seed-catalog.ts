import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding catalog data (languages, categories, platform config)...');

  const configs = [
    { key: 'default_commission_rate', value: 0.1 },
    { key: 'purchase_commission_rate', value: 0.15 },
    { key: 'rental_commission_rate', value: 0.1 },
    { key: 'subscriber_purchase_discount_rate', value: 0.1 },
    { key: 'default_currency', value: 'INR' },
    { key: 'min_book_price', value: 9 },
    { key: 'max_book_price', value: 9999 },
    { key: 'min_rental_price', value: 9 },
    { key: 'max_rental_price', value: 999 },
  ];

  for (const config of configs) {
    await prisma.platformConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: { key: config.key, value: config.value },
    });
  }

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

  console.log('Catalog seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
