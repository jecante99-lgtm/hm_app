-- =====================================================================
-- Funciones RPC + seguridad (RLS)
-- =====================================================================

-- Crear venta completa (idempotente por id, apta para cola offline)
create or replace function crear_venta(
  p_id uuid, p_cliente_id uuid, p_categoria_id uuid, p_fecha date,
  p_fecha_promesa date, p_fecha_entrega date, p_notas text,
  p_lineas jsonb,
  p_pago_inicial numeric default 0, p_pago_metodo text default 'efectivo', p_pago_id uuid default null
) returns uuid
language plpgsql security invoker as $$
declare l jsonb; v_total numeric; v_pid uuid;
begin
  if not es_admin() then raise exception 'Solo la administradora puede crear ventas'; end if;
  if exists (select 1 from ventas where id = p_id) then return p_id; end if;

  insert into ventas (id, cliente_id, categoria_id, fecha, fecha_promesa_pago, fecha_entrega, notas)
  values (p_id, p_cliente_id, p_categoria_id, coalesce(p_fecha, current_date), p_fecha_promesa, p_fecha_entrega, p_notas);

  for l in select * from jsonb_array_elements(p_lineas) loop
    insert into venta_lineas (venta_id, descripcion, cantidad, costo_unitario, precio_unitario, medio_compra, tarjeta_id)
    values (p_id, l->>'descripcion', coalesce((l->>'cantidad')::numeric,1),
            coalesce((l->>'costo_unitario')::numeric,0), (l->>'precio_unitario')::numeric,
            nullif(l->>'medio_compra',''), nullif(l->>'tarjeta_id','')::uuid);
  end loop;

  if coalesce(p_pago_inicial,0) > 0 then
    select coalesce(sum(total_precio),0) into v_total from venta_lineas where venta_id = p_id;
    v_pid := coalesce(p_pago_id, gen_random_uuid());
    insert into pagos (id, cliente_id, fecha, monto, metodo, notas)
    values (v_pid, p_cliente_id, coalesce(p_fecha, current_date), p_pago_inicial, p_pago_metodo, 'Pago inicial de la venta');
    insert into pago_aplicaciones (pago_id, venta_id, monto)
    values (v_pid, p_id, least(p_pago_inicial, v_total));
  end if;
  return p_id;
end $$;

-- Registrar pago. p_aplicaciones = [{venta_id, monto}] o null => FIFO (más antiguas primero)
create or replace function registrar_pago(
  p_id uuid, p_cliente_id uuid, p_fecha date, p_monto numeric,
  p_metodo text, p_notas text, p_aplicaciones jsonb default null
) returns uuid
language plpgsql security invoker as $$
declare r record; a jsonb; v_resto numeric; v_aplica numeric;
begin
  if not es_admin() then raise exception 'Solo la administradora puede registrar pagos'; end if;
  if exists (select 1 from pagos where id = p_id) then return p_id; end if;

  insert into pagos (id, cliente_id, fecha, monto, metodo, notas)
  values (p_id, p_cliente_id, coalesce(p_fecha, current_date), p_monto, p_metodo, p_notas);

  if p_aplicaciones is not null and jsonb_typeof(p_aplicaciones) = 'array' and jsonb_array_length(p_aplicaciones) > 0 then
    for a in select * from jsonb_array_elements(p_aplicaciones) loop
      if (a->>'monto')::numeric > 0 then
        insert into pago_aplicaciones (pago_id, venta_id, monto)
        values (p_id, (a->>'venta_id')::uuid, (a->>'monto')::numeric);
      end if;
    end loop;
  else
    v_resto := p_monto;
    for r in
      select venta_id, saldo_pendiente from v_ventas_resumen
       where cliente_id = p_cliente_id and saldo_pendiente > 0
       order by fecha, venta_id
    loop
      exit when v_resto <= 0;
      v_aplica := least(v_resto, r.saldo_pendiente);
      insert into pago_aplicaciones (pago_id, venta_id, monto) values (p_id, r.venta_id, v_aplica);
      v_resto := v_resto - v_aplica;
    end loop;
    -- si sobra, queda como saldo a favor del cliente
  end if;
  return p_id;
end $$;

-- Eliminar (lógico) un pago o una venta
create or replace function anular_pago(p_id uuid) returns void
language sql security invoker as $$
  update pagos set deleted_at = now() where id = p_id and es_admin();
$$;
create or replace function anular_venta(p_id uuid) returns void
language sql security invoker as $$
  update ventas set deleted_at = now() where id = p_id and es_admin();
$$;

-- El ayudante SOLO puede pasar de 'preparado' a 'entregado'
create or replace function marcar_entregado(p_linea_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (es_admin() or es_ayudante()) then raise exception 'Sin permiso'; end if;
  update venta_lineas
     set estado_pedido = 'entregado'
   where id = p_linea_id and estado_pedido = 'preparado';
end $$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','clientes','categorias','tarjetas','ventas','venta_lineas','pagos','pago_aplicaciones','auditoria']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

drop policy if exists p_profiles_self on profiles;
create policy p_profiles_self on profiles for select using (id = auth.uid() or es_admin());
drop policy if exists p_profiles_admin on profiles;
create policy p_profiles_admin on profiles for all using (es_admin()) with check (es_admin());

do $$
declare t text;
begin
  foreach t in array array['clientes','categorias','tarjetas','ventas','venta_lineas','pagos','pago_aplicaciones']
  loop
    execute format('drop policy if exists p_admin_all on %I', t);
    execute format('create policy p_admin_all on %I for all using (es_admin()) with check (es_admin())', t);
  end loop;
end $$;

drop policy if exists p_auditoria_admin on auditoria;
create policy p_auditoria_admin on auditoria for select using (es_admin());

-- Permisos de objeto
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on v_ventas_resumen, v_saldo_cliente, v_ganancia_por_categoria, v_costos_por_medio,
                v_cocina_pendiente, v_entregas to authenticated;
revoke all on v_entregas from anon;
grant execute on all functions in schema public to authenticated;

-- Cambiar estado de pedidos (solo admin; permite regresar un estado si hubo error)
create or replace function cambiar_estado_lineas(p_ids uuid[], p_estado text) returns void
language plpgsql security invoker as $$
begin
  if not es_admin() then raise exception 'Solo la administradora puede cambiar estados'; end if;
  if p_estado not in ('pendiente','preparado','entregado') then raise exception 'Estado inválido'; end if;
  update venta_lineas set estado_pedido = p_estado
   where id = any(p_ids) and estado_pedido is not null;
end $$;
grant execute on all functions in schema public to authenticated;
