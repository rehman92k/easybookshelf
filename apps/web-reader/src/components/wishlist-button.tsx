'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@easybookshelf/ui';
import { useAuth } from '@/components/auth-provider';
import {
  addToWishlist,
  checkWishlist,
  removeFromWishlist,
} from '@/lib/wishlist';

interface WishlistButtonProps {
  bookSlug: string;
  className?: string;
}

export function WishlistButton({ bookSlug, className }: WishlistButtonProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setSaved(false);
      setReady(true);
      return;
    }
    void checkWishlist(bookSlug)
      .then(setSaved)
      .catch(() => setSaved(false))
      .finally(() => setReady(true));
  }, [authLoading, user, bookSlug]);

  async function toggle() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/books/${bookSlug}`)}`);
      return;
    }

    setBusy(true);
    try {
      if (saved) {
        await removeFromWishlist(bookSlug);
        setSaved(false);
      } else {
        await addToWishlist(bookSlug);
        setSaved(true);
      }
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={!ready || busy}
      onClick={() => void toggle()}
      className={className}
      title={saved ? 'Remove from wishlist' : 'Save to wishlist'}
    >
      {saved ? '♥ Saved' : '♡ Wishlist'}
    </Button>
  );
}
