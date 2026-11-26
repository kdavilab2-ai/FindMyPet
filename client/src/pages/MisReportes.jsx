import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useCatalogos } from '../context/CatalogosContext';
import { Alerta, Cargando, ESTILO_TIPO, Modal, Vacio, formatoFecha } from '../components/Comunes';
import EncabezadoFigma from '../components/EncabezadoFigma';
import { FotoMascotaFigma } from '../components/TarjetaMascota';
import ConfirmarRecuperacion from '../components/ConfirmarRecuperacion';

// Figura 5 y 10: lista de reportes del usuario con su estado (RF-05, RF-06, RF-14)
export default function MisReportes() {
  const { catalogos } = useCatalogos();
  const [datos, setDatos] = useState(null);
  const [filtro, setFiltro] = useState(0);
  const [error, setError] = useState('');
  const [eliminar, setEliminar] = useState(null);
  const [recuperar, setRecuperar] = useState(null);

  const cargar = useCallback(() => api.get('/publicaciones/mias').then(setDatos).catch((e) => setError(e.message)), []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardarEstado = async (p, idEstado, descripcionRecuperacion) => {
    const actualizado = await api.patch(`/publicaciones/${p.id}/estado`, { idEstado: Number(idEstado), descripcionRecuperacion });
    setDatos((previos) => previos?.map((reporte) => reporte.id === actualizado.id ? { ...reporte, ...actualizado } : reporte));
    setError('');
    cargar();
  };
  const cambiarEstado = (p, idEstado) => guardarEstado(p, idEstado).catch((e) => setError(e.message));
  const confirmarEliminar = async () => {
    try { await api.delete(`/publicaciones/${eliminar.id}`); setEliminar(null); cargar(); } catch (e) { setError(e.message); }
  };

  const lista = datos?.filter((p) => !filtro || p.idTipo === filtro) || [];

  return (
    <div className="figma-pagina figma-mis-reportes">
      <EncabezadoFigma titulo="Mis reportes" />
      <div className="figma-filtros-reportes" role="group" aria-label="Filtrar mis reportes">
        {[[0, 'Todos'], [1, 'Perdidas'], [2, 'Avistamientos'], [3, 'Adopción']].map(([v, t]) => (
          <button key={v} onClick={() => setFiltro(v)} aria-pressed={filtro === v}>{t}</button>
        ))}
      </div>
      <Alerta>{error}</Alerta>
      {!datos && !error && <Cargando />}
      {datos && (lista.length === 0 ? (
        <Vacio titulo="No tienes reportes aquí"><Link to="/reportar" className="text-lavanda underline">Crea tu primer reporte</Link></Vacio>
      ) : (
        <div className="figma-tabla-reportes">
          <div className="figma-cabecera-reportes" aria-hidden="true">
            <span>Mascota</span><span>Tipo</span><span>Fecha</span><span>Estado</span><span>Acciones</span>
          </div>
          <ul>
          {lista.map((p) => (
            <li key={p.id} className="figma-fila-reporte">
              <Link to={`/publicaciones/${p.id}`} className="figma-mascota-reporte">
                <FotoMascotaFigma p={p} />
                <span>{p.nombreAnimal || 'Sin nombre'} · {p.especie}</span>
              </Link>
              <span className="figma-reporte-tipo">{ESTILO_TIPO[p.idTipo].texto}</span>
              <time className="figma-reporte-fecha" dateTime={p.fechaEvento || p.fechaCreacion}>{formatoFecha(p.fechaEvento || p.fechaCreacion)}</time>
              <div className="figma-reporte-estado">
                <select className="figma-estado-pill" data-estado={p.idEstado} aria-label="Estado" value={p.idEstado}
                  disabled={!catalogos} onChange={(e) => Number(e.target.value) === 2 ? setRecuperar(p) : cambiarEstado(p, e.target.value)}>
                  {catalogos ? catalogos.estados.filter((e) => e.idTipo === p.idTipo).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)
                    : <option value={p.idEstado}>{p.estado}</option>}
                </select>
              </div>
              <div className="figma-reporte-acciones">
                <Link to={`/publicaciones/${p.id}/editar`}>Editar</Link>
                <button type="button" onClick={() => setEliminar(p)}>Eliminar</button>
              </div>
              {p.coincidencias > 0 && (
                <Link to={`/coincidencias?publicacion=${p.id}`} className="figma-reporte-coincidencias">
                  {p.coincidencias} {p.coincidencias === 1 ? 'coincidencia sugerida' : 'coincidencias sugeridas'}
                </Link>
              )}
            </li>
          ))}
          </ul>
        </div>
      ))}
      <ConfirmarRecuperacion nombre={recuperar?.nombreAnimal} abierto={Boolean(recuperar)} alCerrar={() => setRecuperar(null)}
        alConfirmar={(nota) => guardarEstado(recuperar, 2, nota)} />
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
