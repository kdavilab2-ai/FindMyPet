import { Link, Route, Routes, useLocation } from 'react-router-dom';
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
  return (
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      <SubirAlCambiar />
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/perdidas" element={<Listado idTipo={1} />} />
          <Route path="/halladas" element={<Listado idTipo={2} />} />
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
          <Route path="/mi-refugio" element={<RutaPrivada roles={[2]}><MiRefugio /></RutaPrivada>} />
          <Route path="/admin" element={<RutaPrivada roles={[3]}><Admin /></RutaPrivada>} />
          <Route path="*" element={<NoEncontrada />} />
        </Routes>
      </main>
      <footer className="hidden border-t border-borde py-6 text-center text-xs text-suave md:block">
        FindMyPet · Grupo 4 · Construcción de Software, Universidad Estatal de Milagro · <Link to="/privacidad" className="hover:text-texto">Privacidad</Link>
      </footer>
      <NavInferior />
    </div>
  );
}
