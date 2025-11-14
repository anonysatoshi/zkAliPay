'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useTranslations } from 'next-intl';

const ENABLE_DEBUG = process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true';

export function Navigation() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold">
            zkAlipay
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-4">
            <Link href="/buy">
              <Button variant={isActive('/buy') || pathname?.startsWith('/buy/') ? 'default' : 'ghost'}>
                {t('buyTokens')}
              </Button>
            </Link>
            <Link href="/sell">
              <Button variant={isActive('/sell') ? 'default' : 'ghost'}>
                {t('sellTokens')}
              </Button>
            </Link>
            {ENABLE_DEBUG && (
              <Link href="/debug">
                <Button variant={isActive('/debug') ? 'default' : 'ghost'} size="sm">
                  {t('debug')}
                </Button>
              </Link>
            )}

            {/* Language Selector */}
            <LanguageSelector />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Wallet Connection */}
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
}

