'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';

const ENABLE_DEBUG = process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true';

export function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold">
            zkAliPay
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-4">
            <Link href="/buy">
              <Button variant={isActive('/buy') || pathname?.startsWith('/buy/') ? 'default' : 'ghost'}>
                Buy Tokens
              </Button>
            </Link>
            <Link href="/sell">
              <Button variant={isActive('/sell') ? 'default' : 'ghost'}>
                Sell Tokens
              </Button>
            </Link>
            {ENABLE_DEBUG && (
              <Link href="/debug">
                <Button variant={isActive('/debug') ? 'default' : 'ghost'} size="sm">
                  Debug
                </Button>
              </Link>
            )}

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

