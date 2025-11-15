/**
 * Utility functions for payment flow
 */

/**
 * Format seconds into MM:SS format
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format CNY amount from cents to yuan with 2 decimal places
 */
export const formatCnyAmount = (amountInCents: string): string => {
  return (parseFloat(amountInCents) / 100).toFixed(2);
};

