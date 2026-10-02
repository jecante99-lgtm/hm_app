import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { q, llamar } from '../lib/offline';
import { dinero } from '../lib/format';
import { Boton, Campo, Entrada, Tarjeta, Titulo, Aviso, Cargando, Confirmar } from '../components/ui';
import { Contador, PRECIO, VARIANTES } from '../components/ContadorPaches';

type Linea = { id: string; descripcion: string; cantidad: number; precio_unitario: number; costo_unitario: number; estado_pedido: string | null };
const nombreDe = (d: string) => d.replace(/^Paches\s*/i, '').trim() || 'Paches';
const ESTADO: Record<string, string> = { pendiente: 'por preparar', preparado: 'preparado', entregado: '✔ entregado' };

export default function EditarPedido() {
  const { id } = useParams();
  const nav = useNavigate();
  const [cargando, setCargando] = useState(true);
  const [cliente, setCliente] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [cant, setCant] = useState<Record<string, number>>({}); // clave: id de línea o "nuevo:<clase>"
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [v, l] = await Promise.all([
          q<any[]>(supabase.from('ventas').select('notas,clientes(nombre)').eq('id', id!)),
          q<Linea[]>(supabase.from('venta_lineas').select('id,descripcion,cantidad,precio_unitario,costo_unitario,estado_pedido').eq('venta_id', id!).order('created_at')),
        ]);
        setCliente(v[0]?.clientes?.nombre ?? ''); setNota(v[0]?.notas ?? '');
        const ls = l.map(x => ({ ...x, cantidad: Number(x.cantidad), precio_unitario: Number(x.precio_unitario), costo_unitario: Number(x.costo_unitario) }));
        setLineas(ls);
        setCant(Object.fromEntries(ls.map(x => [x.id, x.cantidad])));
      } catch (e: any) { setError(e.message); }
      setCargando(false);
    })();
  }, [id]);

  const cambiar = (k: string, d: number) => setCant(c => ({ ...c, [k]: Math.max(0, (c[k] ?? 0) + d) }));
  const existentes = new Set(lineas.map(l => nombreDe(l.descripcion)));
  const nuevas = VARIANTES.filter(v => !existentes.has(v.clave));

  const total =
    lineas.reduce((t, l) => t + (cant[l.id] ?? 0) * l.precio_unitario, 0) +
    nuevas.reduce((t, v) => t + (cant[`nuevo:${v.clave}`] ?? 0) * PRECIO, 0);
  const piezas =
    lineas.reduce((t, l) => t + (cant[l.id] ?? 0), 0) + nuevas.reduce((t, v) => t + (cant[`nuevo:${v.clave}`] ?? 0), 0);

  async function guardar() {
    setError('');
    if (piezas <= 0) return setError('El pedido no puede quedar en cero. Para borrarlo usa "Eliminar pedido".');
    setGuardando(true);
    try {
      for (const l of lineas) {
        if (l.estado_pedido === 'entregado') continue;
        const n = cant[l.id] ?? 0;
        if (n === l.cantidad) continue;
        const r = n > 0
          ? await supabase.from('venta_lineas').update({ cantidad: n }).eq('id', l.id)
          : await supabase.from('venta_lineas').delete().eq('id', l.id);
        if (r.error) throw new Error(r.error.message);
      }
      const nuevasLineas = nuevas.filter(v => (cant[`nuevo:${v.clave}`] ?? 0) > 0).map(v => ({
        venta_id: id, descripcion: `Paches ${v.clave}`, cantidad: cant[`nuevo:${v.clave}`], costo_unitario: 0, precio_unitario: PRECIO,
      }));
      if (nuevasLineas.length) {
        const r = await supabase.from('venta_lineas').insert(nuevasLineas);
        if (r.error) throw new Error(r.error.message);
      }
      const r = await supabase.from('ventas').update({ notas: nota.trim() || null }).eq('id', id!);
      if (r.error) throw new Error(r.error.message);
      window.dispatchEvent(new Event('datos-cambiaron'));
      nav('/paches');
    } catch (e: any) {
      setError(navigator.onLine ? e.message : 'Sin internet: para modificar un pedido necesitas conexión');
      setGuardando(false);
    }
  }

  async function eliminar() {
    try { await llamar('anular_venta', { p_id: id }); nav('/paches'); } catch (e: any) { setError(e.message); }
  }

  if (cargando) return <Cargando />;
  if (!lineas.length) return <div className="space-y-3"><Titulo atras="/paches">Pedido</Titulo><Aviso>{error || 'No se encontró el pedido.'}</Aviso></div>;

  return (
    <div className="space-y-4">
      <Titulo atras="/paches">✏️ Modificar pedido</Titulo>
      <Tarjeta><div className="text-slate-600">Cliente</div><div className="text-2xl font-extrabold">{cliente}</div></Tarjeta>

      <div className="grid grid-cols-2 gap-2">
        {lineas.map(l => {
          const nombre = nombreDe(l.descripcion);
          const v = VARIANTES.find(x => x.clave === nombre);
          return <Contador key={l.id} icono={v?.icono} nombre={nombre} n={cant[l.id] ?? 0} precio={l.precio_unitario}
            bloqueado={l.estado_pedido === 'entregado'} nota={l.estado_pedido ? ESTADO[l.estado_pedido] : undefined} onCambio={d => cambiar(l.id, d)} />;
        })}
        {nuevas.map(v => <Contador key={v.clave} icono={v.icono} nombre={v.clave} n={cant[`nuevo:${v.clave}`] ?? 0} onCambio={d => cambiar(`nuevo:${v.clave}`, d)} />)}
      </div>

      <Campo etiqueta="Nota del pedido (opcional)"><Entrada value={nota} onChange={e => setNota(e.target.value)} /></Campo>

      <Tarjeta className="bg-slate-50">
        <div className="flex justify-between text-xl"><span>Total de paches</span><b>{piezas}</b></div>
        <div className="flex justify-between text-xl"><span>A cobrar</span><b>{dinero(total)}</b></div>
      </Tarjeta>

      {error && <Aviso>{error}</Aviso>}
      <Boton tono="verde" className="w-full" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : '✔ Guardar cambios'}</Boton>
      <Confirmar tono="gris" texto={`¿Eliminar todo el pedido de ${cliente}?`} onSi={eliminar}>🗑 Eliminar pedido</Confirmar>
    </div>
  );
}
