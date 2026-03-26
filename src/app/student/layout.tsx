'use client';

import StudentHeader from '@/components/student/StudentHeader';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <StudentHeader />
      <main className="pt-[73px] min-h-screen">
        {children}
      </main>
    </div>
  );
}
