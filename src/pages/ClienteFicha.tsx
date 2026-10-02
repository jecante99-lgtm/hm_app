import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useData, q, llamar } from '../lib/offline';
import { dinero, fechaCorta, whatsappUrl } from '../lib/format';
import { Boton, BotonLink, Tarjeta, Titulo, Etiqueta, Cargando, Confirmar } from '../components/ui';
import { FormCliente } from './Clientes';

export default function ClienteFicha() {
  const { id } = useParams();
  const nav = useNavigate();
  const [editando, setEditando] = useState(false);
  const { datos, cargando, recargar } = useData(`cliente_${id}`, async () => {
    const [saldo, cli, ventas, pagos] = await Promise.all([
      q<any[]>(supabase.from('v_saldo_cliente').select('*').eq('cliente_id', id!)),
      q<any[]>(supabase.from('clientes').select('*').eq('id', id!)),
      q<any[]>(supabase.from('v_ventas_resumen').select('*').eq('cliente_id', id!).order('fecha', { ascending: false })),
      q<any[]>(supabase.from('pagos').select('*').eq('cliente_id', id!).is('deleted_at', null).order('fecha', { ascending: false })),
    ]);
    return { saldo: saldo[0], cli: cli[0], ventas, pagos };
  }, [id]);

  if (cargando && !datos) return <Cargando />;
  if (!datos?.cli) return <p>No se encontró el cliente.</p>;
  const { saldo, cli, ventas, pagos } = datos;
  const debe = Number(saldo?.saldo_pendiente ?? 0);

  const msg = `Hola ${cli.nombre}, te recuerdo que tienes un saldo pendiente de ${dinero(debe)}. ` +
    (ventas.filter((v: any) => v.saldo_pendiente > 0).map((v: any) => `${v.categoria_nombre} (${fechaCorta(v.fecha)}): ${dinero(v.saldo_pendiente)}`).join('; ')) + '. ¡Gracias!';

  async function anularVenta(vid: string) {
    try { await llamar('anular_venta', { p_id: vid }); recargar(); } catch (e: any) { alert(e.message); }
  }
  async function anularPago(pid: string) {
    try { await llamar('anular_pago', { p_id: pid }); recargar(); } catch (e: any) { alert(e.message); }
  }
  async function desactivar() {
    await supabase.from('clientes').update({ activo: false }).eq('id', id!);
    nav('/clientes');
  }

  return (
    <div className="space-y-4">
      <Titulo atras="/clientes">{cli.nombre}</Titulo>

      <Tarjeta className={debe > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}>
        <div className="text-lg">{debe > 0 ? 'Me debe' : Number(saldo?.saldo_a_favor) > 0 ? 'Saldo a favor' : 'Al corriente'}</div>
        <div className="text-4xl font-extrabold">{dinero(debe > 0 ? debe : saldo?.saldo_a_favor)}</div>
      </Tarjeta>

      <div className="grid grid-cols-2 gap-3">
        <BotonLink to={`/venta/nueva?cliente=${id}`} tono="verde">➕ Nueva venta</BotonLink>
        <BotonLink to={`/pago/nuevo?cliente=${id}`}>💵 Registrar pago</BotonLink>
        {cli.telefono && <a href={`tel:${cli.telefono}`} className="min-h-14 rounded-2xl bg-slate-200 font-bold text-lg flex items-center justify-center">📞 Llamar</a>}
        {cli.telefono && <a href={whatsappUrl(cli.telefono, debe > 0 ? msg : `Hola ${cli.nombre}`)} target="_blank" rel="noreferrer" className="min-h-14 rounded-2xl bg-green-600 text-white font-bold text-lg flex items-center justify-center">💬 WhatsApp</a>}
      </div>

      <Tarjeta>
        <div>📞 {cli.telefono || '—'}</div>
        <div>📍 {cli.direccion || '—'}</div>
        {cli.notas && <div>📝 {cli.notas}</div>}
        <Boton tono="gris" className="w-full mt-3" onClick={() => setEditando(!editando)}>{editando ? 'Cerrar' : '✏️ Editar datos'}</Boton>
      </Tarjeta>
      {editando && <FormCliente cliente={cli} alGuardar={() => { setEditando(false); recargar(); }} />}

      <h2 className="text-xl font-extrabold">Compras</h2>
      {ventas.map((v: any) => (
        <Tarjeta key={v.venta_id} className="space-y-1">
          <div className="flex justify-between items-center">
            <b className="text-lg">{v.categoria_nombre} · {fechaCorta(v.fecha)}</b>
            <Etiqueta estado={v.estado_cobro} />
          </div>
          <div className="flex justify-between"><span>Total</span><b>{dinero(v.total_precio)}</b></div>
          <div className="flex justify-between"><span>Pagado</span><b>{dinero(v.total_pagado)}</b></div>
          <div className="flex justify-between text-red-700"><span>Falta</span><b>{dinero(v.saldo_pendiente)}</b></div>
          <div className="flex justify-between text-slate-500"><span>Ganancia</span><span>{dinero(v.ganancia)}</span></div>
          {v.dias_de_atraso > 0 && <div className="text-red-700 font-bold">⚠ Pago vencido hace {v.dias_de_atraso} días</div>}
          <Confirmar tono="gris" texto={v.total_pagado > 0 ? 'Esta venta ya tiene pagos aplicados. ¿Eliminarla de todos modos?' : '¿Eliminar esta venta?'} onSi={() => anularVenta(v.venta_id)}>🗑 Eliminar venta</Confirmar>
        </Tarjeta>
      ))}
      {!ventas.length && <p className="text-slate-500">Sin compras.</p>}

      <h2 className="text-xl font-extrabold">Pagos</h2>
      {pagos.map((p: any) => (
        <Tarjeta key={p.id} className="flex justify-between items-center">
          <div><b className="text-lg">{dinero(p.monto)}</b><div className="text-slate-500">{fechaCorta(p.fecha)} · {p.metodo}</div></div>
          <Confirmar tono="gris" texto="¿Eliminar este pago?" onSi={() => anularPago(p.id)}>🗑</Confirmar>
        </Tarjeta>
      ))}
      {!pagos.length && <p className="text-slate-500">Sin pagos.</p>}

      <Confirmar tono="gris" texto="¿Desactivar este cliente?" onSi={desactivar}>Desactivar cliente</Confirmar>
    </div>
  );
}
