'use client';

import { usePathname } from 'next/navigation';
import StudentHeader from '@/components/student/StudentHeader';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Hide StudentHeader on exam pages (they have their own ExamHeader)
  const isExamPage = pathname.includes('/exam/');

  return (
    <div className="min-h-screen bg-gray-50">
      {!isExamPage && <StudentHeader />}
      <main className={isExamPage ? 'min-h-screen' : 'pt-[73px] min-h-screen'}>
        {children}
      </main>
    </div>
  );
}
