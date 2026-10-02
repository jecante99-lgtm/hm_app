import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type Perfil = { id: string; nombre: string; rol: 'admin' | 'ayudante' };
type Ctx = { session: Session | null; perfil: Perfil | null; cargando: boolean; salir: () => Promise<void> };
const AuthCtx = createContext<Ctx>({ session: null, perfil: null, cargando: true, salir: async () => {} });
export const useAuth = () => useContext(AuthCtx);

const PKEY = 'perfil_v1';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(() => {
    try { return JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch { return null; }
  });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setCargando(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (!s) { setPerfil(null); localStorage.removeItem(PKEY); setCargando(false); } });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from('profiles').select('id,nombre,rol').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => {
        if (data) { setPerfil(data as Perfil); localStorage.setItem(PKEY, JSON.stringify(data)); }
        setCargando(false);
      }, () => setCargando(false));
  }, [session]);

  const salir = async () => { await supabase.auth.signOut(); localStorage.clear(); };
  return <AuthCtx.Provider value={{ session, perfil, cargando, salir }}>{children}</AuthCtx.Provider>;
}
