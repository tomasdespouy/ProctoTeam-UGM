"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Legacy route — redirects to unified login at root
export default function StudentLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0D1240 0%, #1A1D6E 40%, #1E3A8A 100%)' }}
    >
      <Loader2 className="w-8 h-8 animate-spin text-[#00BBFF]" />
    </div>
  );
}
