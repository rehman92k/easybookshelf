/** Public URLs for cross-app navigation (reader ↔ publisher). */
export function getPublisherUrl() {
  return process.env.NEXT_PUBLIC_PUBLISHER_URL ?? 'http://localhost:3001';
}

export function getPublisherLoginUrl(nextPath = '/') {
  const base = getPublisherUrl().replace(/\/$/, '');
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  return `${base}/login?next=${encodeURIComponent(next)}`;
}

export function getReaderUrl() {
  return process.env.NEXT_PUBLIC_READER_URL ?? 'http://localhost:3000';
}

export function getReaderLoginUrl(nextPath = '/') {
  const base = getReaderUrl().replace(/\/$/, '');
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  return `${base}/login?next=${encodeURIComponent(next)}`;
}
