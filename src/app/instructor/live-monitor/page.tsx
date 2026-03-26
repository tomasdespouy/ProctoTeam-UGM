'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ProctorView } from '@/components/proctoring/ProctorView';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Inner component (needs Suspense for useSearchParams) ─────────────────────

function LiveMonitorContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const examId       = searchParams.get('examId');

  if (!examId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2 text-gray-800">Sin examen seleccionado</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Inicia el monitoreo desde el Dashboard seleccionando un examen activo.
        </p>
        <Button onClick={() => router.push('/instructor')}>
          Volver al Dashboard
        </Button>
      </div>
    );
  }

  return (
    <ProctorView
      examId={examId}
      instructorId="instructor"
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LiveMonitorPage() {
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
