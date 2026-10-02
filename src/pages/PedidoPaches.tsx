import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useData, q, llamar } from '../lib/offline';
import { dinero, hoy, num, uuid } from '../lib/format';
import ClienteRapido from '../components/ClienteRapido';
import { Boton, Campo, Entrada, Selector, Tarjeta, Titulo, Aviso } from '../components/ui';

type Fila = { cantidad: string; precio: string; nota: string };
const fila = (): Fila => ({ cantidad: '', precio: '10', nota: '' });

export default function PedidoPaches() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [clienteId, setClienteId] = useState(params.get('cliente') ?? '');
  const [filas, setFilas] = useState<Fila[]>([fila()]);
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

  const set = (i: number, k: keyof Fila, v: string) => setFilas(fs => fs.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  const total = filas.reduce((s, f) => s + num(f.cantidad) * num(f.precio), 0);
  const piezas = filas.reduce((s, f) => s + num(f.cantidad), 0);

  async function guardar() {
    setError('');
    if (!clienteId) return setError('Elige el cliente');
    if (!categoria) return setError('No hay categoría de paches. Revisa Ajustes.');
    const validas = filas.filter(f => num(f.cantidad) > 0);
    if (!validas.length) return setError('Escribe cuántos paches');
    if (validas.some(f => num(f.precio) <= 0)) return setError('Falta el precio');
    if (num(adelanto) > total) return setError('El adelanto es mayor que el total');
    setGuardando(true);
    try {
      const r = await llamar('crear_venta', {
        p_id: uuid(), p_cliente_id: clienteId, p_categoria_id: categoria.id, p_fecha: hoy(),
        p_fecha_promesa: null, p_fecha_entrega: entrega || null, p_notas: null,
        p_lineas: validas.map(f => ({
          descripcion: f.nota.trim() ? `Paches ${f.nota.trim()}` : 'Paches',
          cantidad: num(f.cantidad), costo_unitario: num(costo), precio_unitario: num(f.precio), medio_compra: '', tarjeta_id: '',
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

      {filas.map((f, i) => (
        <Tarjeta key={i} className="space-y-3">
          <Campo etiqueta="¿Cuántos paches?">
            <Entrada inputMode="numeric" placeholder="Ej. 20" value={f.cantidad} onChange={e => set(i, 'cantidad', e.target.value)} />
          </Campo>
          <div>
            <span className="block font-bold mb-1">Precio de cada uno</span>
            <div className="grid grid-cols-2 gap-2">
              {['8', '10'].map(p => (
                <button key={p} onClick={() => set(i, 'precio', p)}
                  className={`min-h-16 rounded-2xl text-2xl font-extrabold border-2 ${f.precio === p ? 'bg-marca text-white border-marca' : 'bg-white text-slate-900 border-slate-300'}`}>${p}</button>
              ))}
            </div>
          </div>
          <Campo etiqueta="Nota (opcional)"><Entrada placeholder="Ej. de pollo, sin picante" value={f.nota} onChange={e => set(i, 'nota', e.target.value)} /></Campo>
          <div className="flex justify-between items-center">
            <b className="text-lg">{dinero(num(f.cantidad) * num(f.precio))}</b>
            {filas.length > 1 && <button className="text-red-600 font-bold p-2" onClick={() => setFilas(fs => fs.filter((_, j) => j !== i))}>Quitar</button>}
          </div>
        </Tarjeta>
      ))}
      <Boton tono="borde" className="w-full" onClick={() => setFilas(fs => [...fs, fila()])}>➕ Otro precio u otra clase</Boton>

      <Campo etiqueta="¿Para cuándo se entrega?"><Entrada type="date" value={entrega} onChange={e => setEntrega(e.target.value)} /></Campo>
      <Campo etiqueta="Me cuesta cada uno (opcional)"><Entrada inputMode="decimal" placeholder="$0.00" value={costo} onChange={e => setCosto(e.target.value)} /></Campo>
      <Campo etiqueta="¿Dejó adelanto? (opcional)"><Entrada inputMode="decimal" placeholder="$0.00" value={adelanto} onChange={e => setAdelanto(e.target.value)} /></Campo>

      <Tarjeta className="bg-slate-50">
        <div className="flex justify-between text-xl"><span>Total de paches</span><b>{piezas}</b></div>
        <div className="flex justify-between text-xl"><span>A cobrar</span><b>{dinero(total)}</b></div>
      </Tarjeta>

      {error && <Aviso>{error}</Aviso>}
      <Boton tono="verde" className="w-full" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : '✔ Guardar pedido'}</Boton>
    </div>
  );
}
