'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { ProctorView } from '@/components/proctoring/ProctorView';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Inner component (needs Suspense for useSearchParams) ─────────────────────

function LiveMonitorContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { userProfile } = useAuth();

  const examId = searchParams.get('examId');

  if (!examId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-4">
        <p className="text-slate-500 text-sm">No se especificó un examen.</p>
        <Button variant="outline" onClick={() => router.push('/super-admin/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver al Dashboard
        </Button>
      </div>
    );
  }

  if (userProfile && userProfile.role !== 'super-admin') {
    router.push('/');
    return null;
  }

  return (
    <ProctorView
      examId={examId}
      instructorId="super-admin-ghost"
      readOnly={true}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuperAdminLiveMonitorPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LiveMonitorContent />
    </Suspense>
  );
}
