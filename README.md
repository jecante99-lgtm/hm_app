# Mis Ventas — PWA de ventas, cobros y pedidos

Interfaz pensada para una persona mayor: letra grande, botones grandes, pocas opciones por pantalla.

## Arquitectura
```
supabase/migrations/   001 tablas+triggers+auditoría · 002 vistas · 003 funciones RPC + RLS · 004 seed
supabase/demo.sql      datos de prueba (opcional)
scripts/               migrate.mjs (aplica el SQL) · crear-usuario.mjs
src/lib/               supabase, auth, offline (cola + caché), format
src/pages/             Inicio, Clientes, Ficha, Nueva venta, Pago, Por cobrar, Parches, Entregas, Reportes, Ajustes
```
Roles: `admin` (todo) y `ayudante` (solo `v_entregas` + `marcar_entregado`). Ver `DECISIONES.md`.

## 1. Crear las tablas en Supabase
Opción A (recomendada, desde tu computadora con internet):
```bash
cp .env.example .env     # pon tu DATABASE_URL y las llaves
npm install
npm run db:migrate       # crea tablas, vistas, RLS y categorías
npm run db:seed-demo     # (opcional) datos de prueba
```
> Si `db.<proyecto>.supabase.co` no conecta (solo IPv6), usa la cadena "Session pooler" de Supabase → Connect.

Opción B: pega en Supabase → SQL Editor, en orden, los 4 archivos de `supabase/migrations/`.

## 2. Usuarios
Supabase → Authentication → Users → Add user (marca "Auto confirm"):
1. Primero la **dueña** (queda como `admin`).
2. Después el **ayudante** (queda como `ayudante`).
Luego, Authentication → Sign In / Providers → desactiva "Allow new users to sign up".

## 3. Desplegar en Vercel (gratis)
1. vercel.com → Add New → Project → importa este repositorio (framework: Vite, se detecta solo).
2. Variables de entorno: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API).
3. Deploy. Abre la URL en el celular → menú del navegador → **Agregar a pantalla de inicio**.

## Desarrollo local
```bash
npm run dev
```
