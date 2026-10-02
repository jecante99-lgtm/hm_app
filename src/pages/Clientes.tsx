import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useData, q } from '../lib/offline';
import { dinero } from '../lib/format';
import { Boton, Campo, Entrada, Tarjeta, Titulo, Aviso, Cargando } from '../components/ui';

export default function Clientes() {
  const [params] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [nuevo, setNuevo] = useState(params.get('nuevo') === '1');
  const { datos, cargando, recargar } = useData('clientes', () =>
    q<any[]>(supabase.from('v_saldo_cliente').select('*').eq('activo', true).order('nombre')));

  const lista = (datos ?? []).filter(c => {
    const t = busca.trim().toLowerCase();
    return !t || c.nombre.toLowerCase().includes(t) || (c.telefono ?? '').includes(t);
  });

  return (
    <div className="space-y-3">
      <Titulo>Clientes</Titulo>
      <Entrada placeholder="🔍 Buscar por nombre o teléfono" value={busca} onChange={e => setBusca(e.target.value)} />
      <Boton className="w-full" tono={nuevo ? 'gris' : 'verde'} onClick={() => setNuevo(!nuevo)}>{nuevo ? 'Cerrar' : '➕ Nuevo cliente'}</Boton>
      {nuevo && <FormCliente alGuardar={() => { setNuevo(false); recargar(); }} />}
      {cargando && !datos && <Cargando />}
      {lista.map(c => (
        <Link key={c.cliente_id} to={`/clientes/${c.cliente_id}`}>
          <Tarjeta className="mb-3 flex justify-between items-center">
            <div><div className="text-xl font-bold">{c.nombre}</div><div className="text-slate-500">{c.telefono}</div></div>
            <div className="text-right">
              {c.saldo_pendiente > 0 ? <div className="text-red-700 font-extrabold text-xl">{dinero(c.saldo_pendiente)}</div>
                : c.saldo_a_favor > 0 ? <div className="text-green-700 font-bold">A favor {dinero(c.saldo_a_favor)}</div>
                : <div className="text-green-700 font-bold">Al corriente</div>}
            </div>
          </Tarjeta>
        </Link>
      ))}
      {!cargando && !lista.length && <p className="text-center text-slate-500">No hay clientes.</p>}
    </div>
  );
}

export function FormCliente({ cliente, alGuardar }: { cliente?: any; alGuardar: () => void }) {
  const [f, setF] = useState({ nombre: cliente?.nombre ?? '', telefono: cliente?.telefono ?? '', direccion: cliente?.direccion ?? '', notas: cliente?.notas ?? '' });
  const [error, setError] = useState('');
  async function guardar() {
    if (!f.nombre.trim()) return setError('Escribe el nombre');
    const datos = { nombre: f.nombre.trim(), telefono: f.telefono.trim() || null, direccion: f.direccion.trim() || null, notas: f.notas.trim() || null };
    const r = cliente
      ? await supabase.from('clientes').update(datos).eq('id', cliente.id)
      : await supabase.from('clientes').insert(datos);
    if (r.error) return setError(r.error.message);
    alGuardar();
  }
  return (
    <Tarjeta className="space-y-3">
      <Campo etiqueta="Nombre"><Entrada value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} /></Campo>
      <Campo etiqueta="Teléfono"><Entrada type="tel" value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} /></Campo>
      <Campo etiqueta="Dirección"><Entrada value={f.direccion} onChange={e => setF({ ...f, direccion: e.target.value })} /></Campo>
      <Campo etiqueta="Notas"><Entrada value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} /></Campo>
      {error && <Aviso>{error}</Aviso>}
      <Boton className="w-full" onClick={guardar}>Guardar</Boton>
    </Tarjeta>
  );
}
