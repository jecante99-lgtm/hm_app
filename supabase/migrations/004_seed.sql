insert into categorias (nombre, genera_pedido) values
  ('Zapatos', false), ('Betterware', false), ('Paches', true)
on conflict (nombre) do nothing;
