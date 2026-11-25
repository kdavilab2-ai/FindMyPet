import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import TarjetaMascota from '../components/TarjetaMascota';
import { Alerta, Cargando, ESTILO_TIPO, Vacio } from '../components/Comunes';
import { Filtros } from './Listado';

// Figura 3 y Figura 8 del plan: buscador, resumen por tipo de caso y mascotas recientes
export default function Inicio() {
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const [resumen, setResumen] = useState(null);
  const [recientes, setRecientes] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/publicaciones/resumen').then(setResumen).catch(() => {});
    api.get('/publicaciones?activas=true').then((r) => setRecientes(r.datos.slice(0, 8))).catch((e) => setError(e.message));
  }, []);

  // Al filtrar desde el inicio se abre el listado del tipo elegido (o el de perdidas)
  const buscar = (cambios) => {
    const nuevos = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) { if (v) nuevos.set(k, v); else nuevos.delete(k); }
    const tipo = Number(nuevos.get('tipo')) || 1;
    nuevos.delete('tipo');
    navegar(`${ESTILO_TIPO[tipo].ruta}?${nuevos}`);
  };

  const tarjetas = [
    { tipo: 1, total: resumen?.desaparecidas, icono: '🐾' },
    { tipo: 2, total: resumen?.encontradas, icono: '🐾' },
    { tipo: 3, total: resumen?.adopcion, icono: '🐾' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <section className="mb-6">
        <h1 className="text-3xl text-lavanda sm:text-4xl">Encuentra, reporta o adopta</h1>
        <p className="mt-1 text-suave">Juntos podemos volver a casa.</p>
      </section>

      <div className="mb-6"><Filtros params={params} cambiar={buscar} compacto /></div>

      <div className="mb-8 grid grid-cols-3 gap-3">
        {tarjetas.map((t) => (
          <Link key={t.tipo} to={ESTILO_TIPO[t.tipo].ruta} className={`flex flex-col items-center gap-1 rounded-2xl p-3 text-center transition hover:brightness-110 sm:flex-row sm:gap-3 sm:p-5 sm:text-left ${ESTILO_TIPO[t.tipo].clase}`}>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xl" aria-hidden="true">{t.icono}</span>
            <span>
              <span className="block text-xs font-semibold sm:text-sm">{ESTILO_TIPO[t.tipo].plural}</span>
              <span className="block text-2xl font-extrabold sm:text-3xl">{t.total ?? '–'}</span>
            </span>
          </Link>
        ))}
      </div>
      {resumen?.resueltas > 0 && (
        <p className="-mt-4 mb-6 text-center text-sm text-suave">💜 {resumen.resueltas} {resumen.resueltas === 1 ? 'caso resuelto' : 'casos resueltos'} gracias a la comunidad</p>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl">Mascotas recientes</h2>
        <Link to="/perdidas" className="text-sm text-lavanda hover:underline">Ver todas</Link>
      </div>
      <Alerta>{error}</Alerta>
      {!recientes && !error && <Cargando />}
      {recientes && (recientes.length === 0
        ? <Vacio titulo="Aún no hay publicaciones">Sé el primero en reportar una mascota.</Vacio>
        : <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{recientes.map((p) => <TarjetaMascota key={p.id} p={p} />)}</div>)}
    </div>
  );
}
