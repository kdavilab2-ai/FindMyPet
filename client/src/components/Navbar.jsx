import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatoFechaHora } from './Comunes';

const claseEnlace = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'text-lavanda' : 'text-suave hover:text-texto'}`;

export function Logo({ grande = false }) {
  return (
    <span className={`flex items-center gap-2 font-extrabold ${grande ? 'text-3xl' : 'text-xl'}`}>
      <img src="/favicon.svg" alt="" className={grande ? 'h-11 w-11' : 'h-8 w-8'} />
      <span>Find <span className="text-violeta">MyPet</span></span>
    </span>
  );
}

function Notificaciones() {
  const [datos, setDatos] = useState({ datos: [], noLeidas: 0 });
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const navegar = useNavigate();

  const cargar = useCallback(() => api.get('/notificaciones').then(setDatos).catch(() => {}), []);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60000);
    return () => clearInterval(t);
  }, [cargar]);
  useEffect(() => {
    const fuera = (e) => ref.current && !ref.current.contains(e.target) && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  const abrir = async (n) => {
    if (!n.leida) await api.patch(`/notificaciones/${n.id}/leida`).catch(() => {});
    setAbierto(false);
    cargar();
    if (n.idTipo === 2) navegar('/coincidencias');
    else if (n.idPublicacion) navegar(`/publicaciones/${n.idPublicacion}`);
  };

  const leerTodas = async () => { await api.patch('/notificaciones/leidas'); cargar(); };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setAbierto(!abierto); if (!abierto) cargar(); }} className="relative rounded-xl p-2 text-xl hover:bg-panel"
        aria-label={`Notificaciones (${datos.noLeidas} sin leer)`}>
        🔔
        {datos.noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-perdida px-1 text-center text-[11px] font-bold text-white">{datos.noLeidas}</span>
        )}
      </button>
      {abierto && (
        <div className="panel absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between border-b border-borde px-4 py-3">
            <span className="font-semibold">Notificaciones</span>
            {datos.noLeidas > 0 && <button onClick={leerTodas} className="text-xs text-lavanda hover:underline">Marcar todas como leídas</button>}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {datos.datos.length === 0 && <li className="px-4 py-6 text-center text-sm text-suave">No tienes notificaciones</li>}
            {datos.datos.map((n) => (
              <li key={n.id}>
                <button onClick={() => abrir(n)} className={`w-full border-b border-borde/50 px-4 py-3 text-left text-sm hover:bg-tarjeta ${n.leida ? 'text-suave' : ''}`}>
                  <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-lavanda">{n.tipo}</span>
                  {!n.leida && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-violeta" />}
                  {n.mensaje}
                  <span className="mt-1 block text-[11px] text-suave">{formatoFechaHora(n.fecha)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MenuUsuario() {
  const { usuario, esAdmin, esRefugio, cerrarSesion } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const navegar = useNavigate();
  useEffect(() => {
    const fuera = (e) => ref.current && !ref.current.contains(e.target) && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);
  const ir = (ruta) => { setAbierto(false); navegar(ruta); };
  const opcion = 'block w-full px-4 py-2.5 text-left text-sm hover:bg-tarjeta';
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setAbierto(!abierto)} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-panel" aria-expanded={abierto} aria-label="Menú de usuario">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violeta text-sm font-bold">{usuario.nombres[0]}</span>
        <span className="hidden text-left leading-tight lg:block">
          <span className="block text-sm font-semibold">{usuario.nombres}</span>
          <span className="block text-[11px] text-suave">{usuario.rol}</span>
        </span>
      </button>
      {abierto && (
        <div className="panel absolute right-0 z-40 mt-2 w-56 overflow-hidden py-1 shadow-2xl">
          <button className={opcion} onClick={() => ir('/mis-reportes')}>📋 Mis reportes</button>
          <button className={opcion} onClick={() => ir('/coincidencias')}>🤖 Coincidencias IA</button>
          <button className={opcion} onClick={() => ir('/perfil')}>👤 Mi perfil y alertas</button>
          {esRefugio && <button className={opcion} onClick={() => ir('/mi-refugio')}>🏠 Mi refugio</button>}
          <button className={opcion} onClick={() => ir('/refugios')}>💜 Refugios y donaciones</button>
          {esAdmin && <button className={opcion} onClick={() => ir('/admin')}>🛡️ Administración</button>}
          <hr className="my-1 border-borde" />
          <button className={`${opcion} text-perdida`} onClick={() => { cerrarSesion(); ir('/'); }}>Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { usuario } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-borde bg-fondo/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <Link to="/" aria-label="FindMyPet, inicio"><Logo /></Link>
        <div className="ml-6 hidden gap-1 md:flex">
          <NavLink to="/" end className={claseEnlace}>Inicio</NavLink>
          <NavLink to="/perdidas" className={claseEnlace}>Perdidas</NavLink>
          <NavLink to="/halladas" className={claseEnlace}>Halladas</NavLink>
          <NavLink to="/adopcion" className={claseEnlace}>Adopción</NavLink>
          {usuario && <NavLink to="/mis-reportes" className={claseEnlace}>Mis reportes</NavLink>}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {usuario ? (
            <>
              <Link to="/reportar" className="btn btn-primario hidden md:inline-flex">+ Reportar</Link>
              <Notificaciones />
              <MenuUsuario />
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secundario">Ingresar</Link>
              <Link to="/registro" className="btn btn-primario hidden sm:inline-flex">Crear cuenta</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

// Barra inferior de la versión móvil (Figura 3 del plan)
export function NavInferior() {
  const { pathname } = useLocation();
  const item = (ruta, icono, texto) => (
    <Link to={ruta} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${pathname === ruta ? 'text-lavanda' : 'text-suave'}`}>
      <span className="text-lg" aria-hidden="true">{icono}</span>{texto}
    </Link>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-end border-t border-borde bg-panel/95 backdrop-blur md:hidden" aria-label="Navegación principal">
      {item('/', '⌂', 'Inicio')}
      {item('/perdidas', '🔍', 'Perdidas')}
      <Link to="/reportar" className="-mt-5 flex flex-1 justify-center" aria-label="Reportar mascota">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violeta-oscuro to-violeta text-3xl font-light text-white shadow-lg shadow-violeta/40">+</span>
      </Link>
      {item('/halladas', '🐾', 'Halladas')}
      {item('/adopcion', '♥', 'Adopción')}
    </nav>
  );
}
