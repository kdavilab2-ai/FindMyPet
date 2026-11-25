import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, urlArchivo } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCatalogos } from '../context/CatalogosContext';
import { Alerta, Cargando } from '../components/Comunes';
import SelectorUbicacion, { ubicacionDesdeApi } from '../components/SelectorUbicacion';

const hoy = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const MAX = 5;
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];

const PESTANAS = [
  { tipo: 1, texto: 'Perdida', consejo: 'Una foto reciente y nítida, de frente y de cuerpo entero, aumenta las posibilidades de encontrarla.' },
  { tipo: 2, texto: 'Encontrada', consejo: 'Fotografía al animal desde varios ángulos y anota señas particulares: collar, manchas o cicatrices.' },
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

  const [tipo, setTipo] = useState(Number(params.get('tipo')) || 1);
  const [datos, setDatos] = useState({
    nombreAnimal: '', idEspecie: '1', idRaza: '', idTamano: '', colores: [], descripcion: '', fechaEvento: hoy(),
    estadoSalud: '', telefono: '', whatsapp: usuario?.telefono || '', correoContacto: '',
  });
  const [ubicacion, setUbicacion] = useState(ubicacionDesdeApi(null));
  const [existentes, setExistentes] = useState([]);
  const [quitar, setQuitar] = useState([]);
  const [nuevos, setNuevos] = useState([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(Boolean(id));

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
      });
      if (p.idTipo !== 3) setUbicacion(ubicacionDesdeApi(p.ubicacion));
      setExistentes(p.multimedia);
      setCargando(false);
    }).catch((e) => { setError(e.message); setCargando(false); });
  }, [id]);

  const razas = useMemo(() => catalogos?.razas.filter((r) => r.idEspecie === Number(datos.idEspecie)) || [], [catalogos, datos.idEspecie]);
  const campo = (clave) => ({ value: datos[clave], onChange: (e) => setDatos({ ...datos, [clave]: e.target.value }) });
  const totalArchivos = existentes.filter((m) => !quitar.includes(m.id)).length + nuevos.length;

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
    if (totalArchivos < 1) return setError('Agregue al menos una foto (máximo 5)');
    if (datos.descripcion.trim().length < 10) return setError('La descripción debe tener al menos 10 caracteres');
    if (!datos.telefono && !datos.whatsapp && !datos.correoContacto) return setError('Ingrese al menos un dato de contacto');
    for (const t of [datos.telefono, datos.whatsapp]) if (t && !/^0\d{9}$/.test(t)) return setError('Los teléfonos deben tener 10 dígitos y empezar con 0');
    if (tipo !== 3 && !ubicacion.idSector) return setError('Seleccione la provincia, el cantón y el sector');

    const f = new FormData();
    f.append('tipo', tipo);
    for (const [k, v] of Object.entries(datos)) if (k !== 'colores') f.append(k, v);
    f.append('colores', datos.colores.join(','));
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
  const pestana = PESTANAS.find((p) => p.tipo === tipo);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="titulo-pagina">{id ? 'Editar publicación' : 'Reportar mascota'}</h1>
      <p className="mt-1 text-sm text-suave">Completa los datos para difundir el caso.</p>

      {!id && (
        <div className="mt-5 inline-flex rounded-xl border border-borde bg-panel p-1" role="tablist">
          {PESTANAS.map((p) => (
            <button key={p.tipo} type="button" role="tab" aria-selected={tipo === p.tipo}
              disabled={p.tipo === 3 && !puedeAdopcion}
              title={p.tipo === 3 && !puedeAdopcion ? 'Solo refugios autorizados' : undefined}
              onClick={() => setTipo(p.tipo)}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${tipo === p.tipo ? 'bg-violeta text-white' : 'text-suave hover:text-texto'}`}>
              {p.texto}
            </button>
          ))}
        </div>
      )}
      {!id && !puedeAdopcion && <p className="mt-2 text-xs text-suave">Las adopciones las publican refugios y fundaciones autorizados.</p>}

      <form onSubmit={enviar} className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="panel space-y-5 p-5 sm:p-6">
          <Alerta>{error}</Alerta>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="etiqueta" htmlFor="nombre">Nombre de la mascota{tipo === 2 && ' (si lo sabe)'}</label>
              <input id="nombre" className="input" maxLength={60} required={tipo !== 2} placeholder={tipo === 2 ? 'Sin nombre' : 'Ej. Toby'} {...campo('nombreAnimal')} />
            </div>
            <div>
              <label className="etiqueta" htmlFor="especie">Especie</label>
              <select id="especie" className="input" value={datos.idEspecie} onChange={(e) => setDatos({ ...datos, idEspecie: e.target.value, idRaza: '' })}>
                {catalogos.especies.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta" htmlFor="raza">Raza</label>
              <select id="raza" className="input" {...campo('idRaza')}>
                <option value="">No sé</option>
                {razas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta" htmlFor="tamano">Tamaño</label>
              <select id="tamano" className="input" {...campo('idTamano')}>
                <option value="">No sé</option>
                {catalogos.tamanos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
          </div>

          <fieldset>
            <legend className="etiqueta">Color (puede elegir varios)</legend>
            <div className="flex flex-wrap gap-2">
              {catalogos.colores.map((c) => (
                <button key={c.id} type="button" onClick={() => alternarColor(c.id)} aria-pressed={datos.colores.includes(c.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${datos.colores.includes(c.id) ? 'border-violeta bg-violeta/25 text-texto' : 'border-borde text-suave hover:text-texto'}`}>
                  {c.nombre}
                </button>
              ))}
            </div>
          </fieldset>

          {tipo === 3 ? (
            <div>
              <label className="etiqueta" htmlFor="salud">Estado de salud</label>
              <input id="salud" className="input" maxLength={200} required placeholder="Ej. Vacunado, desparasitado y esterilizado" {...campo('estadoSalud')} />
            </div>
          ) : (
            <>
              <div>
                <span className="etiqueta">{tipo === 1 ? 'Último lugar donde fue vista' : 'Lugar donde la encontraste'}</span>
                <SelectorUbicacion valor={ubicacion} alCambiar={setUbicacion} />
              </div>
              <div className="sm:w-1/2">
                <label className="etiqueta" htmlFor="fecha">{tipo === 1 ? 'Fecha de la desaparición' : 'Fecha del hallazgo'}</label>
                <input id="fecha" type="date" required max={hoy()} className="input" {...campo('fechaEvento')} />
              </div>
            </>
          )}

          <div>
            <label className="etiqueta" htmlFor="descripcion">Descripción y señas particulares</label>
            <textarea id="descripcion" required rows={4} maxLength={2000} className="input" placeholder="Collar rojo, mancha blanca en el pecho…" {...campo('descripcion')} />
          </div>

          <fieldset>
            <legend className="etiqueta">Contacto (al menos uno; solo lo verán usuarios registrados)</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <input className="input" inputMode="numeric" placeholder="WhatsApp 09XXXXXXXX" aria-label="WhatsApp" {...campo('whatsapp')} />
              <input className="input" inputMode="numeric" placeholder="Teléfono 09XXXXXXXX" aria-label="Teléfono" {...campo('telefono')} />
              <input className="input" type="email" placeholder="Correo" aria-label="Correo de contacto" {...campo('correoContacto')} />
            </div>
          </fieldset>

          <div className="flex justify-end gap-3 border-t border-borde pt-5">
            <button type="button" className="btn btn-secundario" onClick={() => navegar(-1)}>Cancelar</button>
            <button className="btn btn-primario px-8" disabled={enviando}>{enviando ? (catalogos.iaDisponible ? 'Validando fotos con IA…' : 'Publicando…') : id ? 'Guardar cambios' : 'Publicar'}</button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="panel p-4">
            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violeta/50 px-4 py-8 text-center transition hover:bg-violeta/5"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); agregarArchivos([...e.dataTransfer.files]); }}
            >
              <span className="text-4xl text-violeta" aria-hidden="true">🐾</span>
              <span className="font-semibold">Agregar fotos ({totalArchivos} de {MAX})</span>
              <span className="text-xs text-suave">Arrastra o haz clic · JPG, PNG o WEBP hasta 5 MB · video MP4 hasta 20 MB</span>
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
            {catalogos.iaDisponible && <p className="mt-3 text-xs text-suave">🤖 La IA verificará que cada foto muestre un animal (RF-22).</p>}
          </div>
          <div className="rounded-2xl border border-ambar/30 bg-ambar/5 p-4">
            <p className="font-bold text-ambar">Consejo</p>
            <p className="mt-1 text-sm text-suave">{pestana.consejo}</p>
          </div>
          {tipo !== 3 && (
            <div className="rounded-2xl border border-violeta/30 bg-violeta/5 p-4 text-sm text-suave">
              <p className="font-bold text-lavanda">Coincidencias con IA</p>
              <p className="mt-1">Al publicar, compararemos tu reporte con los {tipo === 1 ? 'animales encontrados' : 'reportes de mascotas perdidas'} y te avisaremos si hay uno parecido. <Link to="/coincidencias" className="text-lavanda underline">Ver coincidencias</Link></p>
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
