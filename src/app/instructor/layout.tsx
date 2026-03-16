'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Eye, History, Settings, LogOut, AlertCircle } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/instructor/configure-exam', label: 'Empezar monitoreo', icon: Eye },
  { href: '/instructor/live-monitor',   label: 'Monitor en vivo',   icon: History },
  { href: '/instructor/historic',       label: 'Histórico',         icon: History },
];

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const handleSignOut = async () => {
    const { signOut } = await import('@/lib/azure-auth');
    await signOut();
    router.push('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10" style={{ backgroundColor: '#1A1D47' }}>
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">

          {/* Left: logo + wordmark */}
          <div className="flex items-center gap-3">
            <Image src="/UGM.png" alt="UGM" width={32} height={32} className="object-contain" style={{ width: 32, height: 'auto' }} />
            <div className="h-5 w-px bg-white/20" />
            <span className="text-lg font-bold tracking-tight select-none">
              <span className="text-[#00D4FF]">Procto</span>
              <span className="text-white">Team</span>
            </span>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 rounded-full h-9 w-9"
              aria-label="Configuración"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleSignOut}
              variant="ghost"
              className="text-white hover:bg-white/10 border border-white/20 rounded-full px-4 h-9 ml-1"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      {/* ── Sub-navbar ─────────────────────────────────────────────────── */}
      <nav className="sticky top-14 z-40 bg-white border-b border-gray-200">
        <div className="max-w-screen-2xl mx-auto px-6 h-12 flex items-center justify-between">

          {/* Navigation tabs */}
          <div className="flex items-center gap-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive =
                pathname === href ||
                (href === '/instructor' && pathname === '/instructor');
              return (
                <Link key={href} href={href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'rounded-full border h-8 gap-1.5 text-sm transition-colors',
                      isActive
                        ? 'bg-gray-100 border-gray-300 text-gray-900 font-medium'
                        : 'border-transparent text-gray-600 hover:bg-gray-100 hover:border-gray-200'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Help button */}
          <Link href="/instructor/help">
            <Button
              size="sm"
              className="rounded-full h-8 gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              ayuda
            </Button>
          </Link>
        </div>
      </nav>

      {/* ── Page content ───────────────────────────────────────────────── */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
