import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, urlArchivo } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCatalogos } from '../context/CatalogosContext';
import { Alerta, Cargando } from '../components/Comunes';
import SelectorUbicacion, { ubicacionDesdeApi } from '../components/SelectorUbicacion';
import EncabezadoFigma from '../components/EncabezadoFigma';
import IconoFigma from '../components/IconoFigma';

const hoy = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const MAX = 5;
const ESPECIE_OTRO = '5';
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];

const PESTANAS = [
  { tipo: 1, texto: 'Perdida', consejo: 'Una foto reciente y nítida, de frente y de cuerpo entero, aumenta las posibilidades de encontrarla.' },
  { tipo: 2, texto: 'Avistamiento', consejo: 'Fotografía al animal desde varios ángulos y anota señas particulares como un collar, manchas o cicatrices.' },
  { tipo: 3, texto: 'Adopción', consejo: 'Cuenta su carácter, su estado de salud y con qué tipo de familia se llevaría mejor.' },
];

// Figura 4 y 9: formulario para reportar (RF-04, RF-07, RF-12, RF-20, RF-21). También sirve para editar (RF-05).
export default function Reportar() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const { usuario, refugioAutorizado, esAdmin } = useAuth();
  const { catalogos } = useCatalogos();
  const puedeAdopcion = refugioAutorizado || esAdmin;
  const solicitaTraslado = params.get('traslado') === '1';
  const referencia = !id && solicitaTraslado ? params.get('referencia') : null;

  const [tipoElegido, setTipo] = useState(() => {
    const tipoSolicitado = Number(params.get('tipo'));
    return tipoSolicitado === 2 || (tipoSolicitado === 3 && puedeAdopcion) ? tipoSolicitado : 1;
  });
  const tipo = !id && solicitaTraslado ? 2 : tipoElegido;
  const [datos, setDatos] = useState({
    nombreAnimal: '', idEspecie: '1', idRaza: '', idTamano: '', colores: [], descripcion: '', fechaEvento: hoy(),
    estadoSalud: '', telefono: '', whatsapp: usuario?.telefono || '', correoContacto: '',
    idRefugioCustodia: '', notasCustodia: '',
  });
  const [horaEvento, setHoraEvento] = useState('');
  const [senasHallazgo, setSenasHallazgo] = useState('');
  const [ubicacion, setUbicacion] = useState(ubicacionDesdeApi(null));
  const [existentes, setExistentes] = useState([]);
  const [quitar, setQuitar] = useState([]);
  const [nuevos, setNuevos] = useState([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(Boolean(id || referencia));
  const [especieReferencia, setEspecieReferencia] = useState('');
  const [refugios, setRefugios] = useState(null);
  const [errorRefugios, setErrorRefugios] = useState('');
  const [custodia, setCustodia] = useState(null);
  const informaTraslado = tipo === 2 && (solicitaTraslado || Boolean(custodia));
  const formularioTraslado = informaTraslado && solicitaTraslado;

  useEffect(() => {
    if (!informaTraslado) return;
    let vigente = true;
    setErrorRefugios('');
    api.get('/refugios').then((lista) => { if (vigente) setRefugios(lista); })
      .catch((e) => { if (vigente) setErrorRefugios(e.message); });
    return () => { vigente = false; };
  }, [informaTraslado]);

  useEffect(() => {
    if (!referencia) return;
    let vigente = true;
    setCargando(true);
    setEspecieReferencia('');
    api.get(`/publicaciones/${encodeURIComponent(referencia)}`)
      .then((p) => { if (vigente && p.idTipo === 1) setEspecieReferencia(String(p.idEspecie)); })
      .catch(() => { /* Si falta la ficha, se usa la categoría Otro. */ })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [referencia]);

  useEffect(() => {
    if (!id) return;
    api.get(`/publicaciones/${id}`).then((p) => {
      setTipo(p.idTipo);
      const contacto = (t) => p.contactos?.find((c) => c.tipo === t)?.valor || '';
      setDatos({
        nombreAnimal: p.nombreAnimal || '', idEspecie: String(p.idEspecie), idRaza: p.idRaza ? String(p.idRaza) : '',
        idTamano: p.idTamano ? String(p.idTamano) : '', colores: p.colores.map((c) => c.id), descripcion: p.descripcion,
        fechaEvento: p.fechaEvento || hoy(), estadoSalud: p.estadoSalud || '',
        telefono: contacto('Teléfono'), whatsapp: contacto('WhatsApp'), correoContacto: contacto('Correo'),
        idRefugioCustodia: String(p.custodia?.idRefugio || ''), notasCustodia: p.notasCustodia || '',
      });
      setHoraEvento(p.horaEvento || '');
      setCustodia(p.custodia);
      if (p.idTipo !== 3) setUbicacion(ubicacionDesdeApi(p.ubicacion));
      setExistentes(p.multimedia);
      setCargando(false);
    }).catch((e) => { setError(e.message); setCargando(false); });
  }, [id]);

  const razas = useMemo(() => catalogos?.razas.filter((r) => r.idEspecie === Number(datos.idEspecie)) || [], [catalogos, datos.idEspecie]);
  const campo = (clave) => ({ value: datos[clave], onChange: (e) => setDatos({ ...datos, [clave]: e.target.value }) });
  const conservados = existentes.filter((m) => !quitar.includes(m.id));
  const totalArchivos = conservados.length + nuevos.length;
  const hayFoto = conservados.some((m) => m.tipo === 'Imagen') || nuevos.some((m) => !m.video);

  const agregarArchivos = (lista) => {
    setError('');
    const validos = [];
    for (const archivo of lista) {
      if (!TIPOS_PERMITIDOS.includes(archivo.type)) { setError(`"${archivo.name}" no es JPG, PNG, WEBP ni video MP4`); continue; }
      const limite = archivo.type.startsWith('video/') ? 20 : 5;
      if (archivo.size > limite * 1024 * 1024) { setError(`"${archivo.name}" supera los ${limite} MB`); continue; }
      validos.push({ archivo, url: URL.createObjectURL(archivo), video: archivo.type.startsWith('video/') });
    }
    const espacio = MAX - totalArchivos;
    if (validos.length > espacio) setError(`Puede subir como máximo ${MAX} fotos o videos`);
    setNuevos([...nuevos, ...validos.slice(0, Math.max(0, espacio))]);
  };

  const alternarColor = (idColor) => setDatos({
    ...datos, colores: datos.colores.includes(idColor) ? datos.colores.filter((c) => c !== idColor) : [...datos.colores, idColor],
  });

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (informaTraslado && !datos.idRefugioCustodia) return setError('Selecciona el refugio al que ya fue trasladado el animal');
    if (!hayFoto) {
      setError('Agregue al menos una foto. Los videos son opcionales.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (datos.descripcion.trim().length < 10) {
      return setError(formularioTraslado ? 'Describe el estado en que encontraste al animal (al menos 10 caracteres)' : 'La descripción debe tener al menos 10 caracteres');
    }
    const senas = formularioTraslado ? senasHallazgo.trim() : '';
    const descripcion = senas ? `${datos.descripcion.trim()}\n\nSeñas particulares: ${senas}` : datos.descripcion;
    if (descripcion.length > 2000) return setError('El estado y las señas particulares admiten hasta 2000 caracteres en total');
    const whatsapp = datos.whatsapp.replace(/[ -]/g, '');
    if (!datos.telefono && !whatsapp && !datos.correoContacto) return setError('Ingrese al menos un dato de contacto');
    if (datos.telefono && !/^0\d{9}$/.test(datos.telefono)) return setError('El teléfono debe tener 10 dígitos y empezar con 0');
    if (whatsapp && !/^(?:0\d{9}|\+593[1-9]\d{8})$/.test(whatsapp)) {
      return setError('Ingrese un WhatsApp ecuatoriano de 10 dígitos o use +593 sin el cero inicial');
    }
    if (tipo !== 3 && !ubicacion.idSector) return setError('Seleccione la provincia, el cantón y el sector');

    const f = new FormData();
    f.append('tipo', tipo);
    const { colores, idRefugioCustodia, notasCustodia, ...camposReporte } = { ...datos, descripcion };
    for (const [k, v] of Object.entries(camposReporte)) f.append(k, v);
    if (formularioTraslado && !id) f.set('idEspecie', especieReferencia || ESPECIE_OTRO);
    f.append('colores', colores.join(','));
    if (tipo === 2) {
      f.append('horaEvento', e.currentTarget.elements.horaEvento.value);
      if (informaTraslado) {
        f.append('situacionTraslado', 'realizado');
        f.append('idRefugioCustodia', idRefugioCustodia);
        f.append('notasCustodia', notasCustodia);
      }
    }
    if (tipo !== 3) for (const [k, v] of Object.entries(ubicacion)) if (v !== null && v !== undefined) f.append(k, v);
    if (quitar.length) f.append('quitarArchivos', quitar.join(','));
    nuevos.forEach((n) => f.append('archivos', n.archivo));

    setEnviando(true);
    try {
      const p = id ? await api.formulario(`/publicaciones/${id}`, f, 'PUT') : await api.formulario('/publicaciones', f);
      navegar(`/publicaciones/${p.id}`, { state: { creada: !id } });
    } catch (err) {
      setError(err.message);
      setEnviando(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (!catalogos || cargando) return <Cargando />;
  const pestana = PESTANAS.find((p) => p.tipo === tipo) || PESTANAS[0];
  const refugioSeleccionado = refugios?.find((r) => String(r.id) === datos.idRefugioCustodia)
    || (String(custodia?.idRefugio) === datos.idRefugioCustodia ? { id: custodia.idRefugio, nombre: custodia.nombre } : null);

  return (
    <div className="figma-pagina figma-reportar">
      <EncabezadoFigma titulo={informaTraslado && solicitaTraslado ? 'Informar traslado a un refugio' : id ? 'Editar publicación' : 'Reportar mascota'} volverA={id ? '/mis-reportes' : '/'}>
        {formularioTraslado ? 'Indica dónde encontraste al animal, cómo estaba y a qué refugio lo entregaste.' : 'Completa los datos para difundir el caso.'}
      </EncabezadoFigma>

      {!id && !informaTraslado && (
        <div className="figma-selector-tipo" role="group" aria-label="Tipo de reporte">
          {PESTANAS.map((p) => (
            <button key={p.tipo} type="button" aria-pressed={tipo === p.tipo}
              disabled={p.tipo === 3 && !puedeAdopcion}
              title={p.tipo === 3 && !puedeAdopcion ? 'Solo refugios autorizados' : undefined}
              onClick={() => setTipo(p.tipo)}
              className={`btn ${tipo === p.tipo ? 'btn-primario' : 'text-suave hover:text-texto'}`}>
              {p.texto}
            </button>
          ))}
        </div>
      )}
      {!id && !informaTraslado && !puedeAdopcion && <p className="mt-2 text-xs text-suave">Las adopciones las publican refugios y fundaciones autorizados.</p>}
      {tipo === 2 && !informaTraslado && <p className="mt-3 max-w-2xl text-sm text-suave">¿Viste un animal parecido a una mascota perdida? Registra el avistamiento. Si la comparación sugiere una coincidencia, avisaremos a su propietario. El reporte de desaparición seguirá activo hasta que su propietario confirme la recuperación.</p>}

      <form onSubmit={enviar} className="figma-formulario-reporte">
        {error && <div className="figma-error-reporte"><Alerta>{error}</Alerta></div>}
        {informaTraslado && <fieldset className="panel figma-traslado-reporte space-y-3 p-4 sm:p-5">
          <legend className="px-2 font-bold text-lavanda">Entrega al refugio</legend>
          <Alerta>{errorRefugios}</Alerta>
          {!refugios && !errorRefugios && <p role="status" className="text-sm text-suave">Cargando refugios…</p>}
          {refugios?.length === 0 && !custodia && <p className="text-sm text-suave">No hay refugios disponibles.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="etiqueta" htmlFor="custodia">{formularioTraslado ? '¿Qué refugio recibió al animal?' : 'Refugio que recibió al animal'}</label>
              <select id="custodia" className="input" required disabled={Boolean(custodia?.confirmadaEn) || !refugios?.length} {...campo('idRefugioCustodia')}>
                <option value="">Selecciona un refugio</option>
                {custodia && !refugios?.some((r) => r.id === custodia.idRefugio) && <option value={custodia.idRefugio}>{custodia.nombre}</option>}
                {refugios?.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              {refugioSeleccionado && <p className="mt-2 text-sm font-semibold text-lavanda">Refugio seleccionado: {refugioSeleccionado.nombre}</p>}
              {custodia?.confirmadaEn && <p className="mt-1 text-xs text-suave">El refugio ya confirmó la recepción.</p>}
              <Link to="/refugios" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-lavanda underline">Consultar refugios disponibles (nueva pestaña)</Link>
            </div>
            {datos.idRefugioCustodia && <div>
              <label className="etiqueta" htmlFor="notas-custodia">{formularioTraslado ? '¿Qué más debe saber el refugio? (opcional)' : 'Notas de entrega (opcional)'}</label>
              <textarea id="notas-custodia" className="input" maxLength={500} rows={2}
                placeholder={formularioTraslado ? 'Quién lo recibió, qué cuidados le diste o qué necesita ahora.' : undefined} {...campo('notasCustodia')} />
              <p className="text-xs text-suave">Solo las cuentas vinculadas al traslado pueden ver estas notas.</p>
            </div>}
          </div>
        </fieldset>}
        <div className="panel figma-campos-reporte">
          {formularioTraslado && <>
            <h2 className="text-base text-lavanda">Sobre el hallazgo</h2>
            <div>
              <label className="etiqueta" htmlFor="descripcion">¿En qué estado lo encontraste?</label>
              <textarea id="descripcion" required rows={3} maxLength={2000} className="input"
                placeholder="Ej. Estaba asustado y cojeaba." {...campo('descripcion')} />
            </div>
          </>}
          {!formularioTraslado && <div className="figma-rasgos-reporte">
            <div className="figma-nombre-reporte">
              <label className="etiqueta" htmlFor="nombre">Nombre de la mascota{tipo === 2 && ' (si lo sabe)'}</label>
              <input id="nombre" className="input" maxLength={60} required={tipo !== 2} placeholder={tipo === 2 ? 'Sin nombre' : 'Ej. Toby'} {...campo('nombreAnimal')} />
            </div>
            <div className="figma-especie-reporte">
              <label className="etiqueta" htmlFor="especie">Especie</label>
              <select id="especie" className="input" value={datos.idEspecie} onChange={(e) => setDatos({ ...datos, idEspecie: e.target.value, idRaza: '' })}>
                {catalogos.especies.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div className="figma-raza-reporte">
              <label className="etiqueta" htmlFor="raza">Raza</label>
              <select id="raza" className="input" {...campo('idRaza')}>
                <option value="">No sé</option>
                {razas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div className="figma-tamano-reporte">
              <label className="etiqueta" htmlFor="tamano">Tamaño</label>
              <select id="tamano" className="input" {...campo('idTamano')}>
                <option value="">No sé</option>
                {catalogos.tamanos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div className="figma-color-reporte">
              <span className="etiqueta">Color</span>
              <details className="figma-detalles-campo">
                <summary className="input" aria-label="Colores de la mascota">
                  {catalogos.colores.filter((color) => datos.colores.includes(color.id)).map((color) => color.nombre).join(', ') || 'Seleccionar colores'}
                </summary>
                <fieldset className="mt-2 flex flex-wrap gap-2">
                  <legend className="sr-only">Colores (puede elegir varios)</legend>
                  {catalogos.colores.map((c) => (
                    <button key={c.id} type="button" onClick={() => alternarColor(c.id)} aria-pressed={datos.colores.includes(c.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${datos.colores.includes(c.id) ? 'border-violeta bg-violeta/25 text-texto' : 'border-borde text-suave hover:text-texto'}`}>
                      {c.nombre}
                    </button>
                  ))}
                </fieldset>
              </details>
            </div>
          </div>}

          {tipo === 3 ? (
            <div>
              <label className="etiqueta" htmlFor="salud">Estado de salud</label>
              <input id="salud" className="input" maxLength={200} required placeholder="Ej. Vacunado, desparasitado y esterilizado" {...campo('estadoSalud')} />
            </div>
          ) : (
            <>
              <div>
                <span className="etiqueta">{formularioTraslado ? '¿Dónde lo localizaste?' : tipo === 1 ? 'Último lugar donde fue vista' : 'Lugar del avistamiento'}</span>
                <details className="figma-detalles-campo" onInvalid={(e) => { e.currentTarget.open = true; }}>
                  <summary className="input">
                    {[catalogos.sectores.find((s) => s.id === Number(ubicacion.idSector))?.nombre,
                      catalogos.cantones.find((c) => c.id === Number(ubicacion.idCanton))?.nombre].filter(Boolean).join(', ') || 'Seleccionar ubicación'}
                  </summary>
                  <div className="mt-3"><SelectorUbicacion valor={ubicacion} alCambiar={setUbicacion} /></div>
                </details>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="etiqueta" htmlFor="fecha">{formularioTraslado ? 'Fecha del hallazgo' : tipo === 1 ? 'Fecha de la desaparición' : 'Fecha del avistamiento'}</label>
                  <input id="fecha" type="date" required max={hoy()} className="input" {...campo('fechaEvento')} /></div>
                {tipo === 2 && <div><label className="etiqueta" htmlFor="hora">Hora aproximada (opcional)</label>
                  <input id="hora" name="horaEvento" type="time" className="input" defaultValue={horaEvento}
                    onInput={(e) => setHoraEvento(e.currentTarget.value)} /></div>}
              </div>
            </>
          )}

          {formularioTraslado ? (
            <div>
              <label className="etiqueta" htmlFor="senas-hallazgo">¿Qué señas particulares observaste? (opcional)</label>
              <textarea id="senas-hallazgo" rows={2} maxLength={500} className="input"
                placeholder="Ej. Collar rojo o una mancha blanca en el pecho." value={senasHallazgo} onChange={(e) => setSenasHallazgo(e.target.value)} />
              <p className="mt-1 text-xs text-suave">El estado y las señas se muestran en el avistamiento. Usa las notas de entrega para los detalles de coordinación.</p>
            </div>
          ) : (
            <div>
              <label className="etiqueta" htmlFor="descripcion">Descripción y señas particulares</label>
              <textarea id="descripcion" required rows={4} maxLength={2000} className="input" placeholder="Collar rojo, mancha blanca en el pecho…" {...campo('descripcion')} />
            </div>
          )}

          <fieldset>
            <legend className="etiqueta">Contacto (al menos uno; solo lo verán usuarios registrados)</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <input className="input" type="tel" placeholder="WhatsApp 09XXXXXXXX o +5939XXXXXXXX" aria-label="WhatsApp" {...campo('whatsapp')} />
              <input className="input" inputMode="numeric" placeholder="Teléfono 09XXXXXXXX" aria-label="Teléfono" {...campo('telefono')} />
              <input className="input" type="email" placeholder="Correo" aria-label="Correo de contacto" {...campo('correoContacto')} />
            </div>
          </fieldset>

          <div className="figma-acciones-reporte">
            <button type="button" className="btn btn-secundario" onClick={() => navegar(-1)}>Cancelar</button>
            <button className="btn btn-primario px-8" disabled={enviando || (informaTraslado && !custodia && !refugios?.length)}>{enviando ? (catalogos.iaDisponible ? 'Validando fotos con IA…' : 'Publicando…') : id ? 'Guardar cambios' : informaTraslado ? 'Registrar traslado' : tipo === 2 ? 'Registrar avistamiento' : 'Publicar reporte'}</button>
          </div>
        </div>

        <aside className="figma-adjuntos-reporte">
          <div>
            <label
              className="figma-carga-reporte"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); agregarArchivos([...e.dataTransfer.files]); }}
            >
              <IconoFigma nombre="pataSubida" />
              <span className="font-semibold">Agregar fotos y videos {totalArchivos > 0 && `(${totalArchivos} de ${MAX})`}</span>
              <span className="figma-ayuda-carga">Arrastra o haz clic para subir</span>
              <input type="file" multiple accept={TIPOS_PERMITIDOS.join(',')} className="sr-only" onChange={(e) => { agregarArchivos([...e.target.files]); e.target.value = ''; }} />
            </label>
            {(existentes.length > 0 || nuevos.length > 0) && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {existentes.filter((m) => !quitar.includes(m.id)).map((m) => (
                  <Miniatura key={`e${m.id}`} url={urlArchivo(m.url)} video={m.tipo === 'Video'} alQuitar={() => setQuitar([...quitar, m.id])} />
                ))}
                {nuevos.map((n, i) => (
                  <Miniatura key={n.url} url={n.url} video={n.video} alQuitar={() => setNuevos(nuevos.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-suave">Agrega al menos una foto. Puedes adjuntar hasta cinco archivos en total, incluidos videos.</p>
            {catalogos.iaDisponible && <p className="mt-3 text-xs text-suave">🤖 La IA verificará que cada foto muestre un animal (RF-22).</p>}
          </div>
          <div className="panel figma-consejo-reporte">
            <p className="font-bold text-ambar">Consejo</p>
            <p className="mt-1 text-sm text-suave">{pestana.consejo}</p>
          </div>
          {tipo !== 3 && (
            <div className="rounded-2xl border border-violeta/30 bg-violeta/5 p-4 text-sm text-suave">
              <p className="font-bold text-lavanda">Posibles coincidencias</p>
              <p className="mt-1">{tipo === 1 ? 'Compararemos tu reporte con los avistamientos y te avisaremos si hay alguna coincidencia.' : 'Compararemos el avistamiento con los reportes de mascotas perdidas y avisaremos a sus propietarios si hay similitudes.'} {catalogos.iaDisponible ? 'La comparación de fotos complementa los demás criterios.' : 'La comparación usa los datos del animal y del reporte.'} <Link to="/coincidencias" className="text-lavanda underline">Ver coincidencias</Link></p>
            </div>
          )}
        </aside>
      </form>
    </div>
  );
}

function Miniatura({ url, video, alQuitar }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-tarjeta">
      {video ? <video src={url} className="h-full w-full object-cover" muted /> : <img src={url} alt="" className="h-full w-full object-cover" />}
      <button type="button" onClick={alQuitar} aria-label="Quitar archivo" className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white hover:bg-perdida">✕</button>
    </div>
  );
}
