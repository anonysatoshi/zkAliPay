'use client';

import { useState, useEffect } from 'react';
import { 
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface PhaseProgressProps {
  phase: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  icon: any;
  estimatedTime?: string;
  details?: React.ReactNode;
}

export function PhaseProgress({ 
  phase, 
  title, 
  description, 
  status, 
  icon: Icon,
  estimatedTime,
  details
}: PhaseProgressProps) {
  const [isExpanded, setIsExpanded] = useState(status === 'in_progress');

  useEffect(() => {
    if (status === 'in_progress') {
      setIsExpanded(true);
    }
  }, [status]);

  // Apple-style colors with proper dark mode support
  const bgColor = 
    status === 'completed' ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20' :
    status === 'in_progress' ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20' :
    status === 'failed' ? 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20' :
    'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900';

  const borderColor = 
    status === 'completed' ? 'border-green-200 dark:border-green-800' :
    status === 'in_progress' ? 'border-blue-300 dark:border-blue-700' :
    status === 'failed' ? 'border-red-200 dark:border-red-800' :
    'border-gray-200 dark:border-gray-700';

  const iconColor = 
    status === 'completed' ? 'text-green-600 dark:text-green-400' :
    status === 'in_progress' ? 'text-blue-600 dark:text-blue-400' :
    status === 'failed' ? 'text-red-600 dark:text-red-400' :
    'text-gray-400 dark:text-gray-500';

  const textColor = 
    status === 'completed' ? 'text-green-900 dark:text-green-200' :
    status === 'in_progress' ? 'text-blue-900 dark:text-blue-200' :
    status === 'failed' ? 'text-red-900 dark:text-red-200' :
    'text-gray-600 dark:text-gray-400';

  const badgeBg = 
    status === 'completed' ? 'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100' :
    status === 'in_progress' ? 'bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100' :
    status === 'failed' ? 'bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100' :
    'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300';

  return (
    <div className={`border-2 ${borderColor} rounded-2xl overflow-hidden transition-all duration-300 ${bgColor} shadow-sm hover:shadow-md`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Phase Number Badge - Larger and more prominent */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base ${badgeBg} shadow-sm`}>
            {status === 'completed' ? '✓' : phase}
          </div>

          {/* Icon */}
          {status === 'in_progress' ? (
            <Loader2 className={`h-6 w-6 animate-spin ${iconColor}`} />
          ) : status === 'completed' ? (
            <CheckCircle2 className={`h-6 w-6 ${iconColor}`} />
          ) : (
            <Icon className={`h-6 w-6 ${iconColor}`} />
          )}

          {/* Title & Description */}
          <div className="text-left">
            <div className={`font-bold text-base ${textColor}`}>{title}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{description}</div>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {estimatedTime && status === 'in_progress' && (
            <span className="text-xs font-bold bg-white/70 dark:bg-gray-800/70 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              ~{estimatedTime}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && details && (
        <div className="px-6 pb-5 border-t border-gray-200 dark:border-gray-700">
          <div className="pt-4 text-sm">{details}</div>
        </div>
      )}
    </div>
  );
}

