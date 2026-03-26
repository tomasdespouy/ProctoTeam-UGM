'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { LogOut, Home, Eye, History } from 'lucide-react';

// ─── Navigation items ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/instructor',              label: 'Inicio',          icon: Home    },
  { href: '/instructor/live-monitor', label: 'Monitor en Vivo', icon: Eye     },
  { href: '/instructor/historic',     label: 'Histórico',       icon: History },
];

// ─── Header ───────────────────────────────────────────────────────────────────

export default function InstructorHeader() {
  const pathname        = usePathname();
  const router          = useRouter();
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
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center px-6 select-none"
      style={{ background: '#161f45', height: 73, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* ── Branding (left) ─────────────────────────────────────────────── */}
      <div className="flex items-center flex-shrink-0">
        {/* UGM logo — "Logo lineas.png" spans ~120px wide */}
        <Image
          src="/Logo lineas.png"
          alt="Universidad Gabriela Mistral"
          width={120}
          height={32}
          className="object-contain flex-shrink-0"
          priority
          style={{ height: '32px', width: 'auto' }}
        />

        {/* Vertical separator */}
        <div
          className="flex-shrink-0 mx-5"
          style={{ width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)' }}
        />

        {/* ProctoTeam wordmark */}
        <span className="font-black text-2xl tracking-tight leading-none flex-shrink-0">
          <span style={{ color: '#00bbff' }}>Procto</span>
          <span className="text-white">Team</span>
        </span>
      </div>

      {/* ── Nav links (center) ──────────────────────────────────────────── */}
      <nav className="flex-1 flex items-center justify-center gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/instructor'
              ? pathname === '/instructor'
              : pathname.startsWith(href);

          return (
            <Link key={href} href={href}>
              <span
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
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

      {/* ── User area (right) ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* User initials avatar — white circle */}
        <div
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-sm font-bold flex-shrink-0 cursor-default"
          style={{ color: '#161f45' }}
          title={userProfile?.nombre ?? 'Instructor'}
        >
          {initials}
        </div>

        {/* Salir button — pill shape, navy-blue fill */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-5 h-10 rounded-full text-white text-sm font-bold transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#394281' }}
        >
          <LogOut className="h-4 w-4" />
          Salir
        </button>
      </div>
    </header>
  );
}
