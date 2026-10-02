import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { uuid } from '../lib/format';
import { Boton, Entrada, Tarjeta, Aviso } from './ui';

/** Botón + mini formulario para crear un cliente sin salir de la venta. */
export default function ClienteRapido({ alCrear }: { alCrear: (id: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!nombre.trim()) return setError('Escribe el nombre');
    setGuardando(true); setError('');
    const id = uuid();
    const { error } = await supabase.from('clientes').insert({
      id, nombre: nombre.trim(), telefono: telefono.trim() || null, direccion: direccion.trim() || null,
    });
    setGuardando(false);
    if (error) return setError(navigator.onLine ? error.message : 'Sin internet: para crear un cliente nuevo necesitas conexión');
    setNombre(''); setTelefono(''); setDireccion(''); setAbierto(false);
    alCrear(id);
  }

  if (!abierto) return <Boton tono="borde" className="w-full" onClick={() => setAbierto(true)}>👤 Agregar cliente nuevo</Boton>;
  return (
    <Tarjeta className="space-y-3 border-2 border-marca">
      <b className="text-lg">Cliente nuevo</b>
      <Entrada placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
      <Entrada type="tel" placeholder="Teléfono (opcional)" value={telefono} onChange={e => setTelefono(e.target.value)} />
      <Entrada placeholder="Dirección (opcional)" value={direccion} onChange={e => setDireccion(e.target.value)} />
      {error && <Aviso>{error}</Aviso>}
      <div className="grid grid-cols-2 gap-2">
        <Boton tono="gris" onClick={() => setAbierto(false)}>Cancelar</Boton>
        <Boton tono="verde" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</Boton>
      </div>
    </Tarjeta>
  );
}
