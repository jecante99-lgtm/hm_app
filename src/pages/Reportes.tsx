import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useData, q } from '../lib/offline';
import { aCsv, descargar, dinero, fechaCorta, hoy, mesLargo } from '../lib/format';
import { Boton, Tarjeta, Titulo, Selector, Cargando } from '../components/ui';

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const sumaDias = (f: string, n: number) => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
/** Lunes de la semana de la fecha dada */
const lunes = (f: string) => { const d = new Date(f + 'T12:00:00'); return sumaDias(f, -((d.getDay() + 6) % 7)); };
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

type Fila = { fecha: string; cliente_id: string; cliente_nombre: string; categoria_nombre: string; total_precio: number; total_costo: number; ganancia: number; total_pagado: number; saldo_pendiente: number; estado_cobro: string };
const cobrada = (v: Fila) => (Number(v.total_precio) > 0 ? Number(v.ganancia) * Math.min(1, Number(v.total_pagado) / Number(v.total_precio)) : 0);

export default function Reportes() {
  const [periodo, setPeriodo] = useState('semana');
  const { datos, cargando } = useData('reportes2', async () => {
    const [ventas, costos] = await Promise.all([
      q<Fila[]>(supabase.from('v_ventas_resumen').select('*')),
      q<any[]>(supabase.from('v_costos_por_medio').select('*')),
    ]);
    return { ventas, costos };
  });
  if (cargando && !datos) return <Cargando />;
  const { ventas, costos } = datos!;

  const lunesHoy = lunes(hoy());
  let desde = '0000-01-01', hasta = '9999-12-31', titulo = 'Todo el tiempo', esSemana = false;
  if (periodo === 'semana') { desde = lunesHoy; hasta = sumaDias(lunesHoy, 6); titulo = 'Esta semana'; esSemana = true; }
  else if (periodo === 'semana_pasada') { desde = sumaDias(lunesHoy, -7); hasta = sumaDias(lunesHoy, -1); titulo = 'Semana pasada'; esSemana = true; }
  else if (periodo.startsWith('mes:')) { const m = periodo.slice(4); desde = m; hasta = sumaDias(iso(new Date(new Date(m + 'T12:00:00').getFullYear(), new Date(m + 'T12:00:00').getMonth() + 1, 1)), -1); titulo = mesLargo(m); }

  const vm = ventas.filter(v => v.fecha >= desde && v.fecha <= hasta);
  const t = vm.reduce((s, v) => ({ ventas: s.ventas + Number(v.total_precio), costo: s.costo + Number(v.total_costo), ganancia: s.ganancia + Number(v.ganancia), cobrada: s.cobrada + cobrada(v), pagado: s.pagado + Number(v.total_pagado) }), { ventas: 0, costo: 0, ganancia: 0, cobrada: 0, pagado: 0 });

  const porCat: Record<string, { ventas: number; ganancia: number }> = {};
  vm.forEach(v => { const c = (porCat[v.categoria_nombre] ??= { ventas: 0, ganancia: 0 }); c.ventas += Number(v.total_precio); c.ganancia += Number(v.ganancia); });
  const maxCat = Math.max(1, ...Object.values(porCat).map(c => c.ganancia));

  const dias = esSemana ? DIAS.map((n, i) => {
    const f = sumaDias(desde, i); const del = vm.filter(v => v.fecha === f);
    return { n, f, ventas: del.reduce((s, v) => s + Number(v.total_precio), 0), ganancia: del.reduce((s, v) => s + Number(v.ganancia), 0) };
  }) : [];
  const maxDia = Math.max(1, ...dias.map(d => d.ventas));

  const top: Record<string, { n: string; ganancia: number }> = {};
  vm.forEach(v => { const x = (top[v.cliente_id] ??= { n: v.cliente_nombre, ganancia: 0 }); x.ganancia += Number(v.ganancia); });
  const topL = Object.values(top).sort((a, b) => b.ganancia - a.ganancia).slice(0, 5);

  const meses = [...new Set(ventas.map(v => v.fecha.slice(0, 7) + '-01'))].sort().reverse();
  const porMedio: Record<string, number> = {};
  if (!esSemana) costos.filter(c => periodo === 'todo' || c.mes === periodo.slice(4)).forEach(c => {
    const k = c.medio_compra === 'tarjeta' ? `Tarjeta ${c.tarjeta ?? ''}`.trim() : c.medio_compra === 'efectivo' ? 'Efectivo' : 'Sin dato'; porMedio[k] = (porMedio[k] ?? 0) + Number(c.costo);
  });

  return (
    <div className="space-y-4">
      <Titulo atras="/mas">Reportes</Titulo>
      <Selector value={periodo} onChange={e => setPeriodo(e.target.value)}>
        <option value="semana">Esta semana</option>
        <option value="semana_pasada">Semana pasada</option>
        {meses.map(m => <option key={m} value={`mes:${m}`}>{mesLargo(m)}</option>)}
        <option value="todo">Todo el tiempo</option>
      </Selector>
      {esSemana && <p className="text-slate-600 text-lg">Del lunes {fechaCorta(desde)} al domingo {fechaCorta(hasta)}</p>}

      <Tarjeta className="bg-marca text-white border-0">
        <div className="text-lg">Gané ({titulo.toLowerCase()})</div>
        <div className="text-4xl font-extrabold">{dinero(t.ganancia)}</div>
        <div className="text-lg mt-1">Vendí {dinero(t.ventas)}</div>
      </Tarjeta>

      <Tarjeta className="space-y-1">
        <div className="flex justify-between text-lg"><span>Ventas</span><b>{dinero(t.ventas)}</b></div>
        <div className="flex justify-between text-lg"><span>Costo</span><b>{dinero(t.costo)}</b></div>
        <div className="flex justify-between text-xl text-green-700"><span>Ganancia</span><b>{dinero(t.ganancia)}</b></div>
        <div className="flex justify-between text-lg"><span>Ya cobrada</span><b>{dinero(t.cobrada)}</b></div>
        <div className="flex justify-between text-lg text-red-700"><span>Por cobrar</span><b>{dinero(t.ganancia - t.cobrada)}</b></div>
        <div className="flex justify-between text-lg"><span>Dinero recibido</span><b>{dinero(t.pagado)}</b></div>
      </Tarjeta>

      {esSemana && (
        <>
          <h2 className="text-xl font-extrabold">Día por día</h2>
          <Tarjeta className="space-y-3">
            {dias.map(d => (
              <div key={d.f}>
                <div className="flex justify-between text-lg"><b>{d.n} {fechaCorta(d.f)}</b><span>{dinero(d.ventas)} · <b className="text-green-700">{dinero(d.ganancia)}</b></span></div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-marca" style={{ width: `${(d.ventas / maxDia) * 100}%` }} /></div>
              </div>
            ))}
            <p className="text-slate-500">Barra: ventas del día · en verde: ganancia</p>
          </Tarjeta>
        </>
      )}

      <h2 className="text-xl font-extrabold">¿De dónde viene mi dinero?</h2>
      <Tarjeta className="space-y-3">
        {Object.entries(porCat).map(([n, c]) => (
          <div key={n}>
            <div className="flex justify-between text-lg"><b>{n}</b><span>{dinero(c.ventas)} · <b className="text-green-700">{dinero(c.ganancia)}</b></span></div>
            <div className="h-6 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-green-600" style={{ width: `${(c.ganancia / maxCat) * 100}%` }} /></div>
          </div>
        ))}
        {!Object.keys(porCat).length && <p className="text-slate-500">Sin ventas en este periodo.</p>}
      </Tarjeta>

      <h2 className="text-xl font-extrabold">Mejores clientes</h2>
      <Tarjeta className="space-y-2">
        {topL.map(x => <div key={x.n} className="flex justify-between text-lg"><span>{x.n}</span><b>{dinero(x.ganancia)}</b></div>)}
        {!topL.length && <p className="text-slate-500">Sin ventas en este periodo.</p>}
      </Tarjeta>

      {!esSemana && Object.keys(porMedio).length > 0 && (
        <>
          <h2 className="text-xl font-extrabold">Compras: efectivo o tarjeta</h2>
          <Tarjeta className="space-y-2">
            {Object.entries(porMedio).map(([k, v]) => <div key={k} className="flex justify-between text-lg"><span>{k}</span><b>{dinero(v)}</b></div>)}
          </Tarjeta>
        </>
      )}

      <Boton tono="gris" className="w-full" onClick={() => descargar('ventas.csv', aCsv(vm.map(v => ({ fecha: v.fecha, cliente: v.cliente_nombre, categoria: v.categoria_nombre, total: v.total_precio, costo: v.total_costo, ganancia: v.ganancia, pagado: v.total_pagado, saldo: v.saldo_pendiente, estado: v.estado_cobro }))))}>⬇ Exportar ventas (CSV)</Boton>
    </div>
  );
}
