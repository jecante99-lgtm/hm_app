-- =====================================================================
-- FASE 1 · Esquema: tablas, triggers y auditoría
-- App de ventas, cobros y pedidos
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- utilidades ----------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- perfiles ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('admin','ayudante')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and rol = 'admin');
$$;

create or replace function es_ayudante() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and rol = 'ayudante');
$$;

-- El PRIMER usuario que se registra es admin; los demás, ayudante.
create or replace function crear_perfil_nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    case when exists (select 1 from profiles) then 'ayudante' else 'admin' end
  );
  return new;
end $$;

drop trigger if exists trg_nuevo_usuario on auth.users;
create trigger trg_nuevo_usuario after insert on auth.users
  for each row execute function crear_perfil_nuevo_usuario();

-- ---------- clientes ----------
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  direccion text,
  notas text,
  activo boolean not null default true,
  deleted_at timestamptz,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------- categorías ----------
create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  genera_pedido boolean not null default false,
  activa boolean not null default true,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------- tarjetas ----------
create table if not exists tarjetas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activa boolean not null default true,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------- ventas ----------
create table if not exists ventas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  categoria_id uuid not null references categorias(id),
  fecha date not null default current_date,
  fecha_promesa_pago date,
  fecha_entrega date,
  notas text,
  deleted_at timestamptz,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists venta_lineas (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas(id) on delete cascade,
  descripcion text not null,
  cantidad numeric(10,2) not null default 1 check (cantidad > 0),
  costo_unitario numeric(12,2) not null default 0,
  precio_unitario numeric(12,2) not null,
  total_precio numeric(14,2) generated always as (cantidad * precio_unitario) stored,
  total_costo numeric(14,2) generated always as (cantidad * costo_unitario) stored,
  ganancia numeric(14,2) generated always as (cantidad * (precio_unitario - costo_unitario)) stored,
  medio_compra text check (medio_compra in ('efectivo','tarjeta')),
  tarjeta_id uuid references tarjetas(id),
  estado_pedido text check (estado_pedido in ('pendiente','preparado','entregado')),
  preparado_at timestamptz,
  entregado_at timestamptz,
  entregado_por uuid references profiles(id),
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- estado_pedido = 'pendiente' si la categoría genera pedido; null si no.
create or replace function lineas_estado_inicial() returns trigger
language plpgsql as $$
declare v_genera boolean;
begin
  select c.genera_pedido into v_genera
    from ventas v join categorias c on c.id = v.categoria_id
   where v.id = new.venta_id;
  if v_genera then
    new.estado_pedido := coalesce(new.estado_pedido, 'pendiente');
  else
    new.estado_pedido := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_lineas_estado_inicial on venta_lineas;
create trigger trg_lineas_estado_inicial before insert on venta_lineas
  for each row execute function lineas_estado_inicial();

-- Marca de tiempos al cambiar de estado (también cuando el admin retrocede).
create or replace function lineas_cambio_estado() returns trigger
language plpgsql as $$
begin
  if new.estado_pedido is distinct from old.estado_pedido then
    if new.estado_pedido = 'pendiente' then
      new.preparado_at := null; new.entregado_at := null; new.entregado_por := null;
    elsif new.estado_pedido = 'preparado' then
      new.preparado_at := coalesce(new.preparado_at, now());
      new.entregado_at := null; new.entregado_por := null;
    elsif new.estado_pedido = 'entregado' then
      new.preparado_at := coalesce(new.preparado_at, now());
      new.entregado_at := now();
      new.entregado_por := auth.uid();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_lineas_cambio_estado on venta_lineas;
create trigger trg_lineas_cambio_estado before update on venta_lineas
  for each row execute function lineas_cambio_estado();

-- ---------- pagos ----------
create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  fecha date not null default current_date,
  monto numeric(12,2) not null check (monto > 0),
  metodo text check (metodo in ('efectivo','transferencia','otro')),
  notas text,
  deleted_at timestamptz,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists pago_aplicaciones (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references pagos(id) on delete cascade,
  venta_id uuid not null references ventas(id),
  monto numeric(12,2) not null check (monto > 0),
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Validaciones de aplicaciones
create or replace function validar_aplicacion() returns trigger
language plpgsql as $$
declare
  v_monto_pago numeric; v_aplicado_pago numeric;
  v_total_venta numeric; v_aplicado_venta numeric;
begin
  select monto into v_monto_pago from pagos where id = new.pago_id;
  select coalesce(sum(monto),0) into v_aplicado_pago
    from pago_aplicaciones where pago_id = new.pago_id and id <> new.id;
  if v_aplicado_pago + new.monto > v_monto_pago then
    raise exception 'Lo aplicado (%) excede el monto del pago (%)', v_aplicado_pago + new.monto, v_monto_pago;
  end if;

  select coalesce(sum(total_precio),0) into v_total_venta from venta_lineas where venta_id = new.venta_id;
  select coalesce(sum(a.monto),0) into v_aplicado_venta
    from pago_aplicaciones a join pagos p on p.id = a.pago_id
   where a.venta_id = new.venta_id and a.id <> new.id and p.deleted_at is null;
  if v_aplicado_venta + new.monto > v_total_venta then
    raise exception 'Lo aplicado a la venta (%) excede su total (%)', v_aplicado_venta + new.monto, v_total_venta;
  end if;
  return new;
end $$;

drop trigger if exists trg_validar_aplicacion on pago_aplicaciones;
create trigger trg_validar_aplicacion before insert or update on pago_aplicaciones
  for each row execute function validar_aplicacion();

-- ---------- no se borra físicamente dinero ----------
create or replace function prohibir_borrado() returns trigger
language plpgsql as $$
begin
  raise exception 'No se permite borrar registros de % (use borrado lógico)', tg_table_name;
end $$;

drop trigger if exists trg_no_delete_clientes on clientes;
create trigger trg_no_delete_clientes before delete on clientes for each row execute function prohibir_borrado();
drop trigger if exists trg_no_delete_ventas on ventas;
create trigger trg_no_delete_ventas before delete on ventas for each row execute function prohibir_borrado();
drop trigger if exists trg_no_delete_pagos on pagos;
create trigger trg_no_delete_pagos before delete on pagos for each row execute function prohibir_borrado();

-- ---------- updated_at ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','clientes','categorias','tarjetas','ventas','venta_lineas','pagos','pago_aplicaciones']
  loop
    execute format('drop trigger if exists trg_updated_at on %I', t);
    execute format('create trigger trg_updated_at before update on %I for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ---------- auditoría: quién y cuándo ----------
create table if not exists auditoria (
  id bigint generated always as identity primary key,
  tabla text not null,
  registro_id uuid,
  accion text not null,
  usuario_id uuid,
  datos_antes jsonb,
  datos_despues jsonb,
  creado_at timestamptz not null default now()
);

create or replace function registrar_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria (tabla, registro_id, accion, usuario_id, datos_antes, datos_despues)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id', null)::uuid,
    tg_op, auth.uid(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['ventas','venta_lineas','pagos','pago_aplicaciones']
  loop
    execute format('drop trigger if exists trg_auditoria on %I', t);
    execute format('create trigger trg_auditoria after insert or update or delete on %I for each row execute function registrar_auditoria()', t);
  end loop;
end $$;

-- ---------- índices ----------
create index if not exists idx_ventas_cliente_fecha on ventas(cliente_id, fecha);
create index if not exists idx_lineas_venta on venta_lineas(venta_id);
create index if not exists idx_lineas_estado on venta_lineas(estado_pedido);
create index if not exists idx_pagos_cliente_fecha on pagos(cliente_id, fecha);
create index if not exists idx_aplic_venta on pago_aplicaciones(venta_id);
create index if not exists idx_aplic_pago on pago_aplicaciones(pago_id);
create index if not exists idx_auditoria_registro on auditoria(tabla, registro_id);
