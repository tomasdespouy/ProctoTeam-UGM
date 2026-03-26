'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { LogOut, LayoutDashboard, Users, ShieldAlert } from 'lucide-react';

// ─── Navigation items ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/super-admin/dashboard',    label: 'Dashboard Global',  icon: LayoutDashboard },
  { href: '/super-admin/instructors',  label: 'Gestión Docentes',  icon: Users           },
  { href: '/super-admin/alerts',       label: 'Auditoría IA',      icon: ShieldAlert     },
];

// ─── Header ───────────────────────────────────────────────────────────────────

export default function SuperAdminHeader() {
  const pathname       = usePathname();
  const router         = useRouter();
  const { setDevUser } = useAuth();

  const handleSignOut = async () => {
    if (process.env.NODE_ENV === 'development') {
      setDevUser(null);
    } else {
      const { signOut } = await import('@/lib/azure-auth');
      await signOut();
    }
    router.push('/');
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center px-6 select-none"
      style={{ background: '#0e1630', height: 73, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* ── Branding (left) ─────────────────────────────────────────────── */}
      <div className="flex items-center flex-shrink-0 gap-4">
        <Image
          src="/Logo lineas.png"
          alt="Universidad Gabriela Mistral"
          width={120}
          height={32}
          className="object-contain flex-shrink-0"
          priority
          style={{ height: '32px', width: 'auto' }}
        />

        <div
          className="flex-shrink-0"
          style={{ width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.20)' }}
        />

        <div className="flex flex-col leading-none">
          <span className="font-black text-xl tracking-tight">
            <span style={{ color: '#00bbff' }}>Procto</span>
            <span className="text-white">Team</span>
          </span>
          <span
            className="text-[10px] font-bold tracking-widest uppercase mt-0.5"
            style={{ color: '#f59e0b' }}
          >
            Torre de Control
          </span>
        </div>
      </div>

      {/* ── Nav links (center) ──────────────────────────────────────────── */}
      <nav className="flex-1 flex items-center justify-center gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
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

      {/* ── Sign out (right) ────────────────────────────────────────────── */}
      <button
        onClick={handleSignOut}
        className="flex items-center gap-2 px-5 h-10 rounded-full text-white text-sm font-bold transition-opacity hover:opacity-80 flex-shrink-0"
        style={{ backgroundColor: '#2d3a6e' }}
      >
        <LogOut className="h-4 w-4" />
        Salir
      </button>
    </header>
  );
}
