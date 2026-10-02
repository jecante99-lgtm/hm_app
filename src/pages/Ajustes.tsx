import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useData, q } from '../lib/offline';
import { descargar } from '../lib/format';
import { Boton, Entrada, Tarjeta, Titulo } from '../components/ui';

export default function Ajustes() {
  const [cat, setCat] = useState('');
  const [tar, setTar] = useState('');
  const { datos, recargar } = useData('ajustes', async () => ({
    categorias: await q<any[]>(supabase.from('categorias').select('*').order('nombre')),
    tarjetas: await q<any[]>(supabase.from('tarjetas').select('*').order('nombre')),
  }));

  const run = async (p: PromiseLike<{ error: any }>) => { const { error } = await p; if (error) alert(error.message); recargar(); };

  async function respaldo() {
    const tablas = ['clientes', 'categorias', 'tarjetas', 'ventas', 'venta_lineas', 'pagos', 'pago_aplicaciones'];
    const out: Record<string, unknown> = {};
    for (const t of tablas) out[t] = await q(supabase.from(t).select('*'));
    descargar(`respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out, null, 2), 'application/json');
  }

  return (
    <div className="space-y-4">
      <Titulo atras="/mas">Ajustes</Titulo>

      <h2 className="text-xl font-extrabold">Categorías</h2>
      {datos?.categorias.map(c => (
        <Tarjeta key={c.id} className="space-y-2">
          <b className="text-lg">{c.nombre}</b>
          <div className="grid grid-cols-2 gap-2">
            <Boton tono={c.genera_pedido ? 'marca' : 'borde'} className="!text-base" onClick={() => run(supabase.from('categorias').update({ genera_pedido: !c.genera_pedido }).eq('id', c.id))}>{c.genera_pedido ? 'Con pedidos ✔' : 'Sin pedidos'}</Boton>
            <Boton tono={c.activa ? 'gris' : 'rojo'} className="!text-base" onClick={() => run(supabase.from('categorias').update({ activa: !c.activa }).eq('id', c.id))}>{c.activa ? 'Activa' : 'Desactivada'}</Boton>
          </div>
        </Tarjeta>
      ))}
      <div className="flex gap-2"><Entrada placeholder="Nueva categoría" value={cat} onChange={e => setCat(e.target.value)} />
        <Boton onClick={() => cat.trim() && run(supabase.from('categorias').insert({ nombre: cat.trim() })).then(() => setCat(''))}>➕</Boton></div>

      <h2 className="text-xl font-extrabold">Tarjetas de crédito</h2>
      {datos?.tarjetas.map(t => (
        <Tarjeta key={t.id} className="flex justify-between items-center">
          <b className="text-lg">{t.nombre}</b>
          <Boton tono={t.activa ? 'gris' : 'rojo'} onClick={() => run(supabase.from('tarjetas').update({ activa: !t.activa }).eq('id', t.id))}>{t.activa ? 'Activa' : 'Desactivada'}</Boton>
        </Tarjeta>
      ))}
      <div className="flex gap-2"><Entrada placeholder="Nueva tarjeta (ej. BBVA)" value={tar} onChange={e => setTar(e.target.value)} />
        <Boton onClick={() => tar.trim() && run(supabase.from('tarjetas').insert({ nombre: tar.trim() })).then(() => setTar(''))}>➕</Boton></div>

      <h2 className="text-xl font-extrabold">Respaldo</h2>
      <Boton tono="gris" className="w-full" onClick={respaldo}>⬇ Descargar respaldo completo</Boton>
    </div>
  );
}
