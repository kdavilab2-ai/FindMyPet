import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar, { NavInferior } from './components/Navbar';
import { RutaPrivada } from './components/Comunes';
import Inicio from './pages/Inicio';
import Listado from './pages/Listado';
import Detalle from './pages/Detalle';
import Reportar from './pages/Reportar';
import MisReportes from './pages/MisReportes';
import Coincidencias from './pages/Coincidencias';
import Perfil from './pages/Perfil';
import Seguridad from './pages/Seguridad';
import MiRefugio from './pages/MiRefugio';
import Admin from './pages/Admin';
import { ListaRefugios, DetalleRefugio } from './pages/Refugios';
import { Login, Registro, Olvide, Restablecer, Privacidad } from './pages/Auth';

function NoEncontrada() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl" aria-hidden="true">🐾</p>
      <h1 className="mt-4 text-3xl text-lavanda">Página no encontrada</h1>
      <Link to="/" className="btn btn-primario mt-6">Volver al inicio</Link>
    </div>
  );
}

function SubirAlCambiar() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  const { pathname, search } = useLocation();
  const login = pathname === '/login';
  const acceso = login || pathname === '/registro';
  const cabeceraPropia = pathname === '/reportar' || pathname === '/mis-reportes' || /^\/publicaciones\/[^/]+\/editar$/.test(pathname);
  return (
    <div className={`flex flex-col ${login ? 'min-h-dvh' : 'min-h-screen'} ${acceso ? '' : 'figma-con-navegacion'}`}>
      <SubirAlCambiar />
      {import.meta.env.DEV && import.meta.env.VITE_DEMOSTRACION === '1' && (
        <p className="border-b border-borde bg-panel px-4 py-2 text-center text-sm text-lavanda">
          Demostración académica · Animales, fotos, contactos y reseñas ficticios.
        </p>
      )}
      {!acceso && <Navbar cabeceraPropia={cabeceraPropia} />}
      <main className={`flex-1 ${login ? 'flex flex-col' : ''}`}>
        <Routes>
          <Route path="/" element={<RutaPrivada><Inicio /></RutaPrivada>} />
          <Route path="/perdidas" element={<Listado key="perdidas" idTipo={1} estadoFijo={1} />} />
          <Route path="/recuperados" element={<Listado key="recuperados" idTipo={1} estadoFijo={2} />} />
          <Route path="/halladas" element={<Navigate to={{ pathname: '/recuperados', search }} replace />} />
          <Route path="/adopcion" element={<Listado idTipo={3} />} />
          <Route path="/publicaciones/:id" element={<Detalle />} />
          <Route path="/refugios" element={<ListaRefugios />} />
          <Route path="/refugios/:id" element={<DetalleRefugio />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/olvide" element={<Olvide />} />
          <Route path="/restablecer" element={<Restablecer />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/reportar" element={<RutaPrivada><Reportar /></RutaPrivada>} />
          <Route path="/publicaciones/:id/editar" element={<RutaPrivada><Reportar /></RutaPrivada>} />
          <Route path="/mis-reportes" element={<RutaPrivada><MisReportes /></RutaPrivada>} />
          <Route path="/coincidencias" element={<RutaPrivada><Coincidencias /></RutaPrivada>} />
          <Route path="/perfil" element={<RutaPrivada><Perfil /></RutaPrivada>} />
          <Route path="/perfil/seguridad" element={<RutaPrivada><Seguridad /></RutaPrivada>} />
          <Route path="/mi-refugio" element={<RutaPrivada roles={[2]}><MiRefugio /></RutaPrivada>} />
          <Route path="/admin" element={<RutaPrivada roles={[3]}><Admin /></RutaPrivada>} />
          <Route path="*" element={<NoEncontrada />} />
        </Routes>
      </main>
      <footer className={`hidden border-t border-borde px-4 py-6 text-center text-xs text-suave ${acceso ? '' : 'md:block'}`}>
        <p>FindMyPet es un proyecto académico desarrollado por el Grupo 4 de Construcción de Software de la Universidad Estatal de Milagro.</p>
        <Link to="/privacidad" className="mt-2 inline-block underline underline-offset-2 hover:text-texto">Política de privacidad</Link>
      </footer>
      {!acceso && <NavInferior />}
    </div>
  );
}
