'use client';

// Pasos del asistente de ingreso del estudiante (tarjeta central, uno a la vez).
export const WIZARD_STEPS = ['Requisitos', 'Identidad', 'Cámara', 'Pantalla'];

export function StepProgress({ current }: { current: number }) {
  return (
    <div className="flex flex-col items-center gap-2 mb-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#00A8CC]">
        Paso {current} de {WIZARD_STEPS.length}
      </p>
      <div className="flex items-center gap-1.5">
        {WIZARD_STEPS.map((_, i) => {
          const n = i + 1;
          return (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                n === current ? 'w-6 bg-[#00D4FF]'
                  : n < current ? 'w-2 bg-green-500'
                  : 'w-2 bg-slate-300'
              }`}
            />
          );
        })}
      </div>
      <p className="text-xs font-semibold text-slate-500">{WIZARD_STEPS[current - 1]}</p>
    </div>
  );
}
