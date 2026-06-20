import {
  blitCachedPage,
  cacheRenderedPage,
  getCachedPage,
} from '@/lib/pdf-page-cache';

type PDFDocumentProxy = Awaited<
  ReturnType<typeof import('pdfjs-dist')['getDocument']>['promise']
>;

type PdfRenderTask = {
  cancel: () => void;
  promise: Promise<void>;
};

const canvasRenderTasks = new WeakMap<HTMLCanvasElement, PdfRenderTask>();
const canvasQueues = new WeakMap<HTMLCanvasElement, Promise<void>>();

/** Keep renders fast on large pages / high-DPI screens. */
const MAX_PAGE_PIXELS = 1_200_000;

function isRenderCancelledError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'RenderingCancelledException' || /cancel/i.test(error.message);
}

async function cancelActiveRender(canvas: HTMLCanvasElement): Promise<void> {
  const active = canvasRenderTasks.get(canvas);
  if (!active) return;
  active.cancel();
  await active.promise.catch(() => undefined);
  canvasRenderTasks.delete(canvas);
}

function enqueueCanvasWork(canvas: HTMLCanvasElement, work: () => Promise<void>): Promise<void> {
  const tail = canvasQueues.get(canvas) ?? Promise.resolve();
  const next = tail.catch(() => undefined).then(async () => {
    await cancelActiveRender(canvas);
    await work();
  });
  canvasQueues.set(canvas, next);
  return next;
}

export type PdfPageBounds = {
  maxWidth: number;
  maxHeight: number;
};

function computeViewport(page: Awaited<ReturnType<PDFDocumentProxy['getPage']>>, bounds: PdfPageBounds) {
  const maxWidth = Math.max(120, bounds.maxWidth);
  const maxHeight = Math.max(120, bounds.maxHeight);
  const baseViewport = page.getViewport({ scale: 1 });
  let scale = Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height);

  const pixelCount = baseViewport.width * baseViewport.height * scale * scale;
  if (pixelCount > MAX_PAGE_PIXELS) {
    scale *= Math.sqrt(MAX_PAGE_PIXELS / pixelCount);
  }

  return page.getViewport({ scale });
}

async function paintPage(
  pdfDoc: PDFDocumentProxy,
  pageNum: number,
  bounds: PdfPageBounds,
  canvas: HTMLCanvasElement,
): Promise<void> {
  const cached = getCachedPage(pageNum, bounds);
  if (cached) {
    blitCachedPage(canvas, cached);
    return;
  }

  const page = await pdfDoc.getPage(pageNum);
  const viewport = computeViewport(page, bounds);
  const context = canvas.getContext('2d');
  if (!context) return;

  const outputWidth = Math.floor(viewport.width);
  const outputHeight = Math.floor(viewport.height);

  canvas.width = outputWidth;
  canvas.height = outputHeight;
  canvas.style.width = `${outputWidth}px`;
  canvas.style.height = `${outputHeight}px`;

  const task = page.render({
    canvasContext: context,
    viewport,
    canvas,
  });

  const tracked: PdfRenderTask = {
    cancel: () => task.cancel(),
    promise: task.promise.then(() => undefined),
  };
  canvasRenderTasks.set(canvas, tracked);

  try {
    await tracked.promise;
    await cacheRenderedPage(pageNum, bounds, canvas);
  } catch (error) {
    if (!isRenderCancelledError(error)) throw error;
  } finally {
    if (canvasRenderTasks.get(canvas) === tracked) {
      canvasRenderTasks.delete(canvas);
    }
  }
}

export async function renderPdfPageToCanvas(
  pdfDoc: PDFDocumentProxy,
  pageNum: number,
  bounds: PdfPageBounds,
  canvas: HTMLCanvasElement,
): Promise<void> {
  return enqueueCanvasWork(canvas, () => paintPage(pdfDoc, pageNum, bounds, canvas));
}

/** Fast path for preloading without tying up the visible canvas queue. */
export async function renderPdfPageOffscreen(
  pdfDoc: PDFDocumentProxy,
  pageNum: number,
  bounds: PdfPageBounds,
): Promise<void> {
  if (getCachedPage(pageNum, bounds)) return;
  const offscreen = document.createElement('canvas');
  await paintPage(pdfDoc, pageNum, bounds, offscreen);
}

function resetCanvasQueue(canvas: HTMLCanvasElement) {
  canvasQueues.set(canvas, Promise.resolve());
}

export async function releasePdfCanvas(...canvases: Array<HTMLCanvasElement | null | undefined>) {
  const active = canvases.filter((canvas): canvas is HTMLCanvasElement => Boolean(canvas));
  await Promise.all(active.map((canvas) => cancelActiveRender(canvas)));
  for (const canvas of active) {
    resetCanvasQueue(canvas);
  }
}
