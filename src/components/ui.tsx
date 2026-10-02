import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useEstadoRed, vaciarCola } from '../lib/offline';

export function Boton({ tono = 'marca', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { tono?: 'marca' | 'gris' | 'rojo' | 'verde' | 'borde' }) {
  const t = {
    marca: 'bg-marca text-white active:bg-marca-osc',
    verde: 'bg-green-600 text-white active:bg-green-700',
    rojo: 'bg-red-600 text-white active:bg-red-700',
    gris: 'bg-slate-200 text-slate-900 active:bg-slate-300',
    borde: 'bg-white text-marca border-2 border-marca',
  }[tono];
  return <button {...p} className={`min-h-14 px-5 rounded-2xl font-bold text-lg leading-tight disabled:opacity-50 ${t} ${className}`} />;
}

export function BotonLink({ to, children, tono = 'marca', className = '' }: { to: string; children: ReactNode; tono?: 'marca' | 'gris' | 'verde' | 'borde'; className?: string }) {
  const t = { marca: 'bg-marca text-white', gris: 'bg-slate-200 text-slate-900', verde: 'bg-green-600 text-white', borde: 'bg-white text-marca border-2 border-marca' }[tono];
  return <Link to={to} className={`min-h-14 px-5 rounded-2xl font-bold text-lg flex items-center justify-center text-center ${t} ${className}`}>{children}</Link>;
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  // Si quien la usa pone su propio fondo/borde, no mezclamos con los de por defecto
  // (dos clases de fondo a la vez: gana la que Tailwind genere al final, y salía blanco sobre blanco).
  const fondo = /(^|\s)bg-/.test(className) ? '' : 'bg-white';
  const borde = /(^|\s)border-/.test(className) ? (/border-\d/.test(className) ? '' : 'border') : 'border border-slate-200';
  return <div className={`rounded-2xl shadow-sm p-4 ${fondo} ${borde} ${className}`}>{children}</div>;
}

export function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <label className="block"><span className="block font-bold mb-1">{etiqueta}</span>{children}</label>;
}

const base = 'w-full min-h-14 px-4 rounded-xl border-2 border-slate-300 bg-white text-slate-900 focus:border-marca outline-none';
export const Entrada = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${base} ${p.className ?? ''}`} />;
export const Selector = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${base} ${p.className ?? ''}`} />;

export function Titulo({ children, atras }: { children: ReactNode; atras?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {atras && <Link to={atras} className="text-3xl px-2" aria-label="Volver">←</Link>}
      <h1 className="text-2xl font-extrabold">{children}</h1>
    </div>
  );
}

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'ok' | 'info'; children: ReactNode }) {
  const c = { error: 'bg-red-100 text-red-800', ok: 'bg-green-100 text-green-800', info: 'bg-amber-100 text-amber-900' }[tipo];
  return <div className={`rounded-xl p-3 font-semibold ${c}`}>{children}</div>;
}

export function Etiqueta({ estado }: { estado: string }) {
  const m: Record<string, string> = {
    pendiente: 'bg-red-100 text-red-800', parcial: 'bg-amber-100 text-amber-900', pagada: 'bg-green-100 text-green-800',
  };
  const txt: Record<string, string> = { pendiente: 'Debe', parcial: 'Abonó', pagada: 'Pagada' };
  return <span className={`px-3 py-1 rounded-full text-sm font-bold ${m[estado] ?? 'bg-slate-100'}`}>{txt[estado] ?? estado}</span>;
}

export function Cargando() { return <p className="text-center text-slate-500 py-8">Cargando…</p>; }

export function Confirmar({ texto, onSi, children, tono = 'rojo' }: { texto: string; onSi: () => void; children: ReactNode; tono?: 'rojo' | 'gris' }) {
  return <Boton tono={tono} onClick={() => { if (confirm(texto)) onSi(); }}>{children}</Boton>;
}

export function EstadoConexion() {
  const { enLinea, sincronizando, pendientes } = useEstadoRed();
  const txt = sincronizando ? `Sincronizando (${pendientes})…` : !enLinea ? `Sin conexión${pendientes ? ` · ${pendientes} pendientes` : ''}` : pendientes ? `${pendientes} pendientes` : 'En línea';
  const color = !enLinea ? 'bg-red-500' : pendientes || sincronizando ? 'bg-amber-500' : 'bg-green-400';
  return (
    <button onClick={() => vaciarCola()} className="flex items-center gap-2 text-sm font-semibold text-white/90">
      <span className={`w-3 h-3 rounded-full ${color}`} />{txt}
    </button>
  );
}

const itemsAdmin = [
  { to: '/', icono: '🏠', txt: 'Inicio' },
  { to: '/clientes', icono: '👥', txt: 'Clientes' },
  { to: '/por-cobrar', icono: '💰', txt: 'Cobrar' },
  { to: '/paches', icono: '🫔', txt: 'Paches' },
  { to: '/mas', icono: '☰', txt: 'Más' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { perfil } = useAuth();
  const [, setX] = useState(0);
  const items = perfil?.rol === 'admin' ? itemsAdmin : [{ to: '/', icono: '📦', txt: 'Entregas' }];
  return (
    <div className="min-h-screen pb-28">
      <header className="bg-marca px-4 py-3 flex justify-between items-center sticky top-0 z-10" onClick={() => setX(x => x + 1)}>
        <span className="text-white font-extrabold text-xl">Mis Ventas</span>
        <EstadoConexion />
      </header>
      <main className="max-w-2xl mx-auto p-4">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t-2 border-slate-200 flex justify-around z-10" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {items.map(i => (
          <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => `flex-1 py-2 text-center ${isActive ? 'text-marca font-extrabold' : 'text-slate-600'}`}>
            <div className="text-2xl leading-7">{i.icono}</div>
            <div className="text-sm">{i.txt}</div>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
