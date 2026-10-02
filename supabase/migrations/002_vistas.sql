-- =====================================================================
-- Vistas de cálculo (los totales NUNCA se guardan)
-- security_invoker = el RLS del usuario que consulta aplica (ayudante => vacío)
-- =====================================================================

create or replace view v_ventas_resumen with (security_invoker = true) as
select
  v.id as venta_id, v.cliente_id, c.nombre as cliente_nombre,
  v.categoria_id, cat.nombre as categoria_nombre,
  v.fecha, v.fecha_promesa_pago, v.fecha_entrega, v.notas,
  coalesce(l.total_precio,0)::numeric(14,2) as total_precio,
  coalesce(l.total_costo,0)::numeric(14,2)  as total_costo,
  coalesce(l.ganancia,0)::numeric(14,2)     as ganancia,
  coalesce(p.pagado,0)::numeric(14,2)       as total_pagado,
  greatest(coalesce(l.total_precio,0) - coalesce(p.pagado,0), 0)::numeric(14,2) as saldo_pendiente,
  case
    when coalesce(p.pagado,0) = 0 then 'pendiente'
    when coalesce(p.pagado,0) < coalesce(l.total_precio,0) then 'parcial'
    else 'pagada'
  end as estado_cobro,
  case
    when v.fecha_promesa_pago is not null
     and v.fecha_promesa_pago < current_date
     and coalesce(l.total_precio,0) > coalesce(p.pagado,0)
    then (current_date - v.fecha_promesa_pago)
    else 0
  end as dias_de_atraso
from ventas v
join clientes c on c.id = v.cliente_id
join categorias cat on cat.id = v.categoria_id
left join (
  select venta_id, sum(total_precio) total_precio, sum(total_costo) total_costo, sum(ganancia) ganancia
    from venta_lineas group by venta_id
) l on l.venta_id = v.id
left join (
  select a.venta_id, sum(a.monto) pagado
    from pago_aplicaciones a join pagos pg on pg.id = a.pago_id
   where pg.deleted_at is null group by a.venta_id
) p on p.venta_id = v.id
where v.deleted_at is null;

create or replace view v_saldo_cliente with (security_invoker = true) as
select
  c.id as cliente_id, c.nombre, c.telefono, c.direccion, c.activo,
  coalesce(vt.total_vendido,0)::numeric(14,2) as total_vendido,
  coalesce(pg.total_pagado,0)::numeric(14,2)  as total_pagado,
  greatest(coalesce(vt.total_vendido,0) - coalesce(pg.total_pagado,0), 0)::numeric(14,2) as saldo_pendiente,
  greatest(coalesce(pg.total_pagado,0) - coalesce(vt.total_vendido,0), 0)::numeric(14,2) as saldo_a_favor,
  vt.ultima_compra, pg.ultimo_pago, vt.mas_antigua_pendiente, vt.proxima_promesa
from clientes c
left join (
  select cliente_id, sum(total_precio) total_vendido, max(fecha) ultima_compra,
         min(fecha) filter (where saldo_pendiente > 0) mas_antigua_pendiente,
         min(fecha_promesa_pago) filter (where saldo_pendiente > 0) proxima_promesa
    from v_ventas_resumen group by cliente_id
) vt on vt.cliente_id = c.id
left join (
  select cliente_id, sum(monto) total_pagado, max(fecha) ultimo_pago
    from pagos where deleted_at is null group by cliente_id
) pg on pg.cliente_id = c.id
where c.deleted_at is null;

create or replace view v_ganancia_por_categoria with (security_invoker = true) as
select
  categoria_id, categoria_nombre,
  date_trunc('month', fecha)::date as mes,
  count(*) as num_ventas,
  sum(total_precio) as ventas_totales,
  sum(total_costo)  as costo_total,
  sum(ganancia)     as ganancia,
  sum(case when total_precio > 0 then ganancia * least(1, total_pagado / total_precio) else 0 end)::numeric(14,2) as ganancia_cobrada
from v_ventas_resumen
group by categoria_id, categoria_nombre, date_trunc('month', fecha);

create or replace view v_costos_por_medio with (security_invoker = true) as
select
  date_trunc('month', v.fecha)::date as mes,
  coalesce(l.medio_compra, 'sin_dato') as medio_compra,
  t.nombre as tarjeta,
  sum(l.total_costo)::numeric(14,2) as costo
from venta_lineas l
join ventas v on v.id = l.venta_id and v.deleted_at is null
left join tarjetas t on t.id = l.tarjeta_id
group by 1, 2, 3;

-- Cocina: líneas pendientes (el cliente agrupa por precio y por cliente)
create or replace view v_cocina_pendiente with (security_invoker = true) as
select
  l.id as linea_id, v.id as venta_id, v.cliente_id, c.nombre as cliente_nombre,
  l.descripcion, l.cantidad, l.precio_unitario, v.fecha_entrega, v.fecha
from venta_lineas l
join ventas v on v.id = l.venta_id and v.deleted_at is null
join clientes c on c.id = v.cliente_id
where l.estado_pedido = 'pendiente';

-- Entregas: ÚNICA fuente del ayudante. Corre con permisos del dueño de la vista
-- (por eso filtra por rol). SIN costos, SIN ganancias, SIN saldos.
create or replace view v_entregas as
select
  l.id as linea_id, v.id as venta_id, v.cliente_id,
  c.nombre as cliente_nombre, c.direccion, c.telefono,
  l.descripcion, l.cantidad, l.precio_unitario, l.total_precio as total_a_cobrar_linea,
  v.fecha_entrega, l.preparado_at
from venta_lineas l
join ventas v on v.id = l.venta_id and v.deleted_at is null
join clientes c on c.id = v.cliente_id
where l.estado_pedido = 'preparado'
  and (es_admin() or es_ayudante());
