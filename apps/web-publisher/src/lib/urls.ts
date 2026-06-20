/** Public URLs for cross-app navigation (publisher ↔ reader). */
export function getReaderUrl() {
  return process.env.NEXT_PUBLIC_READER_URL ?? 'http://localhost:3000';
}

export function getReaderLoginUrl(nextPath = '/') {
  const base = getReaderUrl().replace(/\/$/, '');
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  return `${base}/login?next=${encodeURIComponent(next)}`;
}

export function getPublisherUrl() {
  return process.env.NEXT_PUBLIC_PUBLISHER_URL ?? 'http://localhost:3001';
}
