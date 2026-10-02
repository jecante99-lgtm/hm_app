import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useData, q, llamar } from '../lib/offline';
import { dinero, hoy, uuid } from '../lib/format';
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
  const [nota, setNota] = useState('');
  const cambiar = (k: string, d: number) => setCant(c => ({ ...c, [k]: Math.max(0, (c[k] ?? 0) + d) }));
  const PRECIO = 8; // todos los paches cuestan Q8
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

  const total = VARIANTES.reduce((t, v) => t + (cant[v.clave] ?? 0) * PRECIO, 0);
  const piezas = VARIANTES.reduce((t, v) => t + (cant[v.clave] ?? 0), 0);

  async function guardar() {
    setError('');
    if (!clienteId) return setError('Elige el cliente');
    if (!categoria) return setError('No hay categoría de paches. Revisa Ajustes.');
    const validas = VARIANTES.filter(v => (cant[v.clave] ?? 0) > 0);
    if (!validas.length) return setError('Agrega cuántos paches con los botones + y −');
    setGuardando(true);
    try {
      const r = await llamar('crear_venta', {
        p_id: uuid(), p_cliente_id: clienteId, p_categoria_id: categoria.id, p_fecha: hoy(),
        p_fecha_promesa: null, p_fecha_entrega: null, p_notas: nota.trim() || null,
        p_lineas: validas.map(v => ({
          descripcion: `Paches ${v.clave}`,
          cantidad: cant[v.clave], costo_unitario: 0, precio_unitario: PRECIO, medio_compra: '', tarjeta_id: '',
        })),
        p_pago_inicial: 0, p_pago_metodo: 'efectivo', p_pago_id: uuid(),
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

      <div className="grid grid-cols-2 gap-2">
        {VARIANTES.map(v => {
          const n = cant[v.clave] ?? 0;
          return (
            <div key={v.clave} className={`rounded-2xl bg-white p-2 space-y-2 shadow-sm ${n > 0 ? 'border-2 border-marca' : 'border-2 border-slate-200'}`}>
              <div className="text-center leading-tight">
                <div className="text-2xl">{v.icono}</div>
                <div className="font-extrabold">{v.clave}</div>
              </div>
              <div className="text-5xl font-extrabold text-center">{n}</div>
              <div className="grid grid-cols-2 gap-2">
                <button aria-label="Quitar uno" onClick={() => cambiar(v.clave, -1)} className="h-14 rounded-xl bg-slate-200 text-4xl font-extrabold active:bg-slate-300">−</button>
                <button aria-label="Agregar uno" onClick={() => cambiar(v.clave, 1)} className="h-14 rounded-xl bg-marca text-white text-4xl font-extrabold active:bg-marca-osc">+</button>
              </div>
              <div className="text-center text-slate-600 font-bold">{dinero(n * PRECIO)}</div>
            </div>
          );
        })}
      </div>

      <Campo etiqueta="Nota del pedido (opcional)"><Entrada placeholder="Ej. entregar por la tarde" value={nota} onChange={e => setNota(e.target.value)} /></Campo>

      <Tarjeta className="bg-slate-50">
        <div className="flex justify-between text-xl"><span>Total de paches</span><b>{piezas}</b></div>
        <div className="flex justify-between text-xl"><span>A cobrar</span><b>{dinero(total)}</b></div>
      </Tarjeta>

      {error && <Aviso>{error}</Aviso>}
      <Boton tono="verde" className="w-full" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : '✔ Guardar pedido'}</Boton>
    </div>
  );
}
