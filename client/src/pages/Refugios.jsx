import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TarjetaMascota from '../components/TarjetaMascota';
import { Alerta, Cargando, Estrellas, Modal, Vacio, formatoFecha, textoUbicacion } from '../components/Comunes';

// RF-25: registrar un aporte (monto comprometido o insumos). Sin pagos en línea (exclusión del alcance).
function FormularioAporte({ solicitud, alTerminar }) {
  const [datos, setDatos] = useState({ monto: '', detalle: '' });
  const [error, setError] = useState('');
  const enviar = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/donaciones/${solicitud.id}/aportes`, { monto: datos.monto || null, detalle: datos.detalle });
      alTerminar('¡Gracias! Registramos tu aporte. El refugio se pondrá en contacto contigo para coordinarlo.');
    } catch (err) { setError(err.message); }
  };
  return (
    <form onSubmit={enviar} className="space-y-3">
      <p className="text-sm text-suave">{solicitud.descripcion}</p>
      <Alerta>{error}</Alerta>
      <div><label className="etiqueta" htmlFor="m">Monto en dólares (opcional)</label><input id="m" type="number" min="1" step="0.01" className="input" value={datos.monto} onChange={(e) => setDatos({ ...datos, monto: e.target.value })} /></div>
      <div><label className="etiqueta" htmlFor="d">Insumos que aportarás (opcional)</label><input id="d" className="input" maxLength={255} placeholder="Ej. 1 saco de balanceado de 15 kg" value={datos.detalle} onChange={(e) => setDatos({ ...datos, detalle: e.target.value })} /></div>
      <p className="text-xs text-suave">FindMyPet no procesa pagos: el refugio coordinará contigo la entrega.</p>
      <button className="btn btn-primario w-full">Registrar aporte</button>
    </form>
  );
}

export function ListaRefugios() {
  const { usuario } = useAuth();
  const [refugios, setRefugios] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [aportar, setAportar] = useState(null);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    api.get('/refugios').then(setRefugios).catch((e) => setError(e.message));
    api.get('/donaciones').then(setSolicitudes).catch(() => {});
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="titulo-pagina">Refugios y fundaciones</h1>
      <p className="mt-1 text-sm text-suave">Organizaciones autorizadas que rescatan animales y los dan en adopción.</p>
      <Alerta tipo="exito">{aviso}</Alerta>
      <Alerta>{error}</Alerta>
      {!refugios && !error && <Cargando />}
      {refugios && (refugios.length === 0 ? <div className="mt-5"><Vacio titulo="Aún no hay refugios autorizados" /></div> : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {refugios.map((r) => (
            <Link key={r.id} to={`/refugios/${r.id}`} className="panel block p-5 transition hover:border-violeta/60">
              <p className="text-3xl" aria-hidden="true">🏠</p>
              <h2 className="mt-2 text-lg">{r.nombre}</h2>
              <p className="text-sm text-suave">{textoUbicacion(r.ubicacion)}</p>
              <div className="mt-2 flex items-center gap-2"><Estrellas valor={r.promedio} tamano="text-base" /><span className="text-xs text-suave">{r.promedio || '–'} ({r.valoraciones})</span></div>
              <p className="mt-2 text-xs text-adopcion">{r.enAdopcion} en adopción{r.solicitudesAbiertas > 0 && <span className="text-ambar"> · {r.solicitudesAbiertas} pedido(s) de ayuda</span>}</p>
            </Link>
          ))}
        </div>
      ))}

      <h2 className="mb-3 mt-10 text-xl">Los refugios necesitan tu ayuda</h2>
      {solicitudes.length === 0 ? <p className="text-sm text-suave">No hay solicitudes de donación abiertas.</p> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {solicitudes.map((s) => (
            <div key={s.id} className="panel flex flex-col p-5">
              <p className="text-xs font-semibold text-ambar">{s.refugio}</p>
              <h3 className="mt-1 text-base">{s.titulo}</h3>
              <p className="mt-1 flex-1 text-sm text-suave">{s.descripcion}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-suave">{s.aportes} aporte(s){s.totalMonto > 0 && ` · $${s.totalMonto.toFixed(2)} comprometidos`}</span>
                {usuario ? <button className="btn btn-primario py-1.5" onClick={() => setAportar(s)}>Quiero ayudar</button> : <Link to="/login" className="text-sm text-lavanda">Inicia sesión para ayudar</Link>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal titulo={aportar?.titulo || ''} abierto={Boolean(aportar)} alCerrar={() => setAportar(null)}>
        {aportar && <FormularioAporte solicitud={aportar} alTerminar={(m) => { setAportar(null); setAviso(m); cargar(); }} />}
      </Modal>
    </div>
  );
}

export function DetalleRefugio() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const [r, setR] = useState(null);
  const [adopciones, setAdopciones] = useState([]);
  const [resena, setResena] = useState({ calificacion: 0, comentario: '' });
  const [aportar, setAportar] = useState(null);
  const [estado, setEstado] = useState({ error: '', ok: '' });

  const cargar = useCallback(() => {
    api.get(`/refugios/${id}`).then((d) => {
      setR(d);
      const mia = d.resenas.find((x) => x.esMia);
      if (mia) setResena({ calificacion: mia.calificacion, comentario: mia.comentario || '' });
    }).catch((e) => setEstado({ error: e.message, ok: '' }));
    api.get(`/publicaciones?tipo=3&refugio=${id}`).then((x) => setAdopciones(x.datos)).catch(() => {});
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  const valorar = async (e) => {
    e.preventDefault();
    if (!resena.calificacion) return setEstado({ error: 'Seleccione de 1 a 5 estrellas', ok: '' });
    try { await api.post(`/refugios/${id}/valoraciones`, resena); setEstado({ error: '', ok: '¡Gracias por tu valoración!' }); cargar(); } catch (err) { setEstado({ error: err.message, ok: '' }); }
  };

  if (!r) return estado.error ? <div className="mx-auto max-w-5xl p-6"><Alerta>{estado.error}</Alerta></div> : <Cargando />;
  const puedeValorar = usuario?.idRol === 1;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="panel flex flex-wrap items-center gap-4 p-6">
        <span className="text-5xl" aria-hidden="true">🏠</span>
        <div className="flex-1">
          <h1 className="titulo-pagina">{r.nombre}</h1>
          <p className="text-sm text-suave">{textoUbicacion(r.ubicacion)}{r.ubicacion?.direccion && ` · ${r.ubicacion.direccion}`}</p>
          <div className="mt-1 flex items-center gap-2"><Estrellas valor={r.promedio} /><span className="text-sm text-suave">{r.promedio || 'Sin valoraciones'} · {r.valoraciones} reseña(s)</span></div>
        </div>
      </div>
      <Alerta tipo="exito">{estado.ok}</Alerta>
      <Alerta>{estado.error}</Alerta>

      <section>
        <h2 className="mb-3 text-xl">En adopción</h2>
        {adopciones.length === 0 ? <p className="text-sm text-suave">No hay animales en adopción en este momento.</p>
          : <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{adopciones.map((p) => <TarjetaMascota key={p.id} p={p} />)}</div>}
      </section>

      {r.solicitudes.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl">Necesitamos ayuda</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {r.solicitudes.map((s) => (
              <div key={s.id} className="panel p-4">
                <h3 className="text-base">{s.titulo}</h3>
                <p className="mt-1 text-sm text-suave">{s.descripcion}</p>
                {usuario && <button className="btn btn-primario mt-3 py-1.5" onClick={() => setAportar(s)}>Quiero ayudar</button>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl">Reseñas</h2>
          {r.resenas.length === 0 ? <p className="text-sm text-suave">Aún no hay reseñas.</p> : (
            <ul className="space-y-3">
              {r.resenas.map((x) => (
                <li key={x.id} className="panel p-4">
                  <div className="flex items-center justify-between"><span className="font-semibold">{x.autor}</span><Estrellas valor={x.calificacion} tamano="text-sm" /></div>
                  {x.comentario && <p className="mt-1 text-sm text-suave">{x.comentario}</p>}
                  <p className="mt-1 text-[11px] text-suave">{formatoFecha(x.fecha)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        {puedeValorar && (
          <form onSubmit={valorar} className="panel h-fit space-y-3 p-5">
            <h2 className="text-lg">Valora la atención (RF-24)</h2>
            <Estrellas valor={resena.calificacion} alCambiar={(n) => setResena({ ...resena, calificacion: n })} tamano="text-3xl" />
            <textarea className="input" rows={3} maxLength={1000} placeholder="Cuéntanos tu experiencia" value={resena.comentario} onChange={(e) => setResena({ ...resena, comentario: e.target.value })} />
            <button className="btn btn-primario">Enviar valoración</button>
          </form>
        )}
      </section>
      <Modal titulo={aportar?.titulo || ''} abierto={Boolean(aportar)} alCerrar={() => setAportar(null)}>
        {aportar && <FormularioAporte solicitud={aportar} alTerminar={(m) => { setAportar(null); setEstado({ error: '', ok: m }); cargar(); }} />}
      </Modal>
    </div>
  );
}
