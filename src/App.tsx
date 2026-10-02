import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { configurado } from './lib/supabase';
import { Layout, Cargando, Aviso } from './components/ui';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import Clientes from './pages/Clientes';
import ClienteFicha from './pages/ClienteFicha';
import NuevaVenta from './pages/NuevaVenta';
import RegistrarPago from './pages/RegistrarPago';
import PorCobrar from './pages/PorCobrar';
import PedidoPaches from './pages/PedidoPaches';
import Cocina from './pages/Cocina';
import Entregas from './pages/Entregas';
import Reportes from './pages/Reportes';
import Mas from './pages/Mas';
import Ajustes from './pages/Ajustes';

export default function App() {
  const { session, perfil, cargando } = useAuth();
  if (!configurado) return <div className="p-6"><Aviso>Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver README).</Aviso></div>;
  if (cargando && !perfil) return <Cargando />;
  if (!session && !perfil) return <Login />;
  if (!perfil) return <Cargando />;

  if (perfil.rol === 'ayudante') {
    return <Layout><Routes><Route path="*" element={<Entregas />} /></Routes></Layout>;
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/:id" element={<ClienteFicha />} />
        <Route path="/venta/nueva" element={<NuevaVenta />} />
        <Route path="/pago/nuevo" element={<RegistrarPago />} />
        <Route path="/por-cobrar" element={<PorCobrar />} />
        <Route path="/paches" element={<Cocina />} />
        <Route path="/paches/nuevo" element={<PedidoPaches />} />
        <Route path="/entregas" element={<Entregas />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/mas" element={<Mas />} />
        <Route path="/ajustes" element={<Ajustes />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
