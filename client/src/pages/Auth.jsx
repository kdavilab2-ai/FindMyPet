import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Alerta } from '../components/Comunes';
import { Logo } from '../components/Navbar';
import IconoFigma from '../components/IconoFigma';
import SelectorUbicacion, { ubicacionDesdeApi } from '../components/SelectorUbicacion';

function MarcaAcceso({ login }) {
  const [totales, setTotales] = useState(null);
  useEffect(() => {
    let vigente = true;
    Promise.all([
      api.get('/publicaciones/resumen'),
      api.get('/publicaciones?estado=2'),
      api.get('/publicaciones?estado=6'),
    ]).then(([resumen, reencuentros, adopciones]) => {
      if (vigente) setTotales([resumen.desaparecidas + resumen.encontradas + resumen.adopcion, reencuentros.total, adopciones.total]);
    }).catch(() => {});
    return () => { vigente = false; };
  }, []);
  return (
    <aside className="figma-marca-acceso">
      <Link to="/" aria-label="FindMyPet, inicio">
        {login ? <Logo className="figma-marca-login" /> : <IconoFigma nombre="logo" />}
      </Link>
      {!login && <p className="figma-marca-acceso-nombre">FindMyPet</p>}
      <p className="figma-lema">Porque cada mascota merece volver a casa.</p>
      <dl>{['reportes activos', 'reencuentros', 'adopciones'].map((etiqueta, i) => (
        <div key={etiqueta}><dt>{etiqueta}</dt><dd>{totales?.[i] ?? '–'}</dd></div>
      ))}</dl>
    </aside>
  );
}

function Marco({ titulo, subtitulo, children, variante }) {
  if (variante) return (
    <div className={`figma-acceso figma-${variante}`}>
      <MarcaAcceso login={variante === 'login'} />
      <div className="figma-acceso-contenido">
        {variante === 'registro' && (
          <div className="figma-registro-movil">
            <Link to="/login" className="figma-volver" aria-label="Volver a iniciar sesión"><IconoFigma nombre="volver" /></Link>
            <span>Crear cuenta</span>
            <IconoFigma nombre="logo" />
          </div>
        )}
        <section className="figma-acceso-panel">
          <h1>{variante === 'registro' ? <><span className="hidden md:inline">{titulo}</span><span className="md:hidden">Únete a FindMyPet</span></> : titulo}</h1>
          {subtitulo && <p className="figma-acceso-subtitulo">{subtitulo}</p>}
          {children}
        </section>
      </div>
    </div>
  );
  return (
    <div className="mx-auto flex min-h-[calc(100vh-160px)] max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6 flex justify-center"><Logo grande /></div>
      <div className="panel p-6 sm:p-8">
        <h1 className="text-2xl text-lavanda">{titulo}</h1>
        {subtitulo && <p className="mb-6 mt-1 text-sm text-suave">{subtitulo}</p>}
        {children}
      </div>
    </div>
  );
}

