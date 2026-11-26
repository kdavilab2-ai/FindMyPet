import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatoFechaHora } from './Comunes';
import IconoFigma from './IconoFigma';

const claseEnlace = ({ isActive }) =>
  `figma-enlace-nav ${isActive ? 'activo' : ''}`;

export function Logo({ grande = false, className = '' }) {
  return (
    <span className={`figma-marca text-white ${grande ? 'figma-marca-grande' : ''} ${className}`}>
      <IconoFigma nombre="pata" />
      <span>FindMyPet</span>
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
    if (n.idTipo === 2) navegar(n.idPublicacion ? `/coincidencias?publicacion=${n.idPublicacion}` : '/coincidencias');
    else if (n.idTipo === 3 && n.idPublicacion) navegar(`/publicaciones/${n.idPublicacion}#intereses-adopcion`);
    else if (n.tipo === 'Seguridad') navegar('/perfil/seguridad');
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
  const { usuario, esAdmin, esRefugio, salir } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const navegar = useNavigate();
  useEffect(() => {
    const fuera = (e) => ref.current && !ref.current.contains(e.target) && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);
  const ir = (ruta, opciones) => { setAbierto(false); navegar(ruta, opciones); };
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
          <button className={opcion} onClick={() => ir('/perfil/seguridad')}>🛡️ Seguridad y privacidad</button>
          {esRefugio && <button className={opcion} onClick={() => ir('/mi-refugio')}>🏠 Mi refugio</button>}
          {esAdmin && <button className={opcion} onClick={() => ir('/admin')}>🛡️ Administración</button>}
          <Link className={opcion} to="/perdidas" aria-label="Ver todas las mascotas perdidas" onClick={() => setAbierto(false)}>Ver todas</Link>
          <hr className="my-1 border-borde" />
          <button className={`${opcion} text-perdida`} onClick={() => { salir(); ir('/login', { replace: true }); }}>Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}

export default function Navbar({ cabeceraPropia = false }) {
  const { usuario } = useAuth();
  return (
    <header className={`figma-cabecera ${cabeceraPropia ? 'hidden md:block' : ''}`}>
      <nav className="figma-nav" aria-label="Navegación superior">
        <Link to="/" aria-label="FindMyPet, inicio"><Logo /></Link>
        <div className="figma-enlaces-nav">
          <NavLink to="/" end className={claseEnlace}>Inicio</NavLink>
          <NavLink to="/perdidas" className={claseEnlace}>Perdidas</NavLink>
          <NavLink to="/recuperados" className={claseEnlace}>Recuperados</NavLink>
          <NavLink to="/adopcion" className={claseEnlace}>Adopción</NavLink>
          <NavLink to="/refugios" className={claseEnlace}>Refugios y fundaciones</NavLink>
          {usuario && <NavLink to="/mis-reportes" className={(estado) => `${claseEnlace(estado)} figma-mis-reportes-nav`}>Mis reportes</NavLink>}
        </div>
        <div className="figma-acciones-nav">
          {usuario ? (
            <>
              <Link to="/reportar" className="btn btn-primario figma-reportar-nav">+ Reportar</Link>
              <Notificaciones />
              <MenuUsuario />
            </>
          ) : (
            <>
              <Link to="/login" className="figma-ingresar-nav">Ingresar</Link>
              <Link to="/reportar" className="btn btn-primario figma-reportar-nav">+ Reportar</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

// Barra inferior de la versión móvil (Figura 3 del plan)
export function NavInferior() {
  const item = (ruta, icono, texto) => (
    <NavLink to={ruta} end={ruta === '/'} className="figma-item-inferior">
      <span><IconoFigma nombre={icono} /></span>{texto}
    </NavLink>
  );
  return (
    <nav className="figma-nav-inferior" aria-label="Navegación móvil">
      {item('/', 'inicio', 'Inicio')}
      {item('/perdidas', 'lupaMenu', 'Perdidas')}
      <Link to="/reportar" className="figma-mas-nav" aria-label="Reportar mascota">
        <span><IconoFigma nombre="mas" /></span>
      </Link>
      {item('/recuperados', 'pataMenu', 'Recuperados')}
      {item('/adopcion', 'adopcion', 'Adopción')}
      {item('/refugios', 'inicio', 'Refugios')}
    </nav>
  );
}
