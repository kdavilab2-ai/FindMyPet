import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

const INACTIVIDAD_MS = 30 * 60 * 1000; // RNF-19: cierre automático tras 30 minutos sin actividad
const RENOVAR_CADA_MS = 10 * 60 * 1000;

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
  });
  const [aviso, setAviso] = useState('');
  const ultimaActividad = useRef(Date.now());

  const guardarSesion = useCallback(({ token, usuario: datos }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(datos));
    setUsuario(datos);
  }, []);

  const actualizarUsuario = useCallback((datos) => {
    localStorage.setItem('usuario', JSON.stringify(datos));
    setUsuario(datos);
  }, []);

  const cerrarSesion = useCallback((motivo = '') => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
    setAviso(motivo);
  }, []);

  // Sesión expirada en el servidor
  useEffect(() => {
    const alExpirar = () => cerrarSesion('Su sesión expiró. Inicie sesión nuevamente');
    window.addEventListener('sesion-expirada', alExpirar);
    return () => window.removeEventListener('sesion-expirada', alExpirar);
  }, [cerrarSesion]);

  // Registro de actividad, renovación del token y cierre por inactividad
  useEffect(() => {
    if (!usuario) return undefined;
    const marcar = () => { ultimaActividad.current = Date.now(); };
    const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    eventos.forEach((e) => window.addEventListener(e, marcar, { passive: true }));
    let ultimaRenovacion = Date.now();
    const intervalo = setInterval(async () => {
      const ahora = Date.now();
      const inactivo = ahora - ultimaActividad.current;
      if (inactivo >= INACTIVIDAD_MS) {
        cerrarSesion('Cerramos su sesión por 30 minutos de inactividad');
      } else if (ahora - ultimaRenovacion >= RENOVAR_CADA_MS && inactivo < RENOVAR_CADA_MS) {
        // Hubo actividad reciente: se pide un token nuevo antes de que venza el actual (30 min)
        ultimaRenovacion = ahora;
        try { guardarSesion(await api.post('/auth/renovar')); } catch { /* el evento sesion-expirada se encarga */ }
      }
    }, 60 * 1000);
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, marcar));
      clearInterval(intervalo);
    };
  }, [usuario?.id, cerrarSesion, guardarSesion]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (correo, contrasena) => { guardarSesion(await api.post('/auth/login', { correo, contrasena })); setAviso(''); };
  const registro = async (datos) => { guardarSesion(await api.post('/auth/registro', datos)); setAviso(''); };

  const valor = {
    usuario,
    login,
    registro,
    guardarSesion,
    actualizarUsuario,
    cerrarSesion,
    aviso,
    limpiarAviso: () => setAviso(''),
    esAdmin: usuario?.idRol === 3,
    esRefugio: usuario?.idRol === 2,
    refugioAutorizado: usuario?.idRol === 2 && Boolean(usuario?.refugio?.autorizado),
  };
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
