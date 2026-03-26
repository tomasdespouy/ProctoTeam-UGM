'use client';

import SuperAdminHeader from '@/components/super-admin/SuperAdminHeader';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <SuperAdminHeader />
      <main className="pt-[73px] min-h-screen">
        {children}
      </main>
    </div>
  );
}
