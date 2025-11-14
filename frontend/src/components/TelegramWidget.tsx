'use client';

import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function TelegramWidget() {
  const t = useTranslations('telegram');

  return (
    <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-blue-200 dark:border-blue-800">
      <div className="flex items-start gap-4">
        {/* Telegram Icon */}
        <div className="flex-shrink-0 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
          <Send className="h-6 w-6 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2 dark:text-white">
            {t('title')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {t('description')}
          </p>

          {/* Join Button */}
          <Button
            onClick={() => window.open('https://t.me/zkAlipay', '_blank')}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Send className="mr-2 h-4 w-4" />
            {t('joinButton')}
          </Button>
        </div>
      </div>

      {/* Stats (optional) */}
      <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800 flex gap-6 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">{t('members')}:</span>
          <span className="ml-2 font-semibold dark:text-white">1,000+</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">{t('online')}:</span>
          <span className="ml-2 font-semibold text-green-600 dark:text-green-400">●</span>
        </div>
      </div>
    </Card>
  );
}

