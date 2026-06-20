import type { PdfPageBounds } from '@/lib/pdf-canvas-render';

type PDFDocumentProxy = Awaited<
  ReturnType<typeof import('pdfjs-dist')['getDocument']>['promise']
>;

export type CachedPageBitmap = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
};

const MAX_CACHE_ENTRIES = 12;
const cache = new Map<string, CachedPageBitmap>();
const cacheOrder: string[] = [];

function boundsKey(bounds: PdfPageBounds): string {
  const w = Math.round(bounds.maxWidth / 32) * 32;
  const h = Math.round(bounds.maxHeight / 32) * 32;
  return `${w}x${h}`;
}

function cacheKey(pageNum: number, bounds: PdfPageBounds): string {
  return `${pageNum}:${boundsKey(bounds)}`;
}

function remember(key: string, entry: CachedPageBitmap) {
  if (cache.has(key)) {
    const idx = cacheOrder.indexOf(key);
    if (idx >= 0) cacheOrder.splice(idx, 1);
  }
  cache.set(key, entry);
  cacheOrder.push(key);
  while (cacheOrder.length > MAX_CACHE_ENTRIES) {
    const oldest = cacheOrder.shift();
    if (!oldest) break;
    const removed = cache.get(oldest);
    removed?.bitmap.close();
    cache.delete(oldest);
  }
}

export function getCachedPage(pageNum: number, bounds: PdfPageBounds): CachedPageBitmap | null {
  return cache.get(cacheKey(pageNum, bounds)) ?? null;
}

export function blitCachedPage(canvas: HTMLCanvasElement, entry: CachedPageBitmap) {
  canvas.width = entry.width;
  canvas.height = entry.height;
  canvas.style.width = `${entry.width}px`;
  canvas.style.height = `${entry.height}px`;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, entry.width, entry.height);
  context.drawImage(entry.bitmap, 0, 0);
}

export async function cacheRenderedPage(
  pageNum: number,
  bounds: PdfPageBounds,
  source: HTMLCanvasElement,
): Promise<CachedPageBitmap> {
  const key = cacheKey(pageNum, bounds);
  const existing = cache.get(key);
  if (existing) return existing;

  const bitmap = await createImageBitmap(source);
  const entry = { bitmap, width: source.width, height: source.height };
  remember(key, entry);
  return entry;
}

export function clearPageCache() {
  for (const entry of cache.values()) {
    entry.bitmap.close();
  }
  cache.clear();
  cacheOrder.length = 0;
}

export async function preloadPdfPage(
  pdfDoc: PDFDocumentProxy,
  pageNum: number,
  bounds: PdfPageBounds,
  render: (
    doc: PDFDocumentProxy,
    page: number,
    pageBounds: PdfPageBounds,
    canvas: HTMLCanvasElement,
  ) => Promise<void>,
) {
  if (pageNum < 1 || getCachedPage(pageNum, bounds)) return;

  const offscreen = document.createElement('canvas');
  try {
    await render(pdfDoc, pageNum, bounds, offscreen);
    await cacheRenderedPage(pageNum, bounds, offscreen);
  } catch {
    // Preload is best-effort.
  }
}
