-- Datos de prueba (opcional): 5 clientes, ventas de cada categoría, pagos parciales.
-- Se ejecuta sin sesión, así que inserta directo (created_by queda null).
do $$
declare
  cz uuid; cb uuid; cp uuid;
  c1 uuid := gen_random_uuid(); c2 uuid := gen_random_uuid(); c3 uuid := gen_random_uuid();
  c4 uuid := gen_random_uuid(); c5 uuid := gen_random_uuid();
  v1 uuid := gen_random_uuid(); v2 uuid := gen_random_uuid(); v3 uuid := gen_random_uuid();
  v4 uuid := gen_random_uuid(); v5 uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid();
begin
  if exists (select 1 from clientes where nombre = 'María López (demo)') then return; end if;
  select id into cz from categorias where nombre='Zapatos';
  select id into cb from categorias where nombre='Betterware';
  select id into cp from categorias where nombre='Paches';

  insert into clientes (id,nombre,telefono,direccion) values
    (c1,'María López (demo)','5551110001','Calle Rosas 12'),
    (c2,'Juana Pérez (demo)','5551110002','Av. Juárez 45'),
    (c3,'Rosa Martínez (demo)','5551110003','Calle Sol 8'),
    (c4,'Carmen Díaz (demo)','5551110004','Calle Luna 3'),
    (c5,'Lupita Ramos (demo)','5551110005','Privada Flores 20');

  insert into ventas (id,cliente_id,categoria_id,fecha,fecha_promesa_pago) values
    (v1,c1,cz,current_date-20,current_date-5),
    (v2,c1,cb,current_date-10,current_date+7),
    (v3,c2,cz,current_date-3,current_date+10),
    (v4,c3,cp,current_date-1,null),
    (v5,c4,cp,current_date-1,null);
  update ventas set fecha_entrega = current_date+1 where id in (v4,v5);

  insert into venta_lineas (venta_id,descripcion,cantidad,costo_unitario,precio_unitario,medio_compra) values
    (v1,'Tenis Nike #26 negro',1,500,750,'efectivo'),
    (v1,'Sandalias beige #24',1,200,320,'efectivo'),
    (v1,'Botas café #25',1,600,900,'efectivo'),
    (v2,'Organizador cocina',2,90,150,'efectivo'),
    (v3,'Zapato escolar #22',1,250,400,'efectivo'),
    (v4,'Paches grandes',20,4,8,null),
    (v4,'Paches especiales',12,5,10,null),
    (v5,'Paches grandes',15,4,8,null);

  insert into pagos (id,cliente_id,fecha,monto,metodo) values (p1,c1,current_date-8,800,'efectivo');
  insert into pago_aplicaciones (pago_id,venta_id,monto) values (p1,v1,800);

  -- un pedido ya preparado para probar la vista del ayudante
  update venta_lineas set estado_pedido='preparado' where venta_id=v5;
end $$;
