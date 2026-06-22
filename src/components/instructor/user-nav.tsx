'use client';

import { signOut } from '@/lib/azure-auth';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Monitor, History, KeyRound, HelpCircle, Home, ShieldCheck } from 'lucide-react';
import { useLoading } from '@/context/loading-context';

export function UserNav() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const { showLoader } = useLoading();

  const handleLogout = async () => {
    showLoader();
    await signOut();
    window.location.href = '/';
  };

  const handleNavigate = (path: string) => {
    showLoader();
    router.push(path);
  };

  if (!user) {
    return null;
  }
  
  const userRole = userProfile?.role;
  const displayName = userProfile?.nombre || user?.account?.name;
  const displayEmail = userProfile?.correo || user?.account?.username;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{displayName?.split(' ').map(n => n[0]).join('').substring(0, 2) ?? displayEmail?.[0].toUpperCase() ?? 'U'}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName ?? (userRole === 'instructor' ? 'Profesor' : userRole === 'super-admin' ? 'Admin' : 'Estudiante')}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.account?.username}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {userRole === 'instructor' && (
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => handleNavigate('/instructor')}>
              <Home className="mr-2 h-4 w-4" />
              <span>Inicio</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleNavigate('/instructor/live-monitor')}>
              <Monitor className="mr-2 h-4 w-4" />
              <span>Monitor en vivo</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleNavigate('/instructor/historic')}>
              <History className="mr-2 h-4 w-4" />
              <span>Histórico</span>
            </DropdownMenuItem>
             <DropdownMenuItem onSelect={() => handleNavigate('/instructor/help')}>
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Ayuda</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        )}

        {userRole === 'student' && (
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => handleNavigate('/student')}>
                <KeyRound className="mr-2 h-4 w-4" />
                <span>Unirse a Examen</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleNavigate('/student/historic')}>
                <History className="mr-2 h-4 w-4" />
                <span>Histórico</span>
              </DropdownMenuItem>
               <DropdownMenuItem onSelect={() => handleNavigate('/student/help')}>
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Ayuda</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
        )}
        
        {userRole === 'super-admin' && (
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => handleNavigate('/super-admin/dashboard')}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                <span>Panel de Auditoría</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
        )}


        <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              onSelect={handleLogout}
              className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
