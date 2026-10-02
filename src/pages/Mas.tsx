import { useAuth } from '../lib/auth';
import { BotonLink, Boton, Titulo } from '../components/ui';

export default function Mas() {
  const { perfil, salir } = useAuth();
  return (
    <div className="space-y-3">
      <Titulo>Más opciones</Titulo>
      <p className="text-lg text-slate-600">Hola, {perfil?.nombre}</p>
      <BotonLink to="/reportes">📊 Reportes y ganancias</BotonLink>
      <BotonLink to="/entregas" tono="borde">📦 Entregas</BotonLink>
      <BotonLink to="/ajustes" tono="gris">⚙️ Ajustes</BotonLink>
      <Boton tono="gris" className="w-full" onClick={salir}>Cerrar sesión</Boton>
    </div>
  );
}
