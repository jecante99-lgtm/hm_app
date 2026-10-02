// Crea un usuario en Supabase Auth (requiere SUPABASE_SERVICE_ROLE_KEY en .env)
// Uso: npm run db:crear-usuario -- correo contraseña "Nombre"
// El primer usuario creado es admin; los siguientes, ayudante.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const [email, password, nombre] = process.argv.slice(2);
if (!email || !password) { console.error('Uso: npm run db:crear-usuario -- correo contraseña "Nombre"'); process.exit(1); }
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre } });
if (error) { console.error(error.message); process.exit(1); }
console.log('Usuario creado:', data.user.id);
