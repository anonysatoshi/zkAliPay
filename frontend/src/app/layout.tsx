import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navigation } from "@/components/Navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "zkAlipay - Buy Crypto with Alipay",
  description: "The world's first decentralized crypto exchange powered by zero-knowledge virtual machine",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
    apple: { url: '/icon.svg', sizes: '512x512', type: 'image/svg+xml' },
  },
  openGraph: {
    title: "zkAlipay - Buy Crypto with Alipay",
    description: "The world's first decentralized fiat gateway powered by zero-knowledge virtual machine",
    images: ['/og-image.svg'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "zkAlipay - Buy Crypto with Alipay",
    description: "The world's first decentralized fiat gateway powered by zero-knowledge virtual machine",
    images: ['/og-image.svg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <Navigation />
          {children}
        </Providers>
      </body>
    </html>
  );
}

