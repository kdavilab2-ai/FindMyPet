import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, urlArchivo } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCatalogos } from '../context/CatalogosContext';
import Mapa from '../components/Mapa';
import CoordinacionAvistamiento from '../components/CoordinacionAvistamiento';
import ConfirmarRecuperacion from '../components/ConfirmarRecuperacion';
import EnlacesContacto from '../components/EnlacesContacto';
import AvistamientosPublicacion from '../components/AvistamientosPublicacion';
import {
  Alerta, Cargando, IconoEspecie, InsigniaEstado, InsigniaTipo, Modal, formatoFecha, formatoFechaHora, textoTipoPublicacion,
} from '../components/Comunes';

const COLOR_TIPO = { 1: '#F05A5A', 2: '#1E8FFF', 3: '#1FA463' };

function Dato({ titulo, valor }) {
  if (!valor) return null;
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-suave">{titulo}</dt>
      <dd className="mt-0.5 text-sm font-medium">{valor}</dd>
    </div>
  );
}

export default function Detalle() {
  const { id } = useParams();
  const { state, hash } = useLocation();
  const navegar = useNavigate();
  const { usuario, esAdmin } = useAuth();
  const { catalogos } = useCatalogos();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [activa, setActiva] = useState(null);
  const [contactosAdopcion, setContactosAdopcion] = useState(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [confirmarRecuperar, setConfirmarRecuperar] = useState(false);
  const [generando, setGenerando] = useState(false);

  const cargar = useCallback(() => api.get(`/publicaciones/${id}`).then(setP).catch((e) => setError(e.message)), [id]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (hash === '#avistamientos' && p?.id === Number(id)) document.getElementById('avistamientos')?.scrollIntoView();
  }, [hash, id, p?.id]);

  if (error && !p) return <div className="mx-auto max-w-5xl px-4 py-8"><Alerta>{error}</Alerta></div>;
  if (!p) return <Cargando />;

  const nombre = p.nombreAnimal || 'Sin nombre';
  const archivo = p.multimedia.find((m) => m.id === activa)
    || p.multimedia.find((m) => m.url === p.foto)
    || p.multimedia[0];
  const estadosTipo = catalogos?.estados.filter((e) => e.idTipo === p.idTipo) || [];
  const contactos = p.idTipo === 3 ? contactosAdopcion : p.contactos;

  const cambiarEstado = async (idEstado) => {
    try { await api.patch(`/publicaciones/${id}/estado`, { idEstado: Number(idEstado) }); setAviso('Estado actualizado'); cargar(); } catch (e) { setError(e.message); }
  };
  const eliminar = async () => {
    try { await api.delete(`/publicaciones/${id}`); navegar('/mis-reportes'); } catch (e) { setError(e.message); }
  };
  const meInteresa = async () => {
    try {
      const r = await api.post(`/publicaciones/${id}/interes`);
      setContactosAdopcion(r.contactos);
      setAviso(r.mensaje);
    } catch (e) { setError(e.message); }
  };
  const descargarCartel = async () => {
    setGenerando(true);
    try { const { generarCartel } = await import('../services/cartel'); await generarCartel(p); } catch { setError('No se pudo generar el cartel'); } finally { setGenerando(false); }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <button onClick={() => navegar(-1)} className="mb-4 text-sm text-suave hover:text-texto">← Volver</button>
      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-borde bg-tarjeta">
            {archivo ? (
              archivo.tipo === 'Video'
                ? <video src={urlArchivo(archivo.url)} controls className="aspect-[4/3] w-full bg-black object-contain" />
                : <img src={urlArchivo(archivo.url)} alt={nombre} className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center"><IconoEspecie especie={p.especie} className="text-8xl" /></div>
            )}
          </div>
          {p.multimedia.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {p.multimedia.map((m, i) => (
                <button key={m.id} onClick={() => setActiva(m.id)} aria-label={`Ver archivo ${i + 1}`}
                  aria-pressed={m.id === archivo?.id}
                  className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${m.id === archivo?.id ? 'border-violeta' : 'border-transparent opacity-70'}`}>
                  {m.tipo === 'Video' ? <span className="flex h-full items-center justify-center bg-black text-xl">▶</span> : <img src={urlArchivo(m.url)} alt="" className="h-full w-full object-cover" />}
                </button>
              ))}
            </div>
          )}
          {p.idTipo !== 3 && p.ubicacion?.latitud && (
            <div className="panel p-3">
              <p className="mb-2 text-xs font-semibold text-suave">{p.idTipo === 1 ? 'Último lugar donde fue vista' : 'Lugar del avistamiento'}</p>
              <Mapa punto={p.ubicacion} color={COLOR_TIPO[p.idTipo]} alto="h-56" />
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2"><InsigniaTipo idTipo={p.idTipo} idDesaparicionOrigen={p.idDesaparicionOrigen} /><InsigniaEstado idEstado={p.idEstado} estado={p.estado} /></div>
            <h1 className="mt-3 text-3xl text-lavanda sm:text-4xl">{nombre}</h1>
            <p className="mt-1 text-sm text-suave">
              {p.idTipo === 3 ? <>Publicado por <Link to={`/refugios/${p.idRefugio}`} className="text-lavanda hover:underline">{p.refugio}</Link></> : <>📍 {p.ubicacion?.sector}, {p.ubicacion?.canton} · {formatoFecha(p.fechaEvento)}</>}
            </p>
          </div>

          <Alerta tipo="exito">{aviso || (state?.creada && (p.idTipo === 2 ? 'Reporte registrado. Buscaremos posibles coincidencias.' : 'Publicación creada.'))}</Alerta>
          <Alerta>{error}</Alerta>

          <dl className="panel grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
            <Dato titulo="Especie" valor={p.especie} />
            <Dato titulo="Raza" valor={p.raza || 'No indicada'} />
            <Dato titulo="Tamaño" valor={p.tamano || 'No indicado'} />
            <Dato titulo="Color" valor={p.colores.map((c) => c.nombre).join(', ') || 'No indicado'} />
            {p.idTipo !== 3 && <Dato titulo={p.idTipo === 1 ? 'Desapareció' : 'Avistamiento'} valor={[formatoFecha(p.fechaEvento), p.horaEvento].filter(Boolean).join(' · ')} />}
            {p.idTipo === 3 && <Dato titulo="Estado de salud" valor={p.estadoSalud} />}
            {p.ubicacion?.direccion && <Dato titulo="Referencia" valor={p.ubicacion.direccion} />}
          </dl>

          <p className="whitespace-pre-line text-sm leading-relaxed">{p.descripcion}</p>
          <p className="text-xs text-suave">Publicado el {formatoFechaHora(p.fechaCreacion)}{p.autor && ` por ${p.autor}`}</p>
          {p.idDesaparicionOrigen && <Link to={`/publicaciones/${p.idDesaparicionOrigen}#avistamientos`} className="inline-block text-sm text-lavanda underline">Ver publicación de la mascota perdida</Link>}

          {p.custodia && <section className="panel space-y-1 border-hallada/40 p-5">
            <h2 className="text-base text-lavanda">{p.custodia.confirmadaEn ? 'Recepción confirmada por el refugio' : 'Traslado a refugio informado'}</h2>
            <Link to={`/refugios/${p.custodia.idRefugio}`} className="text-sm font-semibold text-lavanda underline">{p.custodia.nombre}</Link>
            <p className="text-sm text-suave">{p.custodia.confirmadaEn ? 'El refugio confirmó que recibió al animal.' : 'El refugio aún debe confirmar que recibió al animal.'}</p>
          </section>}
          {p.custodia && usuario && <CoordinacionAvistamiento key={id} id={id} nombreAnimal={nombre} alConfirmar={cargar} />}

          {(p.esAutor || esAdmin) && (
            <div className="panel space-y-3 p-5">
              <h2 className="text-base">{p.esAutor ? 'Tu publicación' : 'Moderación'}</h2>
              {p.esAutor && (
                <div>
                  <label className="etiqueta" htmlFor="estado">Estado del caso</label>
                  <select id="estado" className="input" value={p.idEstado} onChange={(e) => Number(e.target.value) === 2 ? setConfirmarRecuperar(true) : cambiarEstado(e.target.value)}>
                    {estadosTipo.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {p.esAutor && <Link to={`/publicaciones/${id}/editar`} className="btn btn-secundario">✏️ Editar</Link>}
                {p.esAutor && p.idTipo === 2 && !p.custodia && <Link to={`/publicaciones/${id}/editar?traslado=1`} className="btn btn-secundario">Informar traslado a un refugio</Link>}
                {p.esAutor && p.idTipo === 1 && <button className="btn btn-secundario" onClick={descargarCartel} disabled={generando}>📄 {generando ? 'Generando…' : 'Cartel PDF'}</button>}
                {p.esAutor && p.idTipo !== 3 && <Link to={`/coincidencias?publicacion=${id}`} className="btn btn-secundario">🤖 Coincidencias</Link>}
                {esAdmin && !p.esAutor ? <Link to="/admin?vista=publicaciones" className="btn btn-secundario">Ir a moderación</Link> : <button className="btn btn-peligro" onClick={() => setConfirmarEliminar(true)}>Eliminar</button>}
              </div>
            </div>
          )}

          {!p.esAutor && (
            <div className="panel space-y-3 p-5">
              <h2 className="text-base">{p.idTipo === 3 ? '¿Quieres adoptar?' : p.idTipo === 1 ? '¿La has visto?' : '¿Es tu mascota?'}</h2>
              {!usuario ? (
                <p className="text-sm text-suave">
                  <Link to="/login" state={{ desde: `/publicaciones/${id}` }} className="font-semibold text-lavanda hover:underline">Inicia sesión</Link> para ver los datos de contacto.
                </p>
              ) : p.idTipo === 3 && !contactosAdopcion ? (
                p.idEstado === 5
                  ? <button className="btn btn-exito w-full" onClick={meInteresa}>💚 Me interesa adoptar a {nombre}</button>
                  : <p className="text-sm text-suave">{nombre} ya fue adoptado. ¡Gracias por tu interés!</p>
              ) : (
                <EnlacesContacto contactos={contactos} nombre={nombre} />
              )}
              {p.idTipo === 1 && p.idEstado === 1 && (
                <>
                  <p className="text-xs text-suave">¿Viste un animal parecido? <Link to={`/reportar?tipo=2&referencia=${id}`} className="text-lavanda underline">Registra un avistamiento en esta publicación</Link>.</p>
                  <div className="space-y-2 border-t border-borde pt-3">
                    <p className="text-sm text-suave">Si ya entregaste al animal, informa qué refugio lo recibió para que pueda coordinar con los posibles propietarios.</p>
                    <Link to={`/reportar?tipo=2&traslado=1&referencia=${id}`} className="btn btn-secundario w-full sm:w-auto">Informar traslado a un refugio</Link>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {p.idTipo === 1 && <AvistamientosPublicacion key={p.id} publicacion={p} avistamientoPublicado={state?.avistamientoPublicado} />}

      <ConfirmarRecuperacion nombre={nombre} abierto={confirmarRecuperar} alCerrar={() => setConfirmarRecuperar(false)}
        alConfirmar={() => { setConfirmarRecuperar(false); cambiarEstado(2); }} />
      <Modal titulo="Eliminar publicación" abierto={confirmarEliminar} alCerrar={() => setConfirmarEliminar(false)}>
        <p className="text-sm text-suave">¿Seguro que deseas eliminar la publicación de {nombre}? Esta acción no se puede deshacer.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-secundario" onClick={() => setConfirmarEliminar(false)}>Cancelar</button>
          <button className="btn btn-peligro" onClick={eliminar}>Eliminar</button>
        </div>
      </Modal>
      <p className="sr-only">{textoTipoPublicacion(p)}</p>
    </div>
  );
}
