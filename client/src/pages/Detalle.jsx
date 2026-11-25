import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, urlArchivo } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCatalogos } from '../context/CatalogosContext';
import Mapa from '../components/Mapa';
import {
  Alerta, Cargando, ESTILO_TIPO, IconoEspecie, InsigniaEstado, InsigniaTipo, Modal, formatoFecha, formatoFechaHora,
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

function enlaceContacto(c, nombre) {
  if (c.tipo === 'WhatsApp') return `https://wa.me/593${c.valor.replace(/^0/, '')}?text=${encodeURIComponent(`Hola, te escribo por ${nombre} que vi en FindMyPet`)}`;
  if (c.tipo === 'Teléfono') return `tel:${c.valor}`;
  return `mailto:${c.valor}`;
}

export default function Detalle() {
  const { id } = useParams();
  const { state } = useLocation();
  const navegar = useNavigate();
  const { usuario, esAdmin } = useAuth();
  const { catalogos } = useCatalogos();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState(state?.creada ? '¡Publicación creada! Estamos buscando coincidencias en segundo plano.' : '');
  const [activa, setActiva] = useState(0);
  const [contactosAdopcion, setContactosAdopcion] = useState(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [generando, setGenerando] = useState(false);

  const cargar = useCallback(() => api.get(`/publicaciones/${id}`).then(setP).catch((e) => setError(e.message)), [id]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error && !p) return <div className="mx-auto max-w-5xl px-4 py-8"><Alerta>{error}</Alerta></div>;
  if (!p) return <Cargando />;

  const nombre = p.nombreAnimal || 'Sin nombre';
  const archivo = p.multimedia[activa];
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
                <button key={m.id} onClick={() => setActiva(i)} aria-label={`Ver archivo ${i + 1}`}
                  className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${i === activa ? 'border-violeta' : 'border-transparent opacity-70'}`}>
                  {m.tipo === 'Video' ? <span className="flex h-full items-center justify-center bg-black text-xl">▶</span> : <img src={urlArchivo(m.url)} alt="" className="h-full w-full object-cover" />}
                </button>
              ))}
            </div>
          )}
          {p.idTipo !== 3 && p.ubicacion?.latitud && (
            <div className="panel p-3">
              <p className="mb-2 text-xs font-semibold text-suave">{p.idTipo === 1 ? 'Último lugar donde fue vista' : 'Lugar del hallazgo'}</p>
              <Mapa punto={p.ubicacion} color={COLOR_TIPO[p.idTipo]} alto="h-56" />
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2"><InsigniaTipo idTipo={p.idTipo} /><InsigniaEstado idEstado={p.idEstado} estado={p.estado} /></div>
            <h1 className="mt-3 text-3xl text-lavanda sm:text-4xl">{nombre}</h1>
            <p className="mt-1 text-sm text-suave">
              {p.idTipo === 3 ? <>Publicado por <Link to={`/refugios/${p.idRefugio}`} className="text-lavanda hover:underline">{p.refugio}</Link></> : <>📍 {p.ubicacion?.sector}, {p.ubicacion?.canton} · {formatoFecha(p.fechaEvento)}</>}
            </p>
          </div>

          <Alerta tipo="exito">{aviso}</Alerta>
          <Alerta>{error}</Alerta>

          <dl className="panel grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
            <Dato titulo="Especie" valor={p.especie} />
            <Dato titulo="Raza" valor={p.raza || 'No indicada'} />
            <Dato titulo="Tamaño" valor={p.tamano || 'No indicado'} />
            <Dato titulo="Color" valor={p.colores.map((c) => c.nombre).join(', ') || 'No indicado'} />
            {p.idTipo !== 3 && <Dato titulo={p.idTipo === 1 ? 'Desapareció' : 'Encontrada'} valor={formatoFecha(p.fechaEvento)} />}
            {p.idTipo === 3 && <Dato titulo="Estado de salud" valor={p.estadoSalud} />}
            {p.ubicacion?.direccion && <Dato titulo="Referencia" valor={p.ubicacion.direccion} />}
          </dl>

          <p className="whitespace-pre-line text-sm leading-relaxed">{p.descripcion}</p>
          <p className="text-xs text-suave">Publicado el {formatoFechaHora(p.fechaCreacion)}{p.autor && ` por ${p.autor}`}</p>

          {(p.esAutor || esAdmin) && (
            <div className="panel space-y-3 p-5">
              <h2 className="text-base">{p.esAutor ? 'Tu publicación' : 'Moderación'}</h2>
              {p.esAutor && (
                <div>
                  <label className="etiqueta" htmlFor="estado">Estado del caso</label>
                  <select id="estado" className="input" value={p.idEstado} onChange={(e) => cambiarEstado(e.target.value)}>
                    {estadosTipo.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {p.esAutor && <Link to={`/publicaciones/${id}/editar`} className="btn btn-secundario">✏️ Editar</Link>}
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
                <div className="flex flex-wrap gap-2">
                  {contactos?.map((c) => (
                    <a key={c.tipo} href={enlaceContacto(c, nombre)} target="_blank" rel="noreferrer" className={`btn ${c.tipo === 'WhatsApp' ? 'btn-exito' : 'btn-secundario'}`}>
                      {{ WhatsApp: '💬', Teléfono: '📞', Correo: '✉️' }[c.tipo]} {c.valor}
                    </a>
                  ))}
                </div>
              )}
              {p.idTipo === 1 && <p className="text-xs text-suave">¿Encontraste un animal parecido? <Link to="/reportar?tipo=2" className="text-lavanda underline">Repórtalo</Link> y la IA avisará a su dueño.</p>}
            </div>
          )}
        </div>
      </div>

      <Modal titulo="Eliminar publicación" abierto={confirmarEliminar} alCerrar={() => setConfirmarEliminar(false)}>
        <p className="text-sm text-suave">¿Seguro que deseas eliminar la publicación de {nombre}? Esta acción no se puede deshacer.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-secundario" onClick={() => setConfirmarEliminar(false)}>Cancelar</button>
          <button className="btn btn-peligro" onClick={eliminar}>Eliminar</button>
        </div>
      </Modal>
      <p className="sr-only">{ESTILO_TIPO[p.idTipo].texto}</p>
    </div>
  );
}
