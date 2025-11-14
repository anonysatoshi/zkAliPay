'use client';

import { useState } from 'react';
import { CreateOrderForm } from '@/components/orders/CreateOrderForm';
import { MyOrders } from '@/components/seller/MyOrders';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowRight, Plus, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SellPage() {
  const t = useTranslations('sell');
  const [activeView, setActiveView] = useState<'create' | 'manage'>('create');
  
  return (
    <div className="min-h-screen">
      {/* Hero Section - Apple Style */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-purple-950">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            {/* Main Headline */}
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400">
                {t('title')}
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8">
              {t('subtitle')}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                onClick={() => setActiveView('create')}
                className={activeView === 'create' 
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 rounded-full shadow-lg transition-all duration-300"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 px-8 py-6 rounded-full transition-all duration-300"
                }
              >
                <Plus className="mr-2 h-5 w-5" />
                {t('tabs.create')}
              </Button>
              <Button
                size="lg"
                onClick={() => setActiveView('manage')}
                className={activeView === 'manage'
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 rounded-full shadow-lg transition-all duration-300"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 px-8 py-6 rounded-full transition-all duration-300"
                }
              >
                <ListOrdered className="mr-2 h-5 w-5" />
                {t('tabs.manage')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {activeView === 'create' ? <CreateOrderForm onSwitchToManage={() => setActiveView('manage')} /> : <MyOrders />}
          </motion.div>
        </div>
      </section>
    </div>
  );
}

