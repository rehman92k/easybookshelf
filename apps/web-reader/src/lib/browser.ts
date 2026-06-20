/** True in Cursor/VS Code Simple Browser and similar embedded webviews. */
export function isEmbeddedIdeBrowser(): boolean {
  if (typeof window === 'undefined') return false;

  const ua = navigator.userAgent;
  if (ua.includes('Electron')) return true;
  if (window.location.protocol === 'vscode-webview:') return true;

  // Simple Browser often lacks a normal Chrome UA token.
  const isLikelyRealBrowser =
    ua.includes('Chrome/') || ua.includes('CriOS/') || ua.includes('Edg/');
  if (!isLikelyRealBrowser && ua.includes('Safari/')) return false;

  return !isLikelyRealBrowser;
}
