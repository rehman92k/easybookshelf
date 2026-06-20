interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = 'Loading…' }: PageLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-stone-500">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-amber-600 border-t-transparent"
        role="status"
        aria-label="Loading"
      />
      <p className="text-sm">{message}</p>
    </div>
  );
}