// Figura 1 y 6: inicio de sesión (RF-02) con enlace para recuperar contraseña (RF-18)
export function Login() {
  const { login, aviso, limpiarAviso } = useAuth();
  const navegar = useNavigate();
  const { state } = useLocation();
  const [datos, setDatos] = useState({ correo: '', contrasena: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await login(datos.correo, datos.contrasena);
      navegar(state?.desde || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Marco titulo="Iniciar sesión" subtitulo="Ingresa con tu correo registrado." variante="login">
      <form onSubmit={enviar} className="figma-campos-acceso">
        <Alerta tipo="info">{aviso}</Alerta>
        <Alerta tipo="exito">{state?.mensaje}</Alerta>
        <Alerta>{error}</Alerta>
        <div>
          <label className="etiqueta" htmlFor="correo">Correo electrónico</label>
          <input id="correo" type="email" placeholder="nombre@correo.com" required autoComplete="email" className="input" value={datos.correo}
            onChange={(e) => { limpiarAviso(); setDatos({ ...datos, correo: e.target.value }); }} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="contrasena">Contraseña</label>
          <input id="contrasena" type="password" placeholder="••••••••" required autoComplete="current-password" className="input" value={datos.contrasena}
            onChange={(e) => setDatos({ ...datos, contrasena: e.target.value })} />
        </div>
        <div className="figma-recuperar"><Link to="/olvide">¿Olvidaste tu contraseña?</Link></div>
        <button className="btn btn-primario w-full py-3" disabled={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
      <p className="figma-alternar-acceso">¿No tienes cuenta? <Link to="/registro">Regístrate</Link></p>
    </Marco>
  );
}

// Figura 2 y 7: registro con tipo de usuario ciudadano o refugio (RF-01, RF-19) y consentimiento (RNF-21)
export function Registro() {
  const { registro } = useAuth();
  const navegar = useNavigate();
  const [datos, setDatos] = useState({ tipoCuenta: 'CIUDADANO', nombres: '', apellidos: '', correo: '', telefono: '', contrasena: '', confirmar: '', nombreRefugio: '', aceptaPolitica: false });
  const [ubicacion, setUbicacion] = useState(ubicacionDesdeApi(null));
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const campo = (clave) => ({ value: datos[clave], onChange: (e) => setDatos({ ...datos, [clave]: e.target.value }) });
  const esRefugio = datos.tipoCuenta === 'REFUGIO';

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (datos.contrasena.length < 8 || !/[A-Za-z]/.test(datos.contrasena) || !/\d/.test(datos.contrasena)) {
      return setError('La contraseña debe tener al menos 8 caracteres, con letras y números');
    }
    if (datos.contrasena !== datos.confirmar) return setError('Las contraseñas no coinciden');
    if (datos.telefono && !/^0\d{9}$/.test(datos.telefono)) return setError('El teléfono debe tener 10 dígitos y empezar con 0');
    if (!datos.aceptaPolitica) return setError('Debe aceptar la política de tratamiento de datos personales');
    setEnviando(true);
    try {
      const { confirmar, ...resto } = datos;
      await registro(esRefugio ? { ...resto, ...ubicacion } : resto);
      navegar(esRefugio ? '/mi-refugio' : '/', { replace: true });
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Marco titulo="Crear cuenta" subtitulo="Únete a la comunidad FindMyPet." variante="registro">
      <form onSubmit={enviar} className="figma-campos-acceso">
        <Alerta>{error}</Alerta>
        <fieldset>
          <legend className="etiqueta">Nombre completo</legend>
          <div className="grid grid-cols-2 gap-3">
            <input aria-label="Nombres" autoComplete="given-name" placeholder="Nombres" required maxLength={80} className="input" {...campo('nombres')} />
            <input aria-label="Apellidos" autoComplete="family-name" placeholder="Apellidos" required maxLength={80} className="input" {...campo('apellidos')} />
          </div>
        </fieldset>
        <div><label className="etiqueta" htmlFor="correo">Correo electrónico</label><input id="correo" type="email" autoComplete="email" placeholder="nombre@correo.com" required className="input" {...campo('correo')} /></div>
        <div><label className="etiqueta" htmlFor="contrasena">Contraseña</label><input id="contrasena" type="password" placeholder="Mínimo 8 caracteres" required autoComplete="new-password" className="input" {...campo('contrasena')} /></div>
        <fieldset>
          <legend className="etiqueta">Tipo de usuario</legend>
          <div className="grid grid-cols-2 gap-3">
            {[['CIUDADANO', 'Ciudadano'], ['REFUGIO', 'Refugio']].map(([valor, texto]) => (
              <label key={valor} className="figma-tipo-cuenta">
                <input type="radio" name="tipoCuenta" value={valor} checked={datos.tipoCuenta === valor} onChange={campo('tipoCuenta').onChange} />
                {texto}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="etiqueta" htmlFor="confirmar">Confirmar contraseña</label><input id="confirmar" type="password" required autoComplete="new-password" className="input" {...campo('confirmar')} /></div>
          <div><label className="etiqueta" htmlFor="telefono">Teléfono (opcional)</label><input id="telefono" inputMode="numeric" autoComplete="tel-national" placeholder="09XXXXXXXX" className="input" {...campo('telefono')} /></div>
        </div>
        <p className="text-xs text-suave">Mínimo 8 caracteres, con letras y números.</p>
        {esRefugio && (
          <div className="space-y-3 rounded-xl border border-borde p-4">
            <p className="text-sm text-suave">Un administrador revisará tu refugio antes de que puedas publicar adopciones.</p>
            <div><label className="etiqueta" htmlFor="nombreRefugio">Nombre del refugio o fundación</label><input id="nombreRefugio" required maxLength={100} className="input" {...campo('nombreRefugio')} /></div>
            <SelectorUbicacion valor={ubicacion} alCambiar={setUbicacion} />
          </div>
        )}
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-violeta" checked={datos.aceptaPolitica} onChange={(e) => setDatos({ ...datos, aceptaPolitica: e.target.checked })} />
          <span>Acepto la <Link to="/privacidad" target="_blank" className="text-lavanda underline">política de tratamiento de datos personales</Link>, conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador.</span>
        </label>
        <button className="btn btn-primario w-full py-3" disabled={enviando}>{enviando ? 'Creando cuenta…' : 'Registrarme'}</button>
      </form>
      <p className="figma-alternar-acceso">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
    </Marco>
  );
}

// RF-18 / CU-12: solicitar enlace de recuperación
export function Olvide() {
  const [correo, setCorreo] = useState('');
  const [estado, setEstado] = useState({ error: '', ok: '' });
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const r = await api.post('/auth/olvide', { correo });
      setEstado({ error: '', ok: r.mensaje });
    } catch (err) {
      setEstado({ error: err.message, ok: '' });
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Marco titulo="Recuperar contraseña" subtitulo="Te enviaremos un enlace para crear una nueva contraseña.">
      <form onSubmit={enviar} className="space-y-4">
        <Alerta>{estado.error}</Alerta>
        <Alerta tipo="exito">{estado.ok}</Alerta>
        <div><label className="etiqueta" htmlFor="correo">Correo electrónico</label><input id="correo" type="email" required className="input" value={correo} onChange={(e) => setCorreo(e.target.value)} /></div>
        <button className="btn btn-primario w-full py-3" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar enlace'}</button>
      </form>
      <p className="mt-5 text-center text-sm"><Link to="/login" className="text-lavanda hover:underline">Volver a iniciar sesión</Link></p>
    </Marco>
  );
}

export function Restablecer() {
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const [datos, setDatos] = useState({ contrasena: '', confirmar: '' });
  const [error, setError] = useState('');
  const enviar = async (e) => {
    e.preventDefault();
    if (datos.contrasena !== datos.confirmar) return setError('Las contraseñas no coinciden');
    try {
      await api.post('/auth/restablecer', { token: params.get('token'), contrasena: datos.contrasena });
      navegar('/login', { replace: true, state: { mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' } });
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Marco titulo="Nueva contraseña" subtitulo="Mínimo 8 caracteres, con letras y números.">
      <form onSubmit={enviar} className="space-y-4">
        <Alerta>{error}</Alerta>
        <div><label className="etiqueta" htmlFor="nueva">Nueva contraseña</label><input id="nueva" type="password" required autoComplete="new-password" className="input" value={datos.contrasena} onChange={(e) => setDatos({ ...datos, contrasena: e.target.value })} /></div>
        <div><label className="etiqueta" htmlFor="confirmar">Confirmar</label><input id="confirmar" type="password" required autoComplete="new-password" className="input" value={datos.confirmar} onChange={(e) => setDatos({ ...datos, confirmar: e.target.value })} /></div>
        <button className="btn btn-primario w-full py-3">Guardar contraseña</button>
      </form>
    </Marco>
  );
}

// RNF-21: política de tratamiento de datos
export function Privacidad() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="titulo-pagina">Política de tratamiento de datos personales</h1>
      <p className="mt-1 text-xs text-suave">Versión 1.0 · Proyecto académico FindMyPet (UNEMI)</p>
      <div className="panel mt-6 space-y-4 p-6 text-sm leading-relaxed text-suave">
        <p><b className="text-texto">Responsable.</b> FindMyPet, plataforma desarrollada por el Grupo 4 de Ingeniería de Software de la Universidad Estatal de Milagro.</p>
        <p><b className="text-texto">Datos que recopilamos.</b> Nombres, apellidos, correo, teléfono, la ubicación aproximada de los reportes y los datos de contacto que decidas publicar en cada caso.</p>
        <p><b className="text-texto">Finalidad.</b> Publicar reportes de mascotas desaparecidas, encontradas y en adopción; ponerte en contacto con otras personas interesadas en tu caso; enviarte alertas de mascotas cercanas si las activas.</p>
        <p><b className="text-texto">Quién ve tus datos.</b> Los datos de contacto de una publicación solo se muestran a usuarios con sesión iniciada. Tu correo de cuenta nunca se muestra públicamente.</p>
        <p><b className="text-texto">Inteligencia artificial.</b> Al servicio de IA solo se envían las fotos y los atributos del animal, nunca tus datos personales.</p>
        <p><b className="text-texto">Tus datos.</b> Puedes corregirlos desde tu perfil, descargar una copia o enviar una solicitud de eliminación para revisión de la administración en <Link to="/perfil/seguridad" className="text-lavanda underline">Seguridad y privacidad</Link>.</p>
      </div>
    </div>
  );
}
