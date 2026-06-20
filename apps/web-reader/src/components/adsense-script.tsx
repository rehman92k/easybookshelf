import Script from 'next/script';
import { getAdSenseClientId, isAdSenseConfigured } from '@/lib/ads';

export function AdSenseScript() {
  if (!isAdSenseConfigured()) return null;

  const clientId = getAdSenseClientId();

  return (
    <Script
      id="adsense-loader"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
