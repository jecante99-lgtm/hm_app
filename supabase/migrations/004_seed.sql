insert into categorias (nombre, genera_pedido) values
  ('Zapatos', false), ('Betterware', false), ('Parches', true)
on conflict (nombre) do nothing;
