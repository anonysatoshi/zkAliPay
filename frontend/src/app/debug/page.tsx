'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DatabaseViewer from '@/components/debug/DatabaseViewer';
import AdminPanel from '@/components/debug/AdminPanel';

export default function DebugPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Only allow debug panel in development mode
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true';
    
    if (!isDevelopment) {
      // Redirect to home if not in development
      router.push('/');
      return;
    }

    setIsAuthorized(true);
  }, [router]);

  if (!isAuthorized) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-2">
            🚫 Debug Panel Disabled
          </h1>
          <p className="text-gray-300">
            This panel is only available in development mode.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Set NEXT_PUBLIC_ENABLE_DEBUG=true to enable
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4 mb-6">
        <p className="text-yellow-500 font-semibold">
          ⚠️ Development Mode - Debug panel is enabled
        </p>
        <p className="text-sm text-gray-400 mt-1">
          This panel will be automatically disabled in production
        </p>
      </div>
      
      <AdminPanel />
      <div className="mt-8">
        <DatabaseViewer />
      </div>
    </div>
  );
}
