import { useSyncExternalStore, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';

/* ---------- Cola de cambios sin conexión ----------
   Cada operación lleva UUIDs generados en el dispositivo y las funciones
   del servidor son idempotentes, así que reenviar nunca duplica. */

type Op = { id: string; fn: string; args: Record<string, unknown> };
const QKEY = 'cola_pendiente_v1';

let cola: Op[] = JSON.parse(localStorage.getItem(QKEY) || '[]');
let sincronizando = false;
let enLinea = navigator.onLine;
const oyentes = new Set<() => void>();
let snapshot = { enLinea, sincronizando, pendientes: cola.length };

function emitir() {
  localStorage.setItem(QKEY, JSON.stringify(cola));
  snapshot = { enLinea, sincronizando, pendientes: cola.length };
  oyentes.forEach(f => f());
}

const esErrorDeRed = (e: any) =>
  !navigator.onLine || /failed to fetch|network|load failed|fetch/i.test(String(e?.message ?? e));

export async function vaciarCola() {
  if (sincronizando || !navigator.onLine) return;
  sincronizando = true; emitir();
  try {
    while (cola.length) {
      const op = cola[0];
      const { error } = await supabase.rpc(op.fn, op.args);
      if (error) {
        if (esErrorDeRed(error)) break;
        console.error('Operación rechazada por el servidor, se descarta:', op, error);
      }
      cola.shift(); emitir();
    }
  } finally {
    sincronizando = false; emitir();
    window.dispatchEvent(new Event('datos-cambiaron'));
  }
}

/** Ejecuta una función RPC; si no hay internet la deja en cola. */
export async function llamar(fn: string, args: Record<string, unknown>): Promise<{ enCola: boolean }> {
  if (navigator.onLine && cola.length === 0) {
    try {
      const { error } = await supabase.rpc(fn, args);
      if (!error) { window.dispatchEvent(new Event('datos-cambiaron')); return { enCola: false }; }
      if (!esErrorDeRed(error)) throw new Error(error.message);
    } catch (e: any) {
      if (!esErrorDeRed(e)) throw e;
    }
  }
  cola.push({ id: crypto.randomUUID(), fn, args });
  emitir();
  vaciarCola();
  return { enCola: true };
}

window.addEventListener('online', () => { enLinea = true; emitir(); vaciarCola(); });
window.addEventListener('offline', () => { enLinea = false; emitir(); });
setTimeout(vaciarCola, 1500);

export function useEstadoRed() {
  return useSyncExternalStore(
    f => { oyentes.add(f); return () => oyentes.delete(f); },
    () => snapshot,
  );
}

/* ---------- Lectura con caché local (se ve sin internet) ---------- */
export function useData<T>(clave: string, cargar: () => Promise<T>, deps: unknown[] = []) {
  const ck = 'cache_v1_' + clave;
  const [datos, setDatos] = useState<T | null>(() => {
    try { const s = localStorage.getItem(ck); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      const r = await cargar();
      setDatos(r); setError(null);
      try { localStorage.setItem(ck, JSON.stringify(r)); } catch { /* sin espacio */ }
    } catch (e: any) {
      setError(e?.message ?? 'Error');
    } finally { setCargando(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ck, ...deps]);

  useEffect(() => {
    recargar();
    const h = () => recargar();
    window.addEventListener('datos-cambiaron', h);
    window.addEventListener('online', h);
    return () => { window.removeEventListener('datos-cambiaron', h); window.removeEventListener('online', h); };
  }, [recargar]);

  return { datos, cargando, error, recargar };
}

/** Lanza si Supabase devuelve error. */
export async function q<T>(p: PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? ([] as unknown)) as T;
}
