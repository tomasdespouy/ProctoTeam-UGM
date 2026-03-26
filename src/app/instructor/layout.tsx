'use client';

import InstructorHeader from '@/components/instructor/InstructorHeader';

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <InstructorHeader />
      {/* Push content below the fixed 73px header */}
      <main className="pt-[73px] min-h-screen">
        {children}
      </main>
    </div>
  );
}
