import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Boton, Campo, Entrada, Aviso } from '../components/ui';

export default function Login() {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [espera, setEspera] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault(); setError(''); setEspera(true);
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
    if (error) setError('Correo o contraseña incorrectos');
    setEspera(false);
  }

  return (
    <div className="min-h-screen bg-marca flex items-center justify-center p-5">
      <form onSubmit={entrar} className="bg-white rounded-3xl p-6 w-full max-w-md space-y-5 shadow-xl">
        <div className="text-center"><div className="text-6xl">💰</div><h1 className="text-3xl font-extrabold mt-2">Mis Ventas</h1></div>
        <Campo etiqueta="Correo"><Entrada type="email" autoComplete="username" value={correo} onChange={e => setCorreo(e.target.value)} required /></Campo>
        <Campo etiqueta="Contraseña"><Entrada type="password" autoComplete="current-password" value={clave} onChange={e => setClave(e.target.value)} required /></Campo>
        {error && <Aviso>{error}</Aviso>}
        <Boton className="w-full" disabled={espera}>{espera ? 'Entrando…' : 'Entrar'}</Boton>
      </form>
    </div>
  );
}
