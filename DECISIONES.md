# Decisiones de diseño

- **Stack:** React + Vite + TypeScript + Tailwind v4, Supabase (Postgres/Auth/RLS), PWA con `vite-plugin-pwa`. Hospedaje: Vercel (plan gratuito).
- **Accesibilidad (persona mayor):** tamaño base de letra 20 px (todo escala con `rem`), botones de mínimo 56 px, una sola acción principal por pantalla, navegación inferior con 5 botones con ícono + texto, textos en lenguaje simple ("Me debe", "Cobro", "Me costó").
- **Primer usuario = admin:** un trigger en `auth.users` crea el perfil; el primer usuario es `admin`, los siguientes `ayudante`. Después de crear los dos usuarios conviene desactivar "Allow new users to sign up" en Supabase.
- **Escritura por RPC idempotente:** `crear_venta`, `registrar_pago`, `marcar_entregado`, `cambiar_estado_lineas` reciben el UUID generado en el dispositivo; reenviar nunca duplica. Eso permite la cola offline.
- **Offline:** el app shell se precachea (service worker); las lecturas se guardan en `localStorage` (última versión vista); las escrituras (ventas, pagos, estados de pedidos) van a una cola local que se vacía al reconectar. Limitación: ediciones sobre clientes/catálogos (crear cliente, ajustes) requieren internet.
- **Totales nunca guardados:** vistas SQL (`v_ventas_resumen`, `v_saldo_cliente`, …) con `security_invoker`, así RLS aplica al usuario que consulta.
- **`v_entregas`** corre con los permisos del dueño de la vista y filtra por rol dentro de la vista; es lo único que el ayudante puede leer. Muestra el precio/total a cobrar por línea (la sección 2 de la especificación dice "precio a cobrar si aplica") pero nunca costo, ganancia ni saldo del cliente.
- **Saldo a favor:** `saldo_pendiente = max(vendido − pagado, 0)`; `saldo_a_favor = max(pagado − vendido, 0)`; se calcula a nivel cliente con todos los pagos vigentes.
- **Ganancia cobrada:** ganancia de cada venta × (pagado / total, máximo 1).
- **Pagos y ventas:** borrado lógico (`deleted_at`); trigger que impide `DELETE` físico en clientes, ventas y pagos. Tabla `auditoria` registra quién y cuándo cambió ventas, líneas, pagos y aplicaciones.
- **"Pagué con"** se captura una vez por venta y se copia a todas sus líneas.
- **Usuarios:** el ayudante se crea con `npm run db:crear-usuario` (service role) o desde el panel de Supabase → Authentication.
- **Pendiente / fuera de esta entrega:** edición de líneas de una venta ya guardada (hoy se elimina y se recrea), gráfica de pastel, reseteo de contraseña desde la app.
