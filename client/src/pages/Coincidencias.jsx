import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, urlArchivo } from '../services/api';
import { Alerta, Cargando, Vacio, formatoFecha } from '../components/Comunes';

const COLOR_ESTADO = { 1: 'text-ambar', 2: 'text-adopcion', 3: 'text-suave' };

function Lado({ titulo, color, p }) {
  return (
    <Link to={`/publicaciones/${p.id}`} className="flex flex-1 items-center gap-3 rounded-xl bg-fondo/60 p-2.5 hover:bg-tarjeta">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-tarjeta">
        {p.foto && <img src={urlArchivo(p.foto)} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 text-sm">
        <span className={`text-[11px] font-bold uppercase ${color}`}>{titulo}</span>
        <p className="truncate font-semibold">{p.nombre || 'Sin nombre'} · {p.especie}</p>
        <p className="truncate text-xs text-suave">{p.sector} · {formatoFecha(p.fechaEvento)}</p>
      </div>
    </Link>
  );
}

// RF-10 y RF-11 (CU-08): revisar las coincidencias sugeridas por la IA y confirmarlas o descartarlas
export default function Coincidencias() {
  const [params] = useSearchParams();
  const publicacion = params.get('publicacion');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(() => {
    api.get(`/coincidencias${publicacion ? `?publicacion=${publicacion}` : ''}`).then(setDatos).catch((e) => setError(e.message));
  }, [publicacion]);
  useEffect(() => { cargar(); }, [cargar]);

  const responder = async (id, idEstado) => {
    try { await api.patch(`/coincidencias/${id}`, { idEstado }); cargar(); } catch (e) { setError(e.message); }
  };

  const analizar = async () => {
    setAnalizando(true);
    setAviso('');
    try {
      const r = await api.post(`/coincidencias/analizar/${publicacion}`);
      setAviso(r.nuevas ? `La IA encontró ${r.nuevas} coincidencia(s) nueva(s)` : 'Análisis terminado: no hay coincidencias nuevas por ahora');
      cargar();
    } catch (e) { setError(e.message); } finally { setAnalizando(false); }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Coincidencias con IA</h1>
          <p className="mt-1 max-w-2xl text-sm text-suave">
            Comparamos los reportes de mascotas perdidas con los animales encontrados por especie, raza, color, tamaño, ubicación, fecha y, si está activa, la foto.
            Revisa cada sugerencia y confirma si es tu mascota.
          </p>
        </div>
        {publicacion && <button className="btn btn-primario" onClick={analizar} disabled={analizando}>{analizando ? 'Analizando…' : '🤖 Analizar ahora'}</button>}
      </div>
      {publicacion && <p className="mb-3 text-sm"><Link to="/coincidencias" className="text-lavanda hover:underline">← Ver todas mis coincidencias</Link></p>}
      <Alerta tipo="exito">{aviso}</Alerta>
      <Alerta>{error}</Alerta>
      {!datos && !error && <Cargando texto="Cargando coincidencias" />}
      {datos && (datos.length === 0 ? (
        <Vacio titulo="Sin coincidencias por ahora">
          Cuando alguien reporte un animal parecido a tu mascota te avisaremos con una notificación.
        </Vacio>
      ) : (
        <ul className="space-y-4">
          {datos.map((c) => (
            <li key={c.id} className="panel p-4">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="text-3xl font-extrabold text-lavanda">{Math.round(c.porcentaje)} %</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-fondo" role="meter" aria-valuenow={c.porcentaje} aria-valuemin={0} aria-valuemax={100} aria-label="Similitud">
                  <div className="h-full rounded-full bg-gradient-to-r from-violeta-oscuro to-violeta" style={{ width: `${c.porcentaje}%` }} />
                </div>
                <span className={`text-sm font-semibold ${COLOR_ESTADO[c.idEstado]}`}>{c.estado}</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Lado titulo="Mascota perdida" color="text-perdida" p={c.desaparecida} />
                <span className="self-center text-xl text-suave" aria-hidden="true">⇄</span>
                <Lado titulo="Animal encontrado" color="text-hallada" p={c.encontrada} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.criterios?.map((cr) => (
                  <span key={cr.criterio} className={`rounded-full border px-2.5 py-0.5 text-xs ${cr.puntaje >= 70 ? 'border-adopcion/40 text-adopcion' : cr.puntaje >= 40 ? 'border-ambar/40 text-ambar' : 'border-borde text-suave'}`}>
                    {cr.criterio} {Math.round(cr.puntaje)}%
                  </span>
                ))}
              </div>
              {c.soyPropietario && c.idEstado === 1 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn btn-exito" onClick={() => responder(c.id, 2)}>✓ Es mi mascota</button>
                  <button className="btn btn-secundario" onClick={() => responder(c.id, 3)}>✕ No es</button>
                  <Link to={`/publicaciones/${c.encontrada.id}`} className="btn btn-secundario">Ver reporte y contactar</Link>
                </div>
              )}
              {!c.soyPropietario && c.idEstado === 2 && (
                <p className="mt-3 text-sm text-adopcion">El propietario confirmó que este animal es su mascota. Pronto se pondrá en contacto contigo.</p>
              )}
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
