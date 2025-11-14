'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Send, Github, Twitter } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  const t = useTranslations('footer');
  const locale = useLocale();
  
  const logoSrc = locale === 'zh-TW' ? '/logo-zh.svg' : '/logo.svg';

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Logo & Description */}
          <div className="md:col-span-2">
            <Image 
              src={logoSrc}
              alt="zkAlipay" 
              width={locale === 'zh-TW' ? 160 : 140}
              height={45}
              className="mb-4"
            />
            <p className="text-sm text-gray-400 mb-4 max-w-md">
              {t('description')}
            </p>
            <div className="flex gap-4">
              <a 
                href="https://github.com/anonysatoshi/zkAliPay" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Github className="h-5 w-5" />
              </a>
              <a 
                href="https://twitter.com/zkAlipay" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-white mb-4">{t('quickLinks')}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/buy" className="text-sm text-gray-400 hover:text-white transition-colors">
                  {t('buy')}
                </Link>
              </li>
              <li>
                <Link href="/sell" className="text-sm text-gray-400 hover:text-white transition-colors">
                  {t('sell')}
                </Link>
              </li>
              <li>
                <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
                  {t('about')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold text-white mb-4">{t('resources')}</h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://github.com/anonysatoshi/zkAliPay" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com/anonysatoshi/zkAliPay#readme" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {t('docs')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Telegram Join Section */}
        <div className="border-t border-gray-800 pt-8 mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Send className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">{t('telegram.title')}</h4>
                <p className="text-xs text-gray-400">{t('telegram.subtitle')}</p>
              </div>
            </div>
            <a
              href="https://t.me/zkAlipay"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Send className="h-4 w-4" />
              {t('telegram.join')}
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <div>
            © 2024 zkAlipay. {t('rights')}
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded text-xs font-semibold">
              ⚠️ {t('beta')}
            </span>
            <span className="text-gray-600">|</span>
            <span className="text-xs">Base Sepolia Testnet</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

