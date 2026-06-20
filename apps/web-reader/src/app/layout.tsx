import { AuthProvider } from '@/components/auth-provider';
import { AdSenseScript } from '@/components/adsense-script';
import type { Metadata } from 'next';
import { Literata, Geist_Mono } from 'next/font/google';
import './globals.css';

const literata = Literata({
  variable: '--font-literata',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'EasyBookshelf — Read Digital Books',
  description: 'Discover, purchase, and read digital books online.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${literata.variable} ${geistMono.variable} font-sans antialiased`}>
        <AdSenseScript />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
