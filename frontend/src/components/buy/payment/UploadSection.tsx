'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface UploadSectionProps {
  tradeId: string;
  error?: string;
  onFileUpload: (file: File) => void;
}

export function UploadSection({ tradeId, error, onFileUpload }: UploadSectionProps) {
  return (
    <>
      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mb-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {error}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-2 pt-2">
        <label htmlFor={`pdf-upload-${tradeId}`} className="text-sm font-medium">
          Upload Alipay Payment PDF
        </label>
        <input
          id={`pdf-upload-${tradeId}`}
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onFileUpload(file);
            }
          }}
          className="block w-full text-sm text-muted-foreground
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-primary file:text-primary-foreground
            hover:file:bg-primary/90
            cursor-pointer"
        />
        <p className="text-xs text-muted-foreground">
          Upload the PDF of your Alipay payment receipt. Maximum file size: 10MB
        </p>
      </div>
    </>
  );
}

