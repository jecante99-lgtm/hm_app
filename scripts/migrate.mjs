// Aplica las migraciones SQL a Supabase.  Uso: npm run db:migrate [-- --demo]
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) { console.error('Falta DATABASE_URL en .env'); process.exit(1); }

const dir = path.resolve('supabase/migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
if (process.argv.includes('--demo')) files.splice(0, files.length, '../demo.sql');

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
for (const f of files) {
  process.stdout.write(`> ${f} ... `);
  await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
  console.log('ok');
}
await client.end();
console.log('Listo.');
