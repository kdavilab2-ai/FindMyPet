import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TarjetaMascota from '../components/TarjetaMascota';
import { Alerta, Cargando, Estrellas, Vacio, formatoFecha, textoUbicacion } from '../components/Comunes';

const plataformas = [
  { nombre: 'Patreon', url: 'https://www.patreon.com/' },
  { nombre: 'GoFundMe', url: 'https://www.gofundme.com/' },
];

function ApoyoExterno({ opciones = plataformas, className }) {
  const nombres = opciones.map(({ nombre }) => nombre).join(' o ');
  return (
    <section className={className}>
      <h2 className="text-xl">Apoyo en plataformas externas</h2>
      <p className="mt-1 text-sm text-suave">Busca iniciativas de refugios en {nombres}.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {opciones.map(({ nombre, url }) => <a key={url} className="btn btn-secundario" href={url}>{nombre}</a>)}
      </div>
    </section>
  );
}

export function ListaRefugios() {
  const [refugios, setRefugios] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/refugios').then(setRefugios).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="titulo-pagina">Refugios y fundaciones</h1>
      <p className="mt-1 text-sm text-suave">Organizaciones autorizadas que rescatan animales y los dan en adopción.</p>
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
              <p className="mt-2 text-xs text-adopcion">{r.enAdopcion} en adopción</p>
            </Link>
          ))}
        </div>
      ))}

      <ApoyoExterno className="mt-8" />
    </div>
  );
}

export function DetalleRefugio() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const [r, setR] = useState(null);
  const [adopciones, setAdopciones] = useState([]);
  const [resena, setResena] = useState({ calificacion: 0, comentario: '' });
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

      {r.autorizado && <ApoyoExterno opciones={[plataformas[(r.id - 1) % plataformas.length]]} />}

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
    </div>
  );
}
