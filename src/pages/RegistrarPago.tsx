import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useData, q, llamar } from '../lib/offline';
import { dinero, fechaCorta, hoy, num, uuid } from '../lib/format';
import { Boton, Campo, Entrada, Selector, Tarjeta, Titulo, Aviso } from '../components/ui';

export default function RegistrarPago() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [clienteId, setClienteId] = useState(params.get('cliente') ?? '');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [metodo, setMetodo] = useState('efectivo');
  const [notas, setNotas] = useState('');
  const [manual, setManual] = useState(false);
  const [reparto, setReparto] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const { datos } = useData('clientes_con_saldo', () =>
    q<any[]>(supabase.from('v_saldo_cliente').select('cliente_id,nombre,saldo_pendiente').eq('activo', true).order('nombre')));
  const { datos: abiertas } = useData(`abiertas_${clienteId}`, () =>
    clienteId ? q<any[]>(supabase.from('v_ventas_resumen').select('venta_id,categoria_nombre,fecha,saldo_pendiente').eq('cliente_id', clienteId).gt('saldo_pendiente', 0).order('fecha')) : Promise.resolve([]),
    [clienteId]);

  const m = num(monto);
  const repartido = Object.values(reparto).reduce((s, v) => s + num(v), 0);

  async function guardar() {
    setError('');
    if (!clienteId) return setError('Elige el cliente');
    if (m <= 0) return setError('Escribe el monto');
    if (manual && repartido > m) return setError('Repartiste más de lo que pagó');
    setGuardando(true);
    try {
      const apl = manual ? Object.entries(reparto).filter(([, v]) => num(v) > 0).map(([venta_id, v]) => ({ venta_id, monto: num(v) })) : null;
      const r = await llamar('registrar_pago', { p_id: uuid(), p_cliente_id: clienteId, p_fecha: fecha, p_monto: m, p_metodo: metodo, p_notas: notas || null, p_aplicaciones: apl });
      if (r.enCola) alert('Sin internet: el pago quedó guardado y se enviará al reconectar.');
      nav(`/clientes/${clienteId}`);
    } catch (e: any) { setError(e.message); setGuardando(false); }
  }

  return (
    <div className="space-y-4">
      <Titulo atras="/">Registrar pago</Titulo>
      <Campo etiqueta="Cliente">
        <Selector value={clienteId} onChange={e => { setClienteId(e.target.value); setReparto({}); }}>
          <option value="">— Elegir —</option>
          {datos?.map(c => <option key={c.cliente_id} value={c.cliente_id}>{c.nombre}{c.saldo_pendiente > 0 ? ` (debe ${dinero(c.saldo_pendiente)})` : ''}</option>)}
        </Selector>
      </Campo>
      <Campo etiqueta="¿Cuánto pagó?"><Entrada inputMode="decimal" placeholder="$0.00" value={monto} onChange={e => setMonto(e.target.value)} /></Campo>
      <Campo etiqueta="Fecha"><Entrada type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></Campo>
      <Campo etiqueta="Forma de pago">
        <Selector value={metodo} onChange={e => setMetodo(e.target.value)}>
          <option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option>
        </Selector>
      </Campo>
      <Campo etiqueta="Notas (opcional)"><Entrada value={notas} onChange={e => setNotas(e.target.value)} /></Campo>

      <div className="grid grid-cols-2 gap-2">
        <Boton tono={manual ? 'borde' : 'marca'} onClick={() => setManual(false)}>Automático</Boton>
        <Boton tono={manual ? 'marca' : 'borde'} onClick={() => setManual(true)}>Elegir ventas</Boton>
      </div>
      <p className="text-slate-600">{manual ? 'Escribe cuánto va a cada compra.' : 'Se aplica primero a las compras más antiguas. Si sobra, queda a favor del cliente.'}</p>

      {manual && abiertas?.map(v => (
        <Tarjeta key={v.venta_id} className="flex items-center justify-between gap-3">
          <div><b>{v.categoria_nombre} · {fechaCorta(v.fecha)}</b><div className="text-red-700">Falta {dinero(v.saldo_pendiente)}</div></div>
          <Entrada className="!w-32" inputMode="decimal" placeholder="$" value={reparto[v.venta_id] ?? ''} onChange={e => setReparto({ ...reparto, [v.venta_id]: e.target.value })} />
        </Tarjeta>
      ))}

      {error && <Aviso>{error}</Aviso>}
      <Boton tono="verde" className="w-full" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : '✔ Guardar pago'}</Boton>
    </div>
  );
}
