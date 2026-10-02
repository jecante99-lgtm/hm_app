import { supabase } from '../lib/supabase';
import { useData, q } from '../lib/offline';
import { dinero, hoy } from '../lib/format';
import { BotonLink, Tarjeta, Cargando } from '../components/ui';

export default function Inicio() {
  const { datos, cargando, error } = useData('inicio', async () => {
    const mes = hoy().slice(0, 7) + '-01';
    const en7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const [saldos, ventas, cocina, entregas, gan, abiertas] = await Promise.all([
      q<any[]>(supabase.from('v_saldo_cliente').select('saldo_pendiente')),
      q<any[]>(supabase.from('v_ventas_resumen').select('saldo_pendiente,fecha_promesa_pago').gt('saldo_pendiente', 0).not('fecha_promesa_pago', 'is', null).lte('fecha_promesa_pago', en7)),
      q<any[]>(supabase.from('v_cocina_pendiente').select('cantidad')),
      q<any[]>(supabase.from('v_entregas').select('cantidad')),
      q<any[]>(supabase.from('v_ganancia_por_categoria').select('categoria_nombre,ganancia').eq('mes', mes)),
      q<any[]>(supabase.from('v_ventas_resumen').select('categoria_nombre,saldo_pendiente').gt('saldo_pendiente', 0)),
    ]);
    const suma = (a: any[], k: string) => a.reduce((s, x) => s + Number(x[k]), 0);
    const porCat: Record<string, number> = {};
    abiertas.forEach(v => { porCat[v.categoria_nombre] = (porCat[v.categoria_nombre] ?? 0) + Number(v.saldo_pendiente); });
    return {
      debeCat: Object.entries(porCat).sort((a, b) => b[1] - a[1]),
      debenTotal: suma(saldos, 'saldo_pendiente'),
      semana: suma(ventas, 'saldo_pendiente'),
      porPreparar: suma(cocina, 'cantidad'),
      porEntregar: suma(entregas, 'cantidad'),
      ganMes: suma(gan, 'ganancia'),
      gan,
    };
  });

  if (cargando && !datos) return <Cargando />;
  if (!datos) return <p className="text-lg text-red-700">No se pudo cargar. Revisa tu conexión.{error ? ` (${error})` : ''}</p>;
  const d = datos;
  return (
    <div className="space-y-4">
      <Tarjeta className="bg-marca text-white border-0">
        <div className="text-lg">Total que me deben</div>
        <div className="text-4xl font-extrabold">{dinero(d.debenTotal)}</div>
      </Tarjeta>

      <Tarjeta>
        <div className="text-slate-600 mb-1">Me deben por categoría</div>
        {(d.debeCat ?? []).map(([n, m]: [string, number]) => (
          <div key={n} className="flex justify-between text-xl py-1"><span>{n}</span><b className="text-red-700">{dinero(m)}</b></div>
        ))}
        {!(d.debeCat ?? []).length && <div className="text-lg text-green-700 font-bold">Nadie te debe 🎉</div>}
      </Tarjeta>

      <div className="grid grid-cols-1 gap-3">
        <BotonLink to="/paches/nuevo" tono="verde">🫔 Anotar pedido de paches</BotonLink>
        <BotonLink to="/venta/nueva" tono="verde">➕ Nueva venta</BotonLink>
        <BotonLink to="/pago/nuevo" tono="marca">💵 Registrar pago</BotonLink>
        <BotonLink to="/clientes?nuevo=1" tono="borde">👤 Nuevo cliente</BotonLink>
        <BotonLink to="/reportes" tono="borde">📊 Ventas y ganancias de la semana</BotonLink>
      </div>

      <Tarjeta>
        <div className="text-slate-600">Cobros esperados esta semana</div>
        <div className="text-2xl font-extrabold">{dinero(d.semana)}</div>
      </Tarjeta>

      <Tarjeta>
        <div className="text-slate-600 mb-1">🫔 Paches</div>
        <div className="flex justify-between text-xl"><span>Por preparar</span><b>{d.porPreparar}</b></div>
        <div className="flex justify-between text-xl"><span>Por entregar</span><b>{d.porEntregar}</b></div>
      </Tarjeta>

      <Tarjeta>
        <div className="text-slate-600">Ganancia del mes</div>
        <div className="text-2xl font-extrabold mb-2">{dinero(d.ganMes)}</div>
        {d.gan.map((g: any) => (
          <div key={g.categoria_nombre} className="flex justify-between text-lg"><span>{g.categoria_nombre}</span><b>{dinero(g.ganancia)}</b></div>
        ))}
      </Tarjeta>
    </div>
  );
}
