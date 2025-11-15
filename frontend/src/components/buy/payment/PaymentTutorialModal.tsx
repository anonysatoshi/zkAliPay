'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  ChevronRight,
  ChevronLeft,
  X
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PaymentTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentNonce: string;
  alipayId: string;
  alipayName: string;
  amount: string;
}

export function PaymentTutorialModal({ 
  isOpen, 
  onClose, 
  paymentNonce, 
  alipayId, 
  alipayName, 
  amount 
}: PaymentTutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const t = useTranslations('buy.paymentInstructions.tutorial');

  const steps = [
    {
      title: t('step1.title'),
      description: t('step1.description'),
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-6">
            <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-4 text-lg flex items-center gap-2">
              <span className="text-2xl">📱</span>
              {t('step1.instructions')}
            </h4>
            <ol className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                <span className="pt-0.5">{t('step1.step1')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                <span className="pt-0.5">{t('step1.step2')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">3</span>
                <span className="pt-0.5">{t('step1.step3')}</span>
              </li>
            </ol>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-2xl p-5">
            <p className="text-sm text-yellow-900 dark:text-yellow-100 flex items-start gap-2">
              <span className="text-xl">⚠️</span>
              <span><strong>{t('step1.important')}</strong> {t('step1.importantNote')}</span>
            </p>
          </div>
        </div>
      )
    },
    {
      title: t('step2.title'),
      description: t('step2.description'),
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-300 dark:border-gray-700 rounded-2xl p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('step2.recipientId')}</label>
              <div className="font-mono font-bold text-2xl text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700">{alipayId}</div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('step2.recipientName')}</label>
              <div className="font-bold text-2xl text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700">{alipayName}</div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('step2.amountToTransfer')}</label>
              <div className="font-bold text-3xl text-green-600 dark:text-green-400 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-4 rounded-xl border-2 border-green-200 dark:border-green-800">¥{amount}</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 border-2 border-red-300 dark:border-red-700 rounded-2xl p-5">
            <p className="text-sm text-red-900 dark:text-red-100 flex items-start gap-2">
              <span className="text-xl">🔴</span>
              <span><strong>{t('step2.critical')}</strong> {t('step2.criticalNote')}</span>
            </p>
          </div>
        </div>
      )
    },
    {
      title: t('step3.title'),
      description: t('step3.description'),
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-red-100 via-orange-100 to-pink-100 dark:from-red-950/40 dark:via-orange-950/40 dark:to-pink-950/40 border-4 border-red-500 dark:border-red-600 rounded-2xl p-6">
            <h4 className="font-bold text-red-900 dark:text-red-100 text-xl mb-3 flex items-center gap-2">
              <span className="text-2xl">🚨</span>
              {t('step3.criticalStep')}
              <span className="text-2xl">🚨</span>
            </h4>
            <p className="text-sm text-red-800 dark:text-red-200 mb-4">
              {t('step3.mustAdd')}
            </p>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border-4 border-red-600 dark:border-red-500 shadow-lg">
              <label className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider block mb-2">{t('step3.paymentNote')}</label>
              <div className="font-mono font-bold text-4xl text-red-600 dark:text-red-400 tracking-wider text-center py-2">
                {paymentNonce}
              </div>
            </div>
          </div>

          {/* Screenshot showing where to add note */}
          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="text-lg">📸</span>
              {t('step3.exampleScreenshot')}
            </h5>
            <div className="border-4 border-gray-300 dark:border-gray-700 rounded-2xl overflow-hidden shadow-xl">
              <img 
                src="/tutorial/alipay-note.jpg" 
                alt="Alipay payment note example" 
                className="w-full h-auto"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 italic text-center">
              {t('step3.screenshotAlt')}
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-5">
            <p className="text-sm text-blue-900 dark:text-blue-100 flex items-start gap-2">
              <span className="text-xl">💡</span>
              <span><strong>{t('step3.tip')}</strong> {t('step3.tipNote')}</span>
            </p>
          </div>
        </div>
      )
    },
    {
      title: t('step4.title'),
      description: t('step4.description'),
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-2 border-green-300 dark:border-green-700 rounded-2xl p-6">
            <h4 className="font-bold text-green-900 dark:text-green-100 mb-4 text-lg flex items-center gap-2">
              <span className="text-2xl">✅</span>
              {t('step4.finalChecklist')}
            </h4>
            <ul className="space-y-3 text-sm text-green-800 dark:text-green-200">
              <li className="flex items-start gap-3 bg-white/60 dark:bg-gray-800/60 p-3 rounded-xl">
                <CheckCircle2 className="h-6 w-6 flex-shrink-0 mt-0.5 text-green-600" />
                <span>{t('step4.recipientId')} <strong className="font-mono">{alipayId}</strong></span>
              </li>
              <li className="flex items-start gap-3 bg-white/60 dark:bg-gray-800/60 p-3 rounded-xl">
                <CheckCircle2 className="h-6 w-6 flex-shrink-0 mt-0.5 text-green-600" />
                <span>{t('step4.amount')} <strong className="text-lg">¥{amount}</strong></span>
              </li>
              <li className="flex items-start gap-3 bg-white/60 dark:bg-gray-800/60 p-3 rounded-xl">
                <CheckCircle2 className="h-6 w-6 flex-shrink-0 mt-0.5 text-green-600" />
                <span>{t('step4.paymentNote')} <strong className="font-mono text-lg">{paymentNonce}</strong></span>
              </li>
            </ul>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-300 dark:border-gray-700 rounded-2xl p-6 space-y-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('step4.afterVerifying')}</p>
            <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                <span className="pt-0.5">{t('step4.step1')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                <span className="pt-0.5">{t('step4.step2')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-600 text-white flex items-center justify-center text-xs font-bold">3</span>
                <span className="pt-0.5">{t('step4.step3')}</span>
              </li>
            </ol>
          </div>
        </div>
      )
    },
    {
      title: t('step5.title'),
      description: t('step5.description'),
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-purple-100 via-blue-100 to-indigo-100 dark:from-purple-950/30 dark:via-blue-950/30 dark:to-indigo-950/30 border-2 border-purple-300 dark:border-purple-700 rounded-2xl p-6">
            <h4 className="font-bold text-purple-900 dark:text-purple-100 mb-3 text-lg flex items-center gap-2">
              <span className="text-2xl">📄</span>
              {t('step5.gettingReceipt')}
            </h4>
            <p className="text-sm text-purple-800 dark:text-purple-200">
              {t('step5.needReceipt')}
            </p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-300 dark:border-gray-700 rounded-2xl p-6">
            <h5 className="font-semibold mb-4 text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="text-lg">🔍</span>
              {t('step5.howToFind')}
            </h5>
            <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                <span className="pt-0.5">{t('step5.step1')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                <span className="pt-0.5">{t('step5.step2', { name: alipayName })}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">3</span>
                <span className="pt-0.5">{t('step5.step3')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">4</span>
                <span className="pt-0.5">{t('step5.step4')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">5</span>
                <span className="pt-0.5">{t('step5.step5')}</span>
              </li>
            </ol>
          </div>

          {/* Screenshot showing receipt portal */}
          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="text-lg">📸</span>
              {t('step5.receiptScreenshot')}
            </h5>
            <div className="border-4 border-gray-300 dark:border-gray-700 rounded-2xl overflow-hidden shadow-xl">
              <img 
                src="/tutorial/alipay-receipt.jpg" 
                alt="Alipay receipt download portal" 
                className="w-full h-auto"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 italic text-center">
              {t('step5.screenshotAlt')}
            </p>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-2xl p-5">
            <p className="text-sm text-yellow-900 dark:text-yellow-100 flex items-start gap-2">
              <span className="text-xl">⏱️</span>
              <span><strong>{t('step5.note')}</strong> {t('step5.noteText')}</span>
            </p>
          </div>
        </div>
      )
    },
    {
      title: t('step6.title'),
      description: t('step6.description'),
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-green-100 via-emerald-100 to-teal-100 dark:from-green-950/30 dark:via-emerald-950/30 dark:to-teal-950/30 border-2 border-green-400 dark:border-green-600 rounded-2xl p-6">
            <h4 className="font-bold text-green-900 dark:text-green-100 mb-3 text-xl flex items-center gap-2">
              <span className="text-3xl">🎉</span>
              {t('step6.almostDone')}
            </h4>
            <p className="text-sm text-green-800 dark:text-green-200">
              {t('step6.onceDownloaded')}
            </p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-300 dark:border-gray-700 rounded-2xl p-6">
            <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                <span className="pt-0.5">{t('step6.step1')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                <span className="pt-0.5">{t('step6.step2')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">3</span>
                <span className="pt-0.5">{t('step6.step3')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">4</span>
                <span className="pt-0.5">{t('step6.step4')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">5</span>
                <span className="pt-0.5">{t('step6.step5')}</span>
              </li>
            </ol>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 border-2 border-red-300 dark:border-red-700 rounded-2xl p-5">
            <p className="text-sm text-red-900 dark:text-red-100 flex items-start gap-2">
              <span className="text-xl">⏰</span>
              <span><strong>{t('step6.reminder')}</strong> {t('step6.reminderText')}</span>
            </p>
          </div>
        </div>
      )
    }
  ];

  const currentStepData = steps[currentStep];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-pink-950/30 p-8 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 transition-all shadow-sm hover:shadow-md"
          >
            <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
          
          <div className="space-y-3">
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400">
              {t('title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('stepOf', { current: currentStep + 1, total: steps.length })}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mt-6 flex items-center gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  index <= currentStep 
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600' 
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {currentStepData.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {currentStepData.description}
            </p>
          </div>
          <div className="mt-6">
            {currentStepData.content}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="h-12 px-6 border-2 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            {t('previous')}
          </Button>
          
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            {currentStep + 1} / {steps.length}
          </div>

          {currentStep < steps.length - 1 ? (
            <Button
              onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
              className="h-12 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg"
            >
              {t('next')}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={onClose}
              className="h-12 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t('gotIt')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

