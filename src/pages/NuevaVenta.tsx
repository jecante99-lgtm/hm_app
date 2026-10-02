import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useData, q, llamar } from '../lib/offline';
import { dinero, hoy, num, uuid } from '../lib/format';
import { Boton, Campo, Entrada, Selector, Tarjeta, Titulo, Aviso } from '../components/ui';

type Linea = { descripcion: string; cantidad: string; costo: string; precio: string };
const vacia = (): Linea => ({ descripcion: '', cantidad: '1', costo: '', precio: '' });

export default function NuevaVenta() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [clienteId, setClienteId] = useState(params.get('cliente') ?? '');
  const [categoriaId, setCategoriaId] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [promesa, setPromesa] = useState('');
  const [entrega, setEntrega] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([vacia()]);
  const [medio, setMedio] = useState('');
  const [tarjetaId, setTarjetaId] = useState('');
  const [pagoInicial, setPagoInicial] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const { datos } = useData('catalogos_venta', async () => {
    const [clientes, categorias, tarjetas] = await Promise.all([
      q<any[]>(supabase.from('clientes').select('id,nombre').eq('activo', true).is('deleted_at', null).order('nombre')),
      q<any[]>(supabase.from('categorias').select('*').eq('activa', true).order('nombre')),
      q<any[]>(supabase.from('tarjetas').select('*').eq('activa', true).order('nombre')),
    ]);
    return { clientes, categorias, tarjetas };
  });
  const cat = datos?.categorias.find(c => c.id === categoriaId);
  const esParches = Boolean(cat?.genera_pedido);

  const setL = (i: number, k: keyof Linea, v: string) => setLineas(ls => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const totPrecio = lineas.reduce((s, l) => s + num(l.cantidad) * num(l.precio), 0);
  const totCosto = lineas.reduce((s, l) => s + num(l.cantidad) * num(l.costo), 0);

  async function guardar() {
    setError('');
    if (!clienteId) return setError('Elige el cliente');
    if (!categoriaId) return setError('Elige la categoría');
    const validas = lineas.filter(l => l.descripcion.trim() || num(l.precio) > 0);
    if (!validas.length) return setError('Agrega al menos un producto');
    if (validas.some(l => !l.descripcion.trim() || num(l.precio) <= 0 || num(l.cantidad) <= 0)) return setError('Cada producto necesita descripción, cantidad y precio');
    if (num(pagoInicial) > totPrecio) return setError('El pago inicial es mayor que el total');
    setGuardando(true);
    try {
      const r = await llamar('crear_venta', {
        p_id: uuid(), p_cliente_id: clienteId, p_categoria_id: categoriaId, p_fecha: fecha,
        p_fecha_promesa: promesa || null, p_fecha_entrega: entrega || null, p_notas: null,
        p_lineas: validas.map(l => ({
          descripcion: l.descripcion.trim(), cantidad: num(l.cantidad), costo_unitario: num(l.costo), precio_unitario: num(l.precio),
          medio_compra: medio, tarjeta_id: medio === 'tarjeta' ? tarjetaId : '',
        })),
        p_pago_inicial: num(pagoInicial), p_pago_metodo: 'efectivo', p_pago_id: uuid(),
      });
      if (r.enCola) alert('Sin internet: la venta quedó guardada y se enviará al reconectar.');
      nav(`/clientes/${clienteId}`);
    } catch (e: any) { setError(e.message); setGuardando(false); }
  }

  return (
    <div className="space-y-4">
      <Titulo atras="/">Nueva venta</Titulo>
      <Campo etiqueta="Cliente">
        <Selector value={clienteId} onChange={e => setClienteId(e.target.value)}>
          <option value="">— Elegir —</option>
          {datos?.clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Selector>
      </Campo>

      <div>
        <span className="block font-bold mb-1">Categoría</span>
        <div className="grid grid-cols-2 gap-2">
          {datos?.categorias.map(c => (
            <button key={c.id} onClick={() => setCategoriaId(c.id)}
              className={`min-h-14 rounded-2xl font-bold text-lg border-2 ${categoriaId === c.id ? 'bg-marca text-white border-marca' : 'bg-white border-slate-300'}`}>{c.nombre}</button>
          ))}
        </div>
      </div>

      <Campo etiqueta="Fecha"><Entrada type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></Campo>

      <h2 className="text-xl font-extrabold">Productos</h2>
      {lineas.map((l, i) => (
        <Tarjeta key={i} className="space-y-3">
          <Campo etiqueta="¿Qué se llevó?"><Entrada placeholder="Ej. Tenis Nike #26 negro" value={l.descripcion} onChange={e => setL(i, 'descripcion', e.target.value)} /></Campo>
          <div className="grid grid-cols-3 gap-2">
            <Campo etiqueta="Cantidad"><Entrada inputMode="decimal" value={l.cantidad} onChange={e => setL(i, 'cantidad', e.target.value)} /></Campo>
            <Campo etiqueta="Me costó"><Entrada inputMode="decimal" placeholder="$" value={l.costo} onChange={e => setL(i, 'costo', e.target.value)} /></Campo>
            <Campo etiqueta="Cobro"><Entrada inputMode="decimal" placeholder="$" value={l.precio} onChange={e => setL(i, 'precio', e.target.value)} /></Campo>
          </div>
          {esParches && (
            <div className="grid grid-cols-2 gap-2">
              {[8, 10].map(p => <Boton key={p} tono={num(l.precio) === p ? 'marca' : 'borde'} onClick={() => setL(i, 'precio', String(p))}>${p}</Boton>)}
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-green-700 font-bold">Ganancia: {dinero(num(l.cantidad) * (num(l.precio) - num(l.costo)))}</span>
            {lineas.length > 1 && <button className="text-red-600 font-bold p-2" onClick={() => setLineas(ls => ls.filter((_, j) => j !== i))}>Quitar</button>}
          </div>
        </Tarjeta>
      ))}
      <Boton tono="borde" className="w-full" onClick={() => setLineas(ls => [...ls, vacia()])}>➕ Otro producto</Boton>

      <Tarjeta className="bg-slate-50 space-y-1">
        <div className="flex justify-between text-xl"><span>Total a cobrar</span><b>{dinero(totPrecio)}</b></div>
        <div className="flex justify-between text-green-700 text-xl"><span>Mi ganancia</span><b>{dinero(totPrecio - totCosto)}</b></div>
      </Tarjeta>

      <Campo etiqueta="Pagué con (opcional)">
        <Selector value={medio} onChange={e => setMedio(e.target.value)}>
          <option value="">—</option><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option>
        </Selector>
      </Campo>
      {medio === 'tarjeta' && (
        <Campo etiqueta="¿Cuál tarjeta?">
          <Selector value={tarjetaId} onChange={e => setTarjetaId(e.target.value)}>
            <option value="">—</option>{datos?.tarjetas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </Selector>
        </Campo>
      )}
      <Campo etiqueta="¿Pagó algo ahora? (opcional)"><Entrada inputMode="decimal" placeholder="$0.00" value={pagoInicial} onChange={e => setPagoInicial(e.target.value)} /></Campo>
      <Campo etiqueta="¿Cuándo dice que paga? (opcional)"><Entrada type="date" value={promesa} onChange={e => setPromesa(e.target.value)} /></Campo>
      {esParches && <Campo etiqueta="Fecha de entrega"><Entrada type="date" value={entrega} onChange={e => setEntrega(e.target.value)} /></Campo>}

      {error && <Aviso>{error}</Aviso>}
      <Boton tono="verde" className="w-full" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : '✔ Guardar venta'}</Boton>
    </div>
  );
}
