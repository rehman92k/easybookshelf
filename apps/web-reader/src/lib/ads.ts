export type AdPlacement =
  | 'home'
  | 'browse'
  | 'book_detail'
  | 'library'
  | 'search'
  | 'reader_interstitial';

const CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? '';
const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED !== 'false';

const SLOTS: Record<AdPlacement, string> = {
  home: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME ?? '',
  browse: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BROWSE ?? '',
  book_detail: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOOK_DETAIL ?? '',
  library: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LIBRARY ?? '',
  search: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SEARCH ?? '',
  reader_interstitial: process.env.NEXT_PUBLIC_ADSENSE_SLOT_READER_INTERSTITIAL ?? '',
};

/** Seconds before the first in-reader popup (non-subscribers). */
export function getReaderAdInitialDelayMs() {
  const seconds = Number(process.env.NEXT_PUBLIC_READER_AD_INITIAL_SECONDS ?? '90');
  return Math.max(30, seconds) * 1000;
}

/** Seconds between repeated in-reader popups. */
export function getReaderAdIntervalMs() {
  const seconds = Number(process.env.NEXT_PUBLIC_READER_AD_INTERVAL_SECONDS ?? '600');
  return Math.max(60, seconds) * 1000;
}

/** Seconds user must wait before dismissing the popup. */
export function getReaderAdDismissSeconds() {
  const seconds = Number(process.env.NEXT_PUBLIC_READER_AD_DISMISS_SECONDS ?? '5');
  return Math.max(3, Math.min(30, seconds));
}

export function isAdSenseConfigured() {
  return ADS_ENABLED && CLIENT_ID.startsWith('ca-pub-');
}

export function getAdSenseClientId() {
  return CLIENT_ID;
}

export function getAdSenseSlot(placement: AdPlacement) {
  return SLOTS[placement];
}

export function hasAdSenseSlot(placement: AdPlacement) {
  return isAdSenseConfigured() && Boolean(getAdSenseSlot(placement));
}
