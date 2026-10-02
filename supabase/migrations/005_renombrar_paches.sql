-- Renombra la categoría "Parches" a "Paches" (seguro de ejecutar varias veces)
update categorias set nombre = 'Paches' where nombre = 'Parches';
insert into categorias (nombre, genera_pedido) values ('Paches', true) on conflict (nombre) do nothing;
update categorias set genera_pedido = true where nombre = 'Paches';
