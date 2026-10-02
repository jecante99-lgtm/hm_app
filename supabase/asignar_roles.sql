-- Asignar rol a un usuario ya creado en Authentication → Users.
-- Cambia el correo y ejecuta en Supabase → SQL Editor.

-- AYUDANTE: solo ve "Por entregar" (sin costos, ganancias ni deudas) y marca entregado.
insert into profiles (id, nombre, rol)
select id, 'Ayudante', 'ayudante' from auth.users
where email = 'CORREO_DEL_AYUDANTE@ejemplo.com'
on conflict (id) do update set rol = 'ayudante', nombre = excluded.nombre;

-- ADMINISTRADORA (dueña): ve y hace todo, incluido anotar pedidos de paches.
-- insert into profiles (id, nombre, rol)
-- select id, 'Administradora', 'admin' from auth.users
-- where email = 'CORREO_DE_LA_DUENA@ejemplo.com'
-- on conflict (id) do update set rol = 'admin', nombre = excluded.nombre;

-- Verificar:
select u.email, p.nombre, p.rol from profiles p join auth.users u on u.id = p.id;
