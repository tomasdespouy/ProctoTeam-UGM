'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/context/auth-context';
import {
  Home,
  Eye,
  History,
  HelpCircle,
  LogOut,
} from 'lucide-react';

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/instructor',              label: 'Home',             icon: Home    },
  { href: '/instructor/live-monitor', label: 'Monitor en Vivo',  icon: Eye     },
  { href: '/instructor/historic',     label: 'Histórico',        icon: History },
  { href: '/instructor/help',         label: 'Ayuda',            icon: HelpCircle },
];

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { userProfile } = useAuth();

  const initials = userProfile?.nombre
    ? userProfile.nombre.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'IN';

  const handleSignOut = async () => {
    const { signOut } = await import('@/lib/azure-auth');
    await signOut();
    router.push('/');
  };

  return (
    <div className="flex min-h-screen">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className="fixed left-0 top-0 h-screen w-48 flex flex-col z-50 select-none"
        style={{ background: 'linear-gradient(180deg, #1A1D47 0%, #242F62 100%)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <Image
            src="/UGM.png"
            alt="UGM"
            width={28}
            height={28}
            className="object-contain flex-shrink-0"
          />
          <span className="text-base font-bold tracking-tight leading-none">
            <span style={{ color: '#00D4FF' }}>Procto</span>
            <span className="text-white">Team</span>
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === '/instructor'
                ? pathname === '/instructor'
                : pathname.startsWith(href);

            return (
              <Link key={href} href={href}>
                <span
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            Salir
          </button>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="ml-48 flex-1 flex flex-col min-h-screen bg-gray-50">

        {/* Top header */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 h-14 flex items-center justify-between px-6">
          <h1 className="text-base font-semibold text-gray-800">Portal del Docente</h1>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: '#242F62' }}
              title={userProfile?.nombre ?? 'Instructor'}
            >
              {initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
