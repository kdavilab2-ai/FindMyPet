import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Alerta, Cargando } from '../components/Comunes';
import SelectorUbicacion, { ubicacionDesdeApi } from '../components/SelectorUbicacion';

// RF-03 (perfil) y RF-26 (zona y radio de alertas por proximidad)
export default function Perfil() {
  const { guardarSesion } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [datos, setDatos] = useState({});
  const [clave, setClave] = useState({ actual: '', nueva: '', confirmar: '' });
  const [alerta, setAlerta] = useState({ ubicacion: ubicacionDesdeApi(null), radioKm: 5, activa: false });
  const [mensajes, setMensajes] = useState({});

  const cargar = () => api.get('/perfil').then((p) => {
    setPerfil(p);
    setDatos({ nombres: p.nombres, apellidos: p.apellidos, telefono: p.telefono || '' });
    setAlerta(p.alerta
      ? { ubicacion: ubicacionDesdeApi(p.alerta.ubicacion), radioKm: p.alerta.radioKm, activa: true }
      : { ubicacion: ubicacionDesdeApi(null), radioKm: 5, activa: false });
  }).catch((e) => setMensajes({ general: { error: e.message } }));
  useEffect(() => { cargar(); }, []);

  const mostrar = (seccion, tipo, texto) => setMensajes({ ...mensajes, [seccion]: { [tipo]: texto } });

  const guardarDatos = async (e) => {
    e.preventDefault();
    try { guardarSesion(await api.put('/perfil', datos)); mostrar('datos', 'ok', 'Datos actualizados'); } catch (err) { mostrar('datos', 'error', err.message); }
  };
  const guardarClave = async (e) => {
    e.preventDefault();
    if (clave.nueva !== clave.confirmar) return mostrar('clave', 'error', 'Las contraseñas no coinciden');
    try { await api.put('/perfil/contrasena', clave); setClave({ actual: '', nueva: '', confirmar: '' }); mostrar('clave', 'ok', 'Contraseña actualizada'); } catch (err) { mostrar('clave', 'error', err.message); }
  };
  const guardarAlerta = async (e) => {
    e.preventDefault();
    try { await api.put('/perfil/alertas', { ...alerta.ubicacion, radioKm: alerta.radioKm }); mostrar('alerta', 'ok', 'Alertas activadas'); cargar(); } catch (err) { mostrar('alerta', 'error', err.message); }
  };
  const quitarAlerta = async () => {
    try { await api.delete('/perfil/alertas'); mostrar('alerta', 'ok', 'Alertas desactivadas'); cargar(); } catch (err) { mostrar('alerta', 'error', err.message); }
  };

  if (!perfil) return mensajes.general ? <div className="mx-auto max-w-3xl p-6"><Alerta>{mensajes.general.error}</Alerta></div> : <Cargando />;
  const msj = (s) => <><Alerta>{mensajes[s]?.error}</Alerta><Alerta tipo="exito">{mensajes[s]?.ok}</Alerta></>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-violeta text-2xl font-bold">{perfil.nombres[0]}</span>
        <div>
          <h1 className="titulo-pagina">{perfil.nombres} {perfil.apellidos}</h1>
          <p className="text-sm text-suave">{perfil.correo} · {perfil.rol} · {perfil.publicaciones} publicaciones</p>
        </div>
      </div>

      <form onSubmit={guardarDatos} className="panel space-y-4 p-5">
        <h2 className="text-lg">Datos personales</h2>
        {msj('datos')}
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="etiqueta" htmlFor="n">Nombres</label><input id="n" required className="input" value={datos.nombres} onChange={(e) => setDatos({ ...datos, nombres: e.target.value })} /></div>
          <div><label className="etiqueta" htmlFor="a">Apellidos</label><input id="a" required className="input" value={datos.apellidos} onChange={(e) => setDatos({ ...datos, apellidos: e.target.value })} /></div>
          <div><label className="etiqueta" htmlFor="t">Teléfono</label><input id="t" className="input" inputMode="numeric" value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} /></div>
        </div>
        <button className="btn btn-primario">Guardar datos</button>
      </form>

      <form onSubmit={guardarAlerta} className="panel space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg">🔔 Alertas de mascotas perdidas cerca de ti</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${alerta.activa ? 'bg-adopcion/20 text-adopcion' : 'bg-tarjeta text-suave'}`}>{alerta.activa ? 'Activas' : 'Inactivas'}</span>
        </div>
        <p className="text-sm text-suave">Te avisaremos cuando se reporte una mascota desaparecida dentro del radio que elijas. Marca tu zona en el mapa para usar la distancia exacta; si no, te avisaremos de reportes en tu mismo sector.</p>
        {msj('alerta')}
        <SelectorUbicacion valor={alerta.ubicacion} alCambiar={(u) => setAlerta({ ...alerta, ubicacion: u })} etiquetaDireccion={null} radioKm={alerta.radioKm} />
        <div>
          <label className="etiqueta" htmlFor="radio">Radio: {alerta.radioKm} km</label>
          <input id="radio" type="range" min={1} max={20} value={alerta.radioKm} onChange={(e) => setAlerta({ ...alerta, radioKm: Number(e.target.value) })} className="w-full accent-violeta" />
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primario">{alerta.activa ? 'Actualizar alertas' : 'Activar alertas'}</button>
          {alerta.activa && <button type="button" className="btn btn-secundario" onClick={quitarAlerta}>Desactivar</button>}
        </div>
      </form>

      <form onSubmit={guardarClave} className="panel space-y-4 p-5">
        <h2 className="text-lg">Cambiar contraseña</h2>
        {msj('clave')}
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="etiqueta" htmlFor="c1">Actual</label><input id="c1" type="password" required className="input" autoComplete="current-password" value={clave.actual} onChange={(e) => setClave({ ...clave, actual: e.target.value })} /></div>
          <div><label className="etiqueta" htmlFor="c2">Nueva</label><input id="c2" type="password" required className="input" autoComplete="new-password" value={clave.nueva} onChange={(e) => setClave({ ...clave, nueva: e.target.value })} /></div>
          <div><label className="etiqueta" htmlFor="c3">Confirmar</label><input id="c3" type="password" required className="input" autoComplete="new-password" value={clave.confirmar} onChange={(e) => setClave({ ...clave, confirmar: e.target.value })} /></div>
        </div>
        <button className="btn btn-secundario">Cambiar contraseña</button>
      </form>
    </div>
  );
}
