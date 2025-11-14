'use client';

import { useLocale } from './LocaleProvider';
import { Button } from './ui/button';
import { Globe } from 'lucide-react';

export function LanguageSelector() {
  const { locale, setLocale } = useLocale();

  const toggleLocale = () => {
    setLocale(locale === 'en' ? 'zh-TW' : 'en');
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLocale}
      className="flex items-center gap-2"
      title={locale === 'en' ? 'Switch to 繁體中文' : 'Switch to English'}
    >
      <Globe className="h-4 w-4" />
      <span className="text-sm font-medium">
        {locale === 'en' ? '繁中' : 'EN'}
      </span>
    </Button>
  );
}

