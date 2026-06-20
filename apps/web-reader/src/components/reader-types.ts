export type ReaderTheme = 'light' | 'sepia' | 'dark';

export const READER_THEMES: Record<
  ReaderTheme,
  { label: string; bg: string; text: string; chrome: string }
> = {
  light: { label: 'Light', bg: '#faf8f5', text: '#1c1917', chrome: '#ffffff' },
  sepia: { label: 'Sepia', bg: '#f4ecd8', text: '#44403c', chrome: '#ebe0c8' },
  dark: { label: 'Dark', bg: '#1c1917', text: '#fafaf9', chrome: '#292524' },
};
