import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useData, q } from '../lib/offline';
import { dinero, fechaCorta } from '../lib/format';
import { Boton, Tarjeta, Titulo, Cargando } from '../components/ui';

export default function PorCobrar() {
  const [orden, setOrden] = useState<'monto' | 'antiguedad' | 'promesa'>('monto');
  const { datos, cargando } = useData('por_cobrar', () =>
    q<any[]>(supabase.from('v_saldo_cliente').select('*').gt('saldo_pendiente', 0)));
  if (cargando && !datos) return <Cargando />;

  const lista = [...(datos ?? [])].sort((a, b) =>
    orden === 'monto' ? b.saldo_pendiente - a.saldo_pendiente
    : orden === 'antiguedad' ? (a.mas_antigua_pendiente ?? '9').localeCompare(b.mas_antigua_pendiente ?? '9')
    : (a.proxima_promesa ?? '9').localeCompare(b.proxima_promesa ?? '9'));
  const total = lista.reduce((s, c) => s + Number(c.saldo_pendiente), 0);
  const hoyIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      <Titulo>Cuentas por cobrar</Titulo>
      <Tarjeta className="bg-marca text-white border-0"><div>Total que me deben</div><div className="text-4xl font-extrabold">{dinero(total)}</div></Tarjeta>
      <div className="grid grid-cols-3 gap-2">
        {([['monto', 'Monto'], ['antiguedad', 'Antigua'], ['promesa', 'Promesa']] as const).map(([k, t]) => (
          <Boton key={k} tono={orden === k ? 'marca' : 'borde'} className="!px-2 !text-base" onClick={() => setOrden(k)}>{t}</Boton>
        ))}
      </div>
      {lista.map(c => (
        <Link key={c.cliente_id} to={`/clientes/${c.cliente_id}`}>
          <Tarjeta className="mb-3">
            <div className="flex justify-between items-center">
              <b className="text-xl">{c.nombre}</b><b className="text-xl text-red-700">{dinero(c.saldo_pendiente)}</b>
            </div>
            <div className="text-slate-600">Desde {fechaCorta(c.mas_antigua_pendiente)}
              {c.proxima_promesa && <span className={c.proxima_promesa < hoyIso ? 'text-red-700 font-bold' : ''}> · Promete {fechaCorta(c.proxima_promesa)}{c.proxima_promesa < hoyIso ? ' (vencido)' : ''}</span>}
            </div>
          </Tarjeta>
        </Link>
      ))}
      {!lista.length && <p className="text-center text-slate-500 py-6">🎉 Nadie te debe.</p>}
    </div>
  );
}
