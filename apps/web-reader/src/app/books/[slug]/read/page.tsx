import { Suspense } from 'react';
import { BookReader } from '@/components/book-reader';

interface ReadPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ReadPage({ params }: ReadPageProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-stone-500">Loading reader…</div>}>
      <BookReader slug={slug} />
    </Suspense>
  );
}
