export type PageViewMode = 'single' | 'spread';

export function getSpreadLeftPage(page: number): number {
  if (page <= 1) return 1;
  return page % 2 === 0 ? page : page - 1;
}

export function getNextPage(page: number, maxPage: number, mode: PageViewMode): number | null {
  if (mode === 'single') {
    return page < maxPage ? page + 1 : null;
  }
  if (page <= 1) return maxPage >= 2 ? 2 : null;
  const next = page + 2;
  return next <= maxPage ? next : null;
}

export function getPrevPage(page: number, mode: PageViewMode): number | null {
  if (mode === 'single') {
    return page > 1 ? page - 1 : null;
  }
  if (page <= 1) return null;
  if (page <= 2) return 1;
  return page - 2;
}

export function getSpreadPages(page: number, maxPage: number): { left: number; right: number | null } {
  if (page <= 1) {
    return { left: 1, right: maxPage >= 2 ? null : null };
  }
  const left = page % 2 === 0 ? page : page - 1;
  const right = left + 1 <= maxPage ? left + 1 : null;
  return { left, right };
}

/** Page label for toolbar in spread mode (e.g. "2–3" or "1"). */
export function formatPageLabel(page: number, maxPage: number, mode: PageViewMode): string {
  if (mode === 'single') return String(page);
  if (page <= 1) return '1';
  const { left, right } = getSpreadPages(page, maxPage);
  return right ? `${left}–${right}` : String(left);
}
