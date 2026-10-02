const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
export const dinero = (n: number | string | null | undefined) => mxn.format(Number(n ?? 0));
export const num = (v: string | number | null | undefined) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
export const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const fechaCorta = (d?: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '—';
export const mesLargo = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
export const uuid = () => crypto.randomUUID();

export function whatsappUrl(telefono: string | null | undefined, texto: string) {
  let t = (telefono ?? '').replace(/\D/g, '');
  if (t.length === 10) t = '52' + t;
  return `https://wa.me/${t}?text=${encodeURIComponent(texto)}`;
}

export function descargar(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + contenido], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function aCsv(filas: Record<string, unknown>[]) {
  if (!filas.length) return '';
  const cols = Object.keys(filas[0]);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...filas.map(f => cols.map(c => esc(f[c])).join(','))].join('\n');
}
