import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useData, q, llamar } from '../lib/offline';
import { dinero, hoy, num, uuid } from '../lib/format';
import ClienteRapido from '../components/ClienteRapido';
import { Boton, Campo, Entrada, Selector, Tarjeta, Titulo, Aviso } from '../components/ui';

const VARIANTES = [
  { clave: 'Pollo picante', icono: '🐔🌶️' },
  { clave: 'Pollo no picante', icono: '🐔' },
  { clave: 'Cerdo picante', icono: '🐷🌶️' },
  { clave: 'Cerdo no picante', icono: '🐷' },
];

export default function PedidoPaches() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [clienteId, setClienteId] = useState(params.get('cliente') ?? '');
  const [cant, setCant] = useState<Record<string, number>>({});
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [nota, setNota] = useState('');
  const cambiar = (k: string, d: number) => setCant(c => ({ ...c, [k]: Math.max(0, (c[k] ?? 0) + d) }));
  const precioDe = (k: string) => precios[k] ?? '8';
  const [entrega, setEntrega] = useState(hoy());
  const [costo, setCosto] = useState('');
  const [adelanto, setAdelanto] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const { datos, recargar } = useData('catalogos_paches', async () => {
    const [clientes, categorias] = await Promise.all([
      q<any[]>(supabase.from('clientes').select('id,nombre').eq('activo', true).is('deleted_at', null).order('nombre')),
      q<any[]>(supabase.from('categorias').select('id,nombre').eq('genera_pedido', true).eq('activa', true).order('nombre')),
    ]);
    return { clientes, categorias };
  });
  const categoria = datos?.categorias[0];

  const total = VARIANTES.reduce((t, v) => t + (cant[v.clave] ?? 0) * num(precioDe(v.clave)), 0);
  const piezas = VARIANTES.reduce((t, v) => t + (cant[v.clave] ?? 0), 0);

  async function guardar() {
    setError('');
    if (!clienteId) return setError('Elige el cliente');
    if (!categoria) return setError('No hay categoría de paches. Revisa Ajustes.');
    const validas = VARIANTES.filter(v => (cant[v.clave] ?? 0) > 0);
    if (!validas.length) return setError('Agrega cuántos paches con los botones + y −');
    if (num(adelanto) > total) return setError('El adelanto es mayor que el total');
    setGuardando(true);
    try {
      const r = await llamar('crear_venta', {
        p_id: uuid(), p_cliente_id: clienteId, p_categoria_id: categoria.id, p_fecha: hoy(),
        p_fecha_promesa: null, p_fecha_entrega: entrega || null, p_notas: nota.trim() || null,
        p_lineas: validas.map(v => ({
          descripcion: `Paches ${v.clave}`,
          cantidad: cant[v.clave], costo_unitario: num(costo), precio_unitario: num(precioDe(v.clave)), medio_compra: '', tarjeta_id: '',
        })),
        p_pago_inicial: num(adelanto), p_pago_metodo: 'efectivo', p_pago_id: uuid(),
      });
      if (r.enCola) alert('Sin internet: el pedido quedó guardado y se enviará al reconectar.');
      nav('/paches');
    } catch (e: any) { setError(e.message); setGuardando(false); }
  }

  return (
    <div className="space-y-4">
      <Titulo atras="/paches">🫔 Anotar pedido de paches</Titulo>

      <Campo etiqueta="¿Para quién?">
        <Selector value={clienteId} onChange={e => setClienteId(e.target.value)}>
          <option value="">— Elegir cliente —</option>
          {datos?.clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Selector>
      </Campo>
      <ClienteRapido alCrear={async id => { await recargar(); setClienteId(id); }} />

      {VARIANTES.map(v => {
        const n = cant[v.clave] ?? 0;
        return (
          <Tarjeta key={v.clave} className={`space-y-3 ${n > 0 ? '!border-marca border-2' : ''}`}>
            <div className="flex items-center justify-between">
              <b className="text-xl">{v.icono} {v.clave}</b>
              <b className="text-lg text-slate-600">{dinero(n * num(precioDe(v.clave)))}</b>
            </div>
            <div className="flex items-center justify-between gap-2">
              <button aria-label="Quitar uno" onClick={() => cambiar(v.clave, -1)} className="w-16 h-16 rounded-2xl bg-slate-200 text-4xl font-extrabold active:bg-slate-300">−</button>
              <div className="text-5xl font-extrabold min-w-16 text-center">{n}</div>
              <button aria-label="Agregar uno" onClick={() => cambiar(v.clave, 1)} className="w-16 h-16 rounded-2xl bg-marca text-white text-4xl font-extrabold active:bg-marca-osc">+</button>
              <button aria-label="Agregar cinco" onClick={() => cambiar(v.clave, 5)} className="h-16 px-3 rounded-2xl bg-green-600 text-white text-xl font-extrabold active:bg-green-700">+5</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['8', '10'].map(p => (
                <button key={p} onClick={() => setPrecios(x => ({ ...x, [v.clave]: p }))}
                  className={`min-h-12 rounded-xl text-xl font-extrabold border-2 ${precioDe(v.clave) === p ? 'bg-marca text-white border-marca' : 'bg-white text-slate-900 border-slate-300'}`}>Q{p} c/u</button>
              ))}
            </div>
          </Tarjeta>
        );
      })}

      <Campo etiqueta="¿Para cuándo se entrega?"><Entrada type="date" value={entrega} onChange={e => setEntrega(e.target.value)} /></Campo>
      <Campo etiqueta="Nota del pedido (opcional)"><Entrada placeholder="Ej. entregar por la tarde" value={nota} onChange={e => setNota(e.target.value)} /></Campo>
      <Campo etiqueta="Me cuesta cada uno (opcional)"><Entrada inputMode="decimal" placeholder="Q0.00" value={costo} onChange={e => setCosto(e.target.value)} /></Campo>
      <Campo etiqueta="¿Dejó adelanto? (opcional)"><Entrada inputMode="decimal" placeholder="Q0.00" value={adelanto} onChange={e => setAdelanto(e.target.value)} /></Campo>

      <Tarjeta className="bg-slate-50">
        <div className="flex justify-between text-xl"><span>Total de paches</span><b>{piezas}</b></div>
        <div className="flex justify-between text-xl"><span>A cobrar</span><b>{dinero(total)}</b></div>
      </Tarjeta>

      {error && <Aviso>{error}</Aviso>}
      <Boton tono="verde" className="w-full" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : '✔ Guardar pedido'}</Boton>
    </div>
  );
}
