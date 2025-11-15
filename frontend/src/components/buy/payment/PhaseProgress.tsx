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

  const bgColor = 
    status === 'completed' ? 'bg-green-50 border-green-200' :
    status === 'in_progress' ? 'bg-blue-50 border-blue-300' :
    status === 'failed' ? 'bg-red-50 border-red-200' :
    'bg-gray-50 border-gray-200';

  const iconColor = 
    status === 'completed' ? 'text-green-600' :
    status === 'in_progress' ? 'text-blue-600' :
    status === 'failed' ? 'text-red-600' :
    'text-gray-400';

  const textColor = 
    status === 'completed' ? 'text-green-800' :
    status === 'in_progress' ? 'text-blue-800' :
    status === 'failed' ? 'text-red-800' :
    'text-gray-500';

  return (
    <div className={`border-2 rounded-lg overflow-hidden transition-all ${bgColor}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Phase Number Badge */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
            status === 'completed' ? 'bg-green-200 text-green-800' :
            status === 'in_progress' ? 'bg-blue-200 text-blue-800' :
            status === 'failed' ? 'bg-red-200 text-red-800' :
            'bg-gray-200 text-gray-500'
          }`}>
            {status === 'completed' ? '✓' : phase}
          </div>

          {/* Icon */}
          {status === 'in_progress' ? (
            <Loader2 className={`h-5 w-5 animate-spin ${iconColor}`} />
          ) : status === 'completed' ? (
            <CheckCircle2 className={`h-5 w-5 ${iconColor}`} />
          ) : (
            <Icon className={`h-5 w-5 ${iconColor}`} />
          )}

          {/* Title & Description */}
          <div className="text-left">
            <div className={`font-semibold ${textColor}`}>{title}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          {estimatedTime && status === 'in_progress' && (
            <span className="text-xs font-semibold bg-white/60 px-2 py-1 rounded">
              ~{estimatedTime}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && details && (
        <div className="px-4 pb-4 border-t border-current/10">
          <div className="pt-3 text-sm">{details}</div>
        </div>
      )}
    </div>
  );
}

