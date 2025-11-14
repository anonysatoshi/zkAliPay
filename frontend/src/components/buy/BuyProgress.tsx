'use client';

import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type BuyStep = 'amount' | 'review' | 'execute' | 'payment' | 'settled';

interface BuyProgressProps {
  currentStep: BuyStep;
}

export function BuyProgress({ currentStep }: BuyProgressProps) {
  const t = useTranslations('buy.progress');
  
  const steps: { key: BuyStep; label: string }[] = [
    { key: 'amount', label: t('enterAmount') },
    { key: 'review', label: t('reviewMatch') },
    { key: 'execute', label: t('createTrades') },
    { key: 'payment', label: t('submitProof') },
    { key: 'settled', label: t('settled') },
  ];
  
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between relative">
        {/* Progress Line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted -z-10">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{
              width: `${(currentIndex / (steps.length - 1)) * 100}%`,
            }}
          />
        </div>

        {/* Steps */}
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div
              key={step.key}
              className="flex flex-col items-center gap-2 bg-background px-2"
            >
              {/* Circle */}
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                  ${
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isCurrent
                      ? 'bg-primary/10 border-primary text-primary animate-pulse'
                      : 'bg-muted border-muted-foreground/20 text-muted-foreground'
                  }
                `}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : isCurrent ? (
                  <Clock className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </div>

              {/* Label */}
              <span
                className={`
                  text-xs font-medium text-center whitespace-nowrap
                  ${
                    isCompleted || isCurrent
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }
                `}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

