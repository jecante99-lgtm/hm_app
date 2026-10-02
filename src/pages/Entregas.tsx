import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useData, q, llamar } from '../lib/offline';
import { dinero, fechaCorta } from '../lib/format';
import { Boton, Tarjeta, Titulo, Cargando } from '../components/ui';

export default function Entregas() {
  const { perfil, salir } = useAuth();
  const esAdmin = perfil?.rol === 'admin';
  const { datos, cargando, recargar } = useData('entregas', () =>
    q<any[]>(supabase.from('v_entregas').select('*').order('fecha_entrega', { nullsFirst: false })));
  if (cargando && !datos) return <Cargando />;

  const grupos: Record<string, { c: any; lineas: any[] }> = {};
  (datos ?? []).forEach(l => { (grupos[l.cliente_id] ??= { c: l, lineas: [] }).lineas.push(l); });

  async function entregar(id: string) { await llamar('marcar_entregado', { p_linea_id: id }); recargar(); }
  async function regresar(id: string) { await llamar('cambiar_estado_lineas', { p_ids: [id], p_estado: 'pendiente' }); recargar(); }

  return (
    <div className="space-y-3">
      <Titulo atras={esAdmin ? '/paches' : undefined}>Por entregar</Titulo>
      {Object.entries(grupos).map(([cid, g]) => (
        <Tarjeta key={cid} className="space-y-2">
          <b className="text-2xl">{g.c.cliente_nombre}</b>
          {g.c.direccion && <div className="text-lg">📍 {g.c.direccion}</div>}
          {g.c.telefono && <a href={`tel:${g.c.telefono}`} className="block text-lg text-marca font-bold">📞 {g.c.telefono}</a>}
          {g.lineas.map(l => (
            <div key={l.linea_id} className="border-t pt-3 space-y-2">
              <div className="text-xl font-semibold">{l.cantidad} × {l.descripcion}</div>
              <div className="text-slate-600">Cobrar {dinero(l.total_a_cobrar_linea)}{l.fecha_entrega ? ` · Entrega ${fechaCorta(l.fecha_entrega)}` : ""}</div>
              <Boton tono="verde" className="w-full !min-h-16 !text-xl" onClick={() => entregar(l.linea_id)}>✔ Marcar entregado</Boton>
              {esAdmin && <Boton tono="gris" className="w-full" onClick={() => regresar(l.linea_id)}>↩ Regresar a pendiente</Boton>}
            </div>
          ))}
        </Tarjeta>
      ))}
      {!cargando && !(datos ?? []).length && <p className="text-center text-slate-500 py-8 text-xl">No hay nada por entregar.</p>}
      {!esAdmin && <Boton tono="gris" className="w-full mt-6" onClick={salir}>Cerrar sesión</Boton>}
    </div>
  );
}
