import DatabaseViewer from '@/components/debug/DatabaseViewer';
import AdminPanel from '@/components/debug/AdminPanel';

export default function DebugPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <AdminPanel />
      <div className="mt-8">
        <DatabaseViewer />
      </div>
    </div>
  );
}

