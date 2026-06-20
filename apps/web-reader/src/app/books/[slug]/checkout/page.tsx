import { Suspense } from 'react';
import { CheckoutPageClient } from '@/components/checkout-page-client';

interface CheckoutPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={<p className="p-8 text-center text-stone-500">Loading checkout…</p>}>
      <CheckoutPageClient slug={slug} />
    </Suspense>
  );
}
