import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useData, q } from '../lib/offline';
import { aCsv, descargar, dinero, mesLargo } from '../lib/format';
import { Boton, Tarjeta, Titulo, Selector, Cargando } from '../components/ui';

export default function Reportes() {
  const [mes, setMes] = useState('todos');
  const { datos, cargando } = useData('reportes', async () => {
    const [gan, ventas, costos] = await Promise.all([
      q<any[]>(supabase.from('v_ganancia_por_categoria').select('*').order('mes', { ascending: false })),
      q<any[]>(supabase.from('v_ventas_resumen').select('*')),
      q<any[]>(supabase.from('v_costos_por_medio').select('*')),
    ]);
    return { gan, ventas, costos };
  });
  if (cargando && !datos) return <Cargando />;
  const { gan, ventas, costos } = datos!;

  const meses = [...new Set(gan.map(g => g.mes))] as string[];
  const enRango = (m: string) => mes === 'todos' || m === mes;
  const g = gan.filter(x => enRango(x.mes));

  const porCat: Record<string, { ventas: number; ganancia: number; cobrada: number }> = {};
  g.forEach(x => {
    const c = (porCat[x.categoria_nombre] ??= { ventas: 0, ganancia: 0, cobrada: 0 });
    c.ventas += Number(x.ventas_totales); c.ganancia += Number(x.ganancia); c.cobrada += Number(x.ganancia_cobrada);
  });
  const tot = Object.values(porCat).reduce((s, c) => ({ ventas: s.ventas + c.ventas, ganancia: s.ganancia + c.ganancia, cobrada: s.cobrada + c.cobrada }), { ventas: 0, ganancia: 0, cobrada: 0 });
  const costoTot = g.reduce((s, x) => s + Number(x.costo_total), 0);
  const maxG = Math.max(1, ...Object.values(porCat).map(c => c.ganancia));

  const vm = ventas.filter(v => mes === 'todos' || (v.fecha as string).slice(0, 7) === mes.slice(0, 7));
  const top: Record<string, { n: string; compras: number; ganancia: number }> = {};
  vm.forEach(v => { const t = (top[v.cliente_id] ??= { n: v.cliente_nombre, compras: 0, ganancia: 0 }); t.compras += Number(v.total_precio); t.ganancia += Number(v.ganancia); });
  const topL = Object.values(top).sort((a, b) => b.ganancia - a.ganancia).slice(0, 5);

  const cm = costos.filter(c => enRango(c.mes));
  const porMedio: Record<string, number> = {};
  cm.forEach(c => { const k = c.medio_compra === 'tarjeta' ? `Tarjeta ${c.tarjeta ?? ''}`.trim() : c.medio_compra === 'efectivo' ? 'Efectivo' : 'Sin dato'; porMedio[k] = (porMedio[k] ?? 0) + Number(c.costo); });

  return (
    <div className="space-y-4">
      <Titulo atras="/mas">Reportes</Titulo>
      <Selector value={mes} onChange={e => setMes(e.target.value)}>
        <option value="todos">Todo el tiempo</option>
        {meses.map(m => <option key={m} value={m}>{mesLargo(m)}</option>)}
      </Selector>

      <Tarjeta className="space-y-1">
        <div className="flex justify-between text-lg"><span>Ventas</span><b>{dinero(tot.ventas)}</b></div>
        <div className="flex justify-between text-lg"><span>Costo</span><b>{dinero(costoTot)}</b></div>
        <div className="flex justify-between text-xl text-green-700"><span>Ganancia</span><b>{dinero(tot.ganancia)}</b></div>
        <div className="flex justify-between text-lg"><span>Ya cobrada</span><b>{dinero(tot.cobrada)}</b></div>
        <div className="flex justify-between text-lg text-red-700"><span>Por cobrar</span><b>{dinero(tot.ganancia - tot.cobrada)}</b></div>
      </Tarjeta>

      <h2 className="text-xl font-extrabold">¿De dónde viene mi dinero?</h2>
      <Tarjeta className="space-y-3">
        {Object.entries(porCat).map(([n, c]) => (
          <div key={n}>
            <div className="flex justify-between text-lg"><b>{n}</b><b>{dinero(c.ganancia)}</b></div>
            <div className="h-6 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-marca" style={{ width: `${(c.ganancia / maxG) * 100}%` }} /></div>
          </div>
        ))}
        {!Object.keys(porCat).length && <p className="text-slate-500">Sin datos.</p>}
      </Tarjeta>

      <h2 className="text-xl font-extrabold">Mejores clientes</h2>
      <Tarjeta className="space-y-2">
        {topL.map(t => <div key={t.n} className="flex justify-between text-lg"><span>{t.n}</span><b>{dinero(t.ganancia)}</b></div>)}
      </Tarjeta>

      <h2 className="text-xl font-extrabold">Compras: efectivo o tarjeta</h2>
      <Tarjeta className="space-y-2">
        {Object.entries(porMedio).map(([k, v]) => <div key={k} className="flex justify-between text-lg"><span>{k}</span><b>{dinero(v)}</b></div>)}
      </Tarjeta>

      <Boton tono="gris" className="w-full" onClick={() => descargar('ventas.csv', aCsv(vm.map(v => ({ fecha: v.fecha, cliente: v.cliente_nombre, categoria: v.categoria_nombre, total: v.total_precio, costo: v.total_costo, ganancia: v.ganancia, pagado: v.total_pagado, saldo: v.saldo_pendiente, estado: v.estado_cobro }))))}>⬇ Exportar ventas (CSV)</Boton>
    </div>
  );
}
