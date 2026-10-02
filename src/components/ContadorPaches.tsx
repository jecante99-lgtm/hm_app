import { dinero } from '../lib/format';

export const PRECIO = 8; // todos los paches cuestan Q8
export const VARIANTES = [
  { clave: 'Pollo picante', icono: '🐔🌶️' },
  { clave: 'Pollo no picante', icono: '🐔' },
  { clave: 'Cerdo picante', icono: '🐷🌶️' },
  { clave: 'Cerdo no picante', icono: '🐷' },
];

/** Cuadro con número grande y botones − / + */
export function Contador({ icono, nombre, n, precio = PRECIO, bloqueado, nota, onCambio }: {
  icono?: string; nombre: string; n: number; precio?: number; bloqueado?: boolean; nota?: string; onCambio: (d: number) => void;
}) {
  return (
    <div className={`rounded-2xl bg-white p-2 space-y-2 shadow-sm border-2 ${bloqueado ? 'border-slate-200 opacity-60' : n > 0 ? 'border-marca' : 'border-slate-200'}`}>
      <div className="text-center leading-tight">
        {icono && <div className="text-2xl">{icono}</div>}
        <div className="font-extrabold">{nombre}</div>
        {nota && <div className="text-sm text-slate-600">{nota}</div>}
      </div>
      <div className="text-5xl font-extrabold text-center">{n}</div>
      <div className="grid grid-cols-2 gap-2">
        <button disabled={bloqueado} aria-label="Quitar uno" onClick={() => onCambio(-1)} className="h-14 rounded-xl bg-slate-200 text-4xl font-extrabold active:bg-slate-300 disabled:opacity-50">−</button>
        <button disabled={bloqueado} aria-label="Agregar uno" onClick={() => onCambio(1)} className="h-14 rounded-xl bg-marca text-white text-4xl font-extrabold active:bg-marca-osc disabled:opacity-50">+</button>
      </div>
      <div className="text-center text-slate-600 font-bold">{dinero(n * precio)}</div>
    </div>
  );
}
