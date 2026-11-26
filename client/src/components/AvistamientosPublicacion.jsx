import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, urlArchivo } from '../services/api';
import { Alerta, formatoFecha } from './Comunes';

export default function AvistamientosPublicacion({ publicacion, avistamientoPublicado }) {
  const [datos, setDatos] = useState([]);
  const [siguiente, setSiguiente] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const ruta = `/publicaciones/${publicacion.id}/avistamientos`;

  useEffect(() => {
    let vigente = true;
    api.get(ruta).then((pagina) => {
      if (vigente) {
        setDatos(pagina.datos);
        setSiguiente(pagina.siguiente);
      }
    }).catch((e) => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [ruta]);

  const verMas = async () => {
    setCargando(true);
    setError('');
    try {
      const pagina = await api.get(`${ruta}?antesDe=${siguiente}`);
      setDatos((actual) => [...actual, ...pagina.datos]);
      setSiguiente(pagina.siguiente);
    } catch (e) { setError(e.message); }
    finally { setCargando(false); }
  };

  return (
    <section id="avistamientos" aria-labelledby="titulo-avistamientos" className="panel mt-6 scroll-mt-20 space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-avistamientos" className="text-lg text-lavanda">Avistamientos</h2>
          <p className="mt-1 text-sm text-suave">Fotos y observaciones compartidas en esta publicación.</p>
        </div>
        {publicacion.idEstado === 1 && <Link to={`/reportar?tipo=2&referencia=${publicacion.id}`} className="btn btn-primario">Publicar avistamiento</Link>}
      </div>
      <Alerta tipo="exito">{avistamientoPublicado && 'Tu avistamiento se publicó en esta ficha.'}</Alerta>
      <Alerta>{error}</Alerta>
      {!datos.length && !cargando && !error && <p className="rounded-xl border border-borde p-4 text-sm text-suave">Todavía no hay avistamientos en esta publicación.</p>}
      <ul className="space-y-3">
        {datos.map((v) => (
          <li key={v.id} className="space-y-3 rounded-xl border border-borde bg-fondo/40 p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{v.autor || 'Avistamiento de la comunidad'}</p>
                <p className="text-xs text-suave">{[formatoFecha(v.fechaEvento), v.horaEvento, v.sector, v.canton].filter(Boolean).join(' · ')}</p>
              </div>
              <Link to={`/publicaciones/${v.id}`} className="text-sm text-lavanda underline">Ver avistamiento</Link>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm">{v.descripcion}</p>
            {v.fotos.length > 0 && <div className="flex flex-wrap gap-2">
              {v.fotos.map((foto, i) => (
                <img key={foto.id} src={urlArchivo(foto.url)} alt={`Foto ${i + 1} del avistamiento`} loading="lazy"
                  className="h-24 w-28 rounded-lg bg-fondo object-cover sm:h-32 sm:w-40" />
              ))}
            </div>}
          </li>
        ))}
      </ul>
      {cargando && <p role="status" className="text-sm text-suave">Cargando avistamientos…</p>}
      {siguiente && <button type="button" className="btn btn-secundario" onClick={verMas} disabled={cargando}>Ver avistamientos anteriores</button>}
    </section>
  );
}
