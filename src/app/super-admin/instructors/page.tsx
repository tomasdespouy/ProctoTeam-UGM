'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Users, Search, Loader2, ChevronDown, GraduationCap, BookOpen, ShieldCheck, RefreshCw,
  UserPlus, Clock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id:            number;
  uid:           string;
  email:         string;
  nombre:        string;
  role:          'student' | 'instructor' | 'super-admin';
  created_at:    string;
  updated_at:    string;
  exams_created: number;
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRow['role'] }) {
  if (role === 'super-admin') return (
    <Badge className="gap-1 bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-100">
      <ShieldCheck className="h-3 w-3" /> Admin
    </Badge>
  );
  if (role === 'instructor') return (
    <Badge className="gap-1 bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-100">
      <BookOpen className="h-3 w-3" /> Docente
    </Badge>
  );
  return (
    <Badge className="gap-1 bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100">
      <GraduationCap className="h-3 w-3" /> Estudiante
    </Badge>
  );
}

// ─── Role change dropdown ─────────────────────────────────────────────────────

function RoleDropdown({
  user,
  onRoleChange,
  isUpdating,
}: {
  user:         UserRow;
  onRoleChange: (uid: string, role: UserRow['role']) => void;
  isUpdating:   boolean;
}) {
  const roles: { value: UserRow['role']; label: string; icon: React.ElementType }[] = [
    { value: 'student',     label: 'Estudiante', icon: GraduationCap },
    { value: 'instructor',  label: 'Docente',    icon: BookOpen      },
    { value: 'super-admin', label: 'Super Admin', icon: ShieldCheck   },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isUpdating}
          className="h-7 px-2.5 text-xs gap-1 border-slate-200"
        >
          {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
          Cambiar rol
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-slate-400">Asignar nuevo rol</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            disabled={user.role === value}
            onClick={() => onRoleChange(user.uid, value)}
            className="text-sm gap-2 cursor-pointer"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {user.role === value && <span className="ml-auto text-xs text-slate-400">actual</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InstructorsPage() {
  const { user, userProfile, loading } = useAuth();
  const router  = useRouter();
  const { toast } = useToast();

  const [users,       setUsers]       = useState<UserRow[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [searchTerm,  setSearchTerm]  = useState('');
  const [updating,    setUpdating]    = useState<string | null>(null);

  // Crear usuario (pre-aprovisionamiento)
  const [createOpen,   setCreateOpen]   = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [newNombre,    setNewNombre]    = useState('');
  const [newEmail,     setNewEmail]     = useState('');
  const [newRole,      setNewRole]      = useState<UserRow['role']>('student');

  // Auth guard
  useEffect(() => {
    if (!loading && userProfile && userProfile.role !== 'super-admin') router.push('/');
  }, [loading, userProfile, router]);

  const fetchUsers = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const res   = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { if (user) fetchUsers(); }, [user]);

  const handleRoleChange = async (uid: string, newRole: UserRow['role']) => {
    if (!user) return;
    setUpdating(uid);
    try {
      const token = await user.getIdToken();
      const res   = await fetch('/api/admin/users', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ uid, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al actualizar');

      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
      toast({ title: 'Rol actualizado', description: `${data.user.email} → ${newRole}` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setUpdating(null);
    }
  };

  const handleCreateUser = async () => {
    if (!user) return;
    const email = newEmail.trim().toLowerCase();
    if (!newNombre.trim() || !email.includes('@')) {
      toast({ variant: 'destructive', title: 'Datos incompletos', description: 'Ingresa un nombre y un email válido.' });
      return;
    }
    setCreating(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ email, nombre: newNombre.trim(), role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al crear el usuario');

      toast({
        title: 'Usuario creado',
        description: `${data.user.email} quedará pendiente hasta que inicie sesión con su cuenta Microsoft.`,
      });
      setCreateOpen(false);
      setNewNombre('');
      setNewEmail('');
      setNewRole('student');
      fetchUsers();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setCreating(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex h-[calc(100vh-73px)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#00d4ff]" />
      </div>
    );
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Counts for the summary row
  const counts = {
    student:     users.filter(u => u.role === 'student').length,
    instructor:  users.filter(u => u.role === 'instructor').length,
    superAdmin:  users.filter(u => u.role === 'super-admin').length,
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">

      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Super Admin</p>
          <h1 className="text-3xl font-black text-slate-800">Gestión de Usuarios</h1>
          <p className="text-slate-500 text-sm mt-1">
            Administra roles y permisos de todos los usuarios registrados en la plataforma.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            className="gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="gap-2 bg-[#161F45] hover:bg-[#161F45]/90 text-white"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Crear usuario
          </Button>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
          <GraduationCap className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">{counts.student}</span>
          <span className="text-xs text-slate-400">Estudiantes</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-blue-100 shadow-sm">
          <BookOpen className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-blue-700">{counts.instructor}</span>
          <span className="text-xs text-slate-400">Docentes</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-amber-100 shadow-sm">
          <ShieldCheck className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-amber-700">{counts.superAdmin}</span>
          <span className="text-xs text-slate-400">Admins</span>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              Directorio de Usuarios
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{filtered.length} usuario{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Buscar por nombre o email…"
              className="pl-9 text-sm bg-slate-50 border-slate-200"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Usuario</TableHead>
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide w-32">Rol</TableHead>
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide text-center w-28">Exámenes</TableHead>
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide text-right w-40">Registro</TableHead>
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide text-right w-40">Ult. actividad</TableHead>
              <TableHead className="w-36" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? (
              filtered.map(u => (
                <TableRow key={u.uid} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">

                  {/* User */}
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: '#161F45' }}
                      >
                        {u.nombre?.[0]?.toUpperCase() ?? u.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-slate-800 truncate">{u.nombre || '—'}</p>
                          {u.uid.startsWith('pending:') && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                              <Clock className="h-2.5 w-2.5" /> Pendiente
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Role */}
                  <TableCell className="py-3.5"><RoleBadge role={u.role} /></TableCell>

                  {/* Exams created */}
                  <TableCell className="py-3.5 text-center">
                    <span className="text-sm font-semibold text-slate-700">{u.exams_created ?? 0}</span>
                  </TableCell>

                  {/* Created at */}
                  <TableCell className="py-3.5 text-right text-xs text-slate-400">
                    {new Date(u.created_at).toLocaleDateString('es-CL')}
                  </TableCell>

                  {/* Updated at */}
                  <TableCell className="py-3.5 text-right text-xs text-slate-400">
                    {u.updated_at ? new Date(u.updated_at).toLocaleDateString('es-CL') : '—'}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="py-3.5 text-right">
                    <RoleDropdown
                      user={u}
                      onRoleChange={handleRoleChange}
                      isUpdating={updating === u.uid}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Users className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No se encontraron usuarios.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Crear usuario dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#161F45]" />
              Crear usuario
            </DialogTitle>
            <DialogDescription>
              Pre-registra a un docente o estudiante por su correo institucional. Quedará
              <span className="font-medium text-amber-600"> pendiente</span> hasta que inicie sesión
              una vez con su cuenta Microsoft; ahí se activa con el rol asignado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-nombre">Nombre completo</Label>
              <Input
                id="new-nombre"
                placeholder="Ej: María Pérez"
                value={newNombre}
                onChange={e => setNewNombre(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-email">Correo institucional</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="nombre@ugm.cl"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={newRole} onValueChange={v => setNewRole(v as UserRow['role'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Estudiante</SelectItem>
                  <SelectItem value="instructor">Docente</SelectItem>
                  <SelectItem value="super-admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={creating}
              className="gap-2 bg-[#161F45] hover:bg-[#161F45]/90 text-white"
            >
              {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando…</> : <><UserPlus className="h-4 w-4" /> Crear usuario</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
