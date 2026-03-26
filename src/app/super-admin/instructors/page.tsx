'use client';

import { Users, Construction } from 'lucide-react';

export default function InstructorsPage() {
  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <div className="mb-8">
        <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Super Admin</p>
        <h1 className="text-3xl font-black text-slate-800">Gestión de Docentes</h1>
        <p className="text-slate-500 text-sm mt-1">
          Administra las cuentas de instructores y sus permisos en el sistema.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
          <Construction className="h-8 w-8 text-amber-400" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-slate-700">En construcción</h2>
          <p className="text-slate-400 text-sm mt-1 max-w-xs">
            La gestión de docentes estará disponible próximamente. 
            Los datos de instructores ya están en la base de datos.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2 px-4 py-2 bg-slate-50 rounded-xl">
          <Users className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-500">Módulo planificado — Sprint 3</span>
        </div>
      </div>
    </div>
  );
}
