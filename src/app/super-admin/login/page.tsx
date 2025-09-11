'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminLoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to instructor login page since super-admin now uses the same login
    router.push('/instructor/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg text-muted-foreground">Redirigiendo...</h2>
      </div>
    </div>
  );
}