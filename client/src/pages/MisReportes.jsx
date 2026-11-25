import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, urlArchivo } from '../services/api';
import { useCatalogos } from '../context/CatalogosContext';
import { Alerta, Cargando, IconoEspecie, InsigniaTipo, Modal, Vacio, formatoFecha, textoUbicacion } from '../components/Comunes';

// Figura 5 y 10: lista de reportes del usuario con su estado (RF-05, RF-06, RF-14)
export default function MisReportes() {
  const { catalogos } = useCatalogos();
  const [datos, setDatos] = useState(null);
  const [filtro, setFiltro] = useState(0);
  const [error, setError] = useState('');
  const [eliminar, setEliminar] = useState(null);

  const cargar = useCallback(() => api.get('/publicaciones/mias').then(setDatos).catch((e) => setError(e.message)), []);
  useEffect(() => { cargar(); }, [cargar]);

  const cambiarEstado = async (p, idEstado) => {
    try { await api.patch(`/publicaciones/${p.id}/estado`, { idEstado: Number(idEstado) }); cargar(); } catch (e) { setError(e.message); }
  };
  const confirmarEliminar = async () => {
    try { await api.delete(`/publicaciones/${eliminar.id}`); setEliminar(null); cargar(); } catch (e) { setError(e.message); }
  };

  const lista = datos?.filter((p) => !filtro || p.idTipo === filtro) || [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Mis reportes</h1>
          <p className="mt-1 text-sm text-suave">Actualiza el estado cuando tu caso se resuelva.</p>
        </div>
        <Link to="/reportar" className="btn btn-primario">+ Nuevo reporte</Link>
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {[[0, 'Todos'], [1, 'Perdidas'], [2, 'Encontradas'], [3, 'Adopción']].map(([v, t]) => (
          <button key={v} onClick={() => setFiltro(v)} className={`rounded-full border px-4 py-1.5 text-sm ${filtro === v ? 'border-violeta bg-violeta text-white' : 'border-borde text-suave'}`}>{t}</button>
        ))}
      </div>
      <Alerta>{error}</Alerta>
      {!datos && !error && <Cargando />}
      {datos && (lista.length === 0 ? (
        <Vacio titulo="No tienes reportes aquí"><Link to="/reportar" className="text-lavanda underline">Crea tu primer reporte</Link></Vacio>
      ) : (
        <ul className="space-y-3">
          {lista.map((p) => (
            <li key={p.id} className="panel flex flex-wrap items-center gap-4 p-3 sm:flex-nowrap">
              <Link to={`/publicaciones/${p.id}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-tarjeta">
                {p.foto ? <img src={urlArchivo(p.foto)} alt="" className="h-full w-full object-cover" /> : <IconoEspecie especie={p.especie} className="flex h-full items-center justify-center text-3xl" />}
              </Link>
              <div className="min-w-0 flex-1">
                <InsigniaTipo idTipo={p.idTipo} />
                <Link to={`/publicaciones/${p.id}`} className="mt-1 block font-bold hover:text-lavanda">{p.nombreAnimal || 'Sin nombre'} · {p.especie}</Link>
                <p className="text-xs text-suave">{p.idTipo === 3 ? p.estadoSalud : `${textoUbicacion(p.ubicacion)} · ${formatoFecha(p.fechaEvento)}`}</p>
                {p.coincidencias > 0 && (
                  <Link to={`/coincidencias?publicacion=${p.id}`} className="mt-1 inline-block rounded-full bg-violeta/20 px-2.5 py-0.5 text-xs font-semibold text-lavanda">
                    🤖 {p.coincidencias} {p.coincidencias === 1 ? 'coincidencia sugerida' : 'coincidencias sugeridas'}
                  </Link>
                )}
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <select className="input py-2 sm:w-36" aria-label="Estado" value={p.idEstado} onChange={(e) => cambiarEstado(p, e.target.value)}>
                  {catalogos?.estados.filter((e) => e.idTipo === p.idTipo).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
                <Link to={`/publicaciones/${p.id}/editar`} className="btn btn-secundario px-3" aria-label="Editar">✏️</Link>
                <button className="btn btn-secundario px-3 text-perdida" aria-label="Eliminar" onClick={() => setEliminar(p)}>🗑</button>
              </div>
            </li>
          ))}
        </ul>
      ))}
      <Modal titulo="Eliminar publicación" abierto={Boolean(eliminar)} alCerrar={() => setEliminar(null)}>
        <p className="text-sm text-suave">¿Eliminar la publicación de {eliminar?.nombreAnimal || 'este animal'}? Esta acción no se puede deshacer.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-secundario" onClick={() => setEliminar(null)}>Cancelar</button>
          <button className="btn btn-peligro" onClick={confirmarEliminar}>Eliminar</button>
        </div>
      </Modal>
    </div>
  );
}
