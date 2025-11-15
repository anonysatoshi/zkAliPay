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
      title: "Enter Payment Details",
      description: "Enter the recipient's Alipay account and the payment amount.",
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-300 dark:border-gray-700 rounded-2xl p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Recipient Alipay ID</label>
              <div className="font-mono font-bold text-2xl text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700">{alipayId}</div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Recipient Name</label>
              <div className="font-bold text-2xl text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700">{alipayName}</div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount to Transfer</label>
              <div className="font-bold text-3xl text-green-600 dark:text-green-400 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-4 rounded-xl border-2 border-green-200 dark:border-green-800">¥{amount}</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 border-2 border-red-300 dark:border-red-700 rounded-2xl p-5">
            <p className="text-sm text-red-900 dark:text-red-100 flex items-start gap-2">
              <span className="text-xl">🔴</span>
              <span><strong>Critical:</strong> Double-check the recipient information matches exactly!</span>
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Add Payment Note (CRITICAL)",
      description: "This is the most important step! You MUST include the exact payment note.",
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-red-100 via-orange-100 to-pink-100 dark:from-red-950/40 dark:via-orange-950/40 dark:to-pink-950/40 border-4 border-red-500 dark:border-red-600 rounded-2xl p-6">
            <h4 className="font-bold text-red-900 dark:text-red-100 text-xl mb-3 flex items-center gap-2">
              <span className="text-2xl">🚨</span>
              CRITICAL STEP
              <span className="text-2xl">🚨</span>
            </h4>
            <p className="text-sm text-red-800 dark:text-red-200 mb-4">
              You MUST add this exact payment note. Without it, your payment cannot be verified!
            </p>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border-4 border-red-600 dark:border-red-500 shadow-lg">
              <label className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider block mb-2">Payment Note (留言/备注)</label>
              <div className="font-mono font-bold text-4xl text-red-600 dark:text-red-400 tracking-wider text-center py-2">
                {paymentNonce}
              </div>
            </div>
          </div>

          {/* Screenshot showing where to add note */}
          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="text-lg">📸</span>
              Example Screenshot
            </h5>
            <div className="border-4 border-gray-300 dark:border-gray-700 rounded-2xl overflow-hidden shadow-xl">
              <img 
                src="/tutorial/alipay-note.jpg" 
                alt="Alipay payment note example" 
                className="w-full h-auto"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 italic text-center">
              Screenshot shows where to add the payment note in the Alipay transfer screen
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-5">
            <p className="text-sm text-blue-900 dark:text-blue-100 flex items-start gap-2">
              <span className="text-xl">💡</span>
              <span><strong>Tip:</strong> Look for "留言" (message) or "备注" (note) field in your Alipay transfer screen and paste this exact number.</span>
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Complete the Transfer",
      description: "Review all details and complete the payment.",
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-2 border-green-300 dark:border-green-700 rounded-2xl p-6">
            <h4 className="font-bold text-green-900 dark:text-green-100 mb-4 text-lg flex items-center gap-2">
              <span className="text-2xl">✅</span>
              Final Checklist
            </h4>
            <ul className="space-y-3 text-sm text-green-800 dark:text-green-200">
              <li className="flex items-start gap-3 bg-white/60 dark:bg-gray-800/60 p-3 rounded-xl">
                <CheckCircle2 className="h-6 w-6 flex-shrink-0 mt-0.5 text-green-600" />
                <span>Recipient Alipay ID: <strong className="font-mono">{alipayId}</strong></span>
              </li>
              <li className="flex items-start gap-3 bg-white/60 dark:bg-gray-800/60 p-3 rounded-xl">
                <CheckCircle2 className="h-6 w-6 flex-shrink-0 mt-0.5 text-green-600" />
                <span>Amount: <strong className="text-lg">¥{amount}</strong></span>
              </li>
              <li className="flex items-start gap-3 bg-white/60 dark:bg-gray-800/60 p-3 rounded-xl">
                <CheckCircle2 className="h-6 w-6 flex-shrink-0 mt-0.5 text-green-600" />
                <span>Payment Note: <strong className="font-mono text-lg">{paymentNonce}</strong></span>
              </li>
            </ul>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-300 dark:border-gray-700 rounded-2xl p-6 space-y-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">After verifying all details:</p>
            <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                <span className="pt-0.5">Tap <strong>"Confirm Transfer"</strong> or <strong>"确认转账"</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                <span className="pt-0.5">Complete the payment authentication (password/fingerprint/face ID)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-600 text-white flex items-center justify-center text-xs font-bold">3</span>
                <span className="pt-0.5">Wait for the success confirmation</span>
              </li>
            </ol>
          </div>
        </div>
      )
    },
    {
      title: "Request Payment Receipt",
      description: "After payment, you need to download the official PDF receipt from Alipay.",
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-purple-100 via-blue-100 to-indigo-100 dark:from-purple-950/30 dark:via-blue-950/30 dark:to-indigo-950/30 border-2 border-purple-300 dark:border-purple-700 rounded-2xl p-6">
            <h4 className="font-bold text-purple-900 dark:text-purple-100 mb-3 text-lg flex items-center gap-2">
              <span className="text-2xl">📄</span>
              Getting Your Receipt
            </h4>
            <p className="text-sm text-purple-800 dark:text-purple-200">
              You need an official Alipay PDF receipt to complete the verification.
            </p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-300 dark:border-gray-700 rounded-2xl p-6">
            <h5 className="font-semibold mb-4 text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="text-lg">🔍</span>
              How to Find the Receipt Portal
            </h5>
            <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                <span className="pt-0.5">In Alipay, go to <strong>"Me" (我的)</strong> → <strong>"Bills" (账单)</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                <span className="pt-0.5">Find your recent transfer to <strong>{alipayName}</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">3</span>
                <span className="pt-0.5">Tap on the transaction to view details</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">4</span>
                <span className="pt-0.5">Look for <strong>"Electronic Receipt" (电子回单)</strong> or <strong>"Receipt" (回单)</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">5</span>
                <span className="pt-0.5">Tap it and select <strong>"Download PDF"</strong> or <strong>"Save"</strong></span>
              </li>
            </ol>
          </div>

          {/* Screenshot showing receipt portal */}
          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="text-lg">📸</span>
              Receipt Portal Screenshot
            </h5>
            <div className="border-4 border-gray-300 dark:border-gray-700 rounded-2xl overflow-hidden shadow-xl">
              <img 
                src="/tutorial/alipay-receipt.jpg" 
                alt="Alipay receipt download portal" 
                className="w-full h-auto"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 italic text-center">
              Screenshot shows where to request the electronic receipt (电子回单) in Alipay
            </p>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-2xl p-5">
            <p className="text-sm text-yellow-900 dark:text-yellow-100 flex items-start gap-2">
              <span className="text-xl">⏱️</span>
              <span><strong>Note:</strong> It may take a few minutes for Alipay to generate the PDF receipt. If it's not available immediately, wait 1-2 minutes and try again.</span>
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Upload Receipt",
      description: "Upload the PDF receipt to complete your trade.",
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-green-100 via-emerald-100 to-teal-100 dark:from-green-950/30 dark:via-emerald-950/30 dark:to-teal-950/30 border-2 border-green-400 dark:border-green-600 rounded-2xl p-6">
            <h4 className="font-bold text-green-900 dark:text-green-100 mb-3 text-xl flex items-center gap-2">
              <span className="text-3xl">🎉</span>
              Almost Done!
            </h4>
            <p className="text-sm text-green-800 dark:text-green-200">
              Once you have the PDF receipt downloaded to your device:
            </p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-300 dark:border-gray-700 rounded-2xl p-6">
            <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                <span className="pt-0.5">Close this tutorial</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                <span className="pt-0.5">Click the <strong>"Choose File"</strong> button below the payment details</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">3</span>
                <span className="pt-0.5">Select the Alipay PDF receipt you just downloaded</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">4</span>
                <span className="pt-0.5">Wait for the automated verification to complete</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">5</span>
                <span className="pt-0.5">If successful, your crypto will be released automatically! 🚀</span>
              </li>
            </ol>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 border-2 border-red-300 dark:border-red-700 rounded-2xl p-5">
            <p className="text-sm text-red-900 dark:text-red-100 flex items-start gap-2">
              <span className="text-xl">⏰</span>
              <span><strong>Reminder:</strong> Make sure to upload the receipt before the timer expires, or your trade will be cancelled!</span>
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

