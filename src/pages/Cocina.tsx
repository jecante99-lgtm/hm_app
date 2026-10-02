import { supabase } from '../lib/supabase';
import { useData, q, llamar } from '../lib/offline';
import { fechaCorta } from '../lib/format';
import { Boton, BotonLink, Tarjeta, Titulo, Cargando } from '../components/ui';

export default function Cocina() {
  const { datos, cargando, recargar } = useData('cocina', () =>
    q<any[]>(supabase.from('v_cocina_pendiente').select('*').order('fecha_entrega', { nullsFirst: false }).order('cliente_nombre')));
  if (cargando && !datos) return <Cargando />;
  const filas = datos ?? [];

  const porPrecio: Record<string, number> = {};
  filas.forEach(f => { porPrecio[f.precio_unitario] = (porPrecio[f.precio_unitario] ?? 0) + Number(f.cantidad); });
  const porClase: Record<string, number> = {};
  filas.forEach(f => { const k = String(f.descripcion).replace(/^Paches\s*/i, '') || 'Paches'; porClase[k] = (porClase[k] ?? 0) + Number(f.cantidad); });
  const total = filas.reduce((s, f) => s + Number(f.cantidad), 0);

  const porCliente: Record<string, { nombre: string; lineas: any[] }> = {};
  filas.forEach(f => { (porCliente[f.cliente_id] ??= { nombre: f.cliente_nombre, lineas: [] }).lineas.push(f); });

  async function preparar(ids: string[]) {
    await llamar('cambiar_estado_lineas', { p_ids: ids, p_estado: 'preparado' });
    recargar();
  }

  return (
    <div className="space-y-3">
      <Titulo>🫔 Paches</Titulo>
      <BotonLink to="/paches/nuevo" tono="verde" className="!min-h-20 !text-2xl">➕ Anotar pedido de paches</BotonLink>
      <Tarjeta className="bg-marca text-white border-0">
        <div className="text-lg">Total por preparar</div>
        <div className="text-4xl font-extrabold">{total}</div>
        <div className="text-xl mt-1">{Object.entries(porPrecio).map(([p, n]) => `${n} a Q${Number(p)}`).join(' · ') || '—'}</div>
        {Object.keys(porClase).length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/30 space-y-1">
            {Object.entries(porClase).map(([k, n]) => <div key={k} className="flex justify-between text-xl"><span>{k}</span><b>{n}</b></div>)}
          </div>
        )}
      </Tarjeta>
      <BotonLink to="/entregas" tono="borde">📦 Ver lo que ya está preparado</BotonLink>

      {Object.entries(porCliente).map(([cid, c]) => (
        <Tarjeta key={cid} className="space-y-2">
          <b className="text-xl">{c.nombre}</b>
          {c.lineas.map(l => (
            <div key={l.linea_id} className="flex justify-between items-center gap-2 border-t pt-2">
              <div><div className="font-semibold">{l.cantidad} × {l.descripcion}</div><div className="text-slate-500">a Q{Number(l.precio_unitario)}{l.fecha_entrega ? ` · entrega ${fechaCorta(l.fecha_entrega)}` : ""}</div></div>
              <Boton tono="verde" className="!min-h-12 !px-3" onClick={() => preparar([l.linea_id])}>Listo</Boton>
            </div>
          ))}
          {c.lineas.length > 1 && <Boton tono="verde" className="w-full" onClick={() => preparar(c.lineas.map(l => l.linea_id))}>✔ Todo de {c.nombre} listo</Boton>}
        </Tarjeta>
      ))}
      {!filas.length && <p className="text-center text-slate-500 py-6">No hay paches pendientes.</p>}
    </div>
  );
}
