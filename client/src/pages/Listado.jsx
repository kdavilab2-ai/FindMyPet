import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useCatalogos } from '../context/CatalogosContext';
import { useAuth } from '../context/AuthContext';
import TarjetaMascota from '../components/TarjetaMascota';
import { Alerta, Cargando, ESTILO_TIPO, Vacio } from '../components/Comunes';

const DESCRIPCION = {
  1: 'Mascotas que sus familias están buscando. Si viste alguna, contacta a su dueño.',
  2: 'Animales que alguien encontró en la calle. ¿Reconoces a tu mascota?',
  3: 'Animales rescatados por refugios y fundaciones que buscan un nuevo hogar.',
};

// RF-16: búsqueda con filtros por especie, tamaño, color, zona y estado
export function Filtros({ idTipo, params, cambiar, compacto = false }) {
  const { catalogos } = useCatalogos();
  const [texto, setTexto] = useState(params.get('q') || '');
  const cantones = useMemo(() => catalogos?.cantones.filter((c) => !params.get('provincia') || c.idProvincia === Number(params.get('provincia'))) || [], [catalogos, params]);
  const sectores = useMemo(() => catalogos?.sectores.filter((s) => s.idCanton === Number(params.get('canton'))) || [], [catalogos, params]);
  if (!catalogos) return null;
  const estados = catalogos.estados.filter((e) => !idTipo || e.idTipo === idTipo);
  const select = (clave, etiqueta, opciones, extra = {}) => (
    <select className="input" aria-label={etiqueta} value={params.get(clave) || ''} onChange={(e) => cambiar({ [clave]: e.target.value, ...extra })}>
      <option value="">{etiqueta}</option>
      {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
    </select>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); cambiar({ q: texto.trim() }); }} className="space-y-3">
      <div className="flex gap-2">
        <input className="input" placeholder="Busca por nombre, raza, zona o descripción…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar" />
        <button className="btn btn-primario px-4" aria-label="Buscar">🔍</button>
      </div>
      <div className={`grid grid-cols-2 gap-2 ${compacto ? 'sm:grid-cols-3' : 'sm:grid-cols-3 lg:grid-cols-6'}`}>
        {!idTipo && select('tipo', 'Tipo de caso', catalogos.tipos, { estado: '' })}
        {select('especie', 'Especie', catalogos.especies)}
        {!compacto && select('tamano', 'Tamaño', catalogos.tamanos)}
        {!compacto && select('color', 'Color', catalogos.colores)}
        {!compacto && select('estado', 'Estado', idTipo ? estados : estados.map((e) => ({ ...e, nombre: `${catalogos.tipos.find((t) => t.id === e.idTipo).nombre}: ${e.nombre}` })))}
        {select('canton', 'Cantón', cantones, { sector: '' })}
        {!compacto && params.get('canton') && select('sector', 'Sector', sectores)}
      </div>
    </form>
  );
}

export default function Listado({ idTipo }) {
  const { usuario } = useAuth();
  const [params, setParams] = useSearchParams();
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const estilo = ESTILO_TIPO[idTipo];
  const pagina = Number(params.get('pagina')) || 1;
  const clave = params.toString();

  useEffect(() => {
    const consulta = new URLSearchParams(params);
    consulta.set('tipo', idTipo);
    setResultado(null);
    setError('');
    api.get(`/publicaciones?${consulta}`).then(setResultado).catch((e) => setError(e.message));
  }, [clave, idTipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiar = (cambios) => {
    const nuevos = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) { if (v) nuevos.set(k, v); else nuevos.delete(k); }
    if (!('pagina' in cambios)) nuevos.delete('pagina');
    setParams(nuevos);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${estilo.clase}`}>{estilo.plural}</span>
          <h1 className="titulo-pagina mt-2">{{ 1: 'Mascotas perdidas', 2: 'Animales encontrados', 3: 'Animales en adopción' }[idTipo]}</h1>
          <p className="mt-1 text-sm text-suave">{DESCRIPCION[idTipo]}</p>
        </div>
        {idTipo === 3
          ? <Link to="/refugios" className="btn btn-secundario">Ver refugios</Link>
          : <Link to={usuario ? `/reportar?tipo=${idTipo}` : '/login'} className="btn btn-primario">+ {idTipo === 1 ? 'Reportar mascota perdida' : 'Reportar animal encontrado'}</Link>}
      </div>
      <div className="panel mb-5 p-4"><Filtros idTipo={idTipo} params={params} cambiar={cambiar} /></div>
      <Alerta>{error}</Alerta>
      {!resultado && !error && <Cargando />}
      {resultado && (
        <>
          <p className="mb-3 text-sm text-suave">{resultado.total} {resultado.total === 1 ? 'resultado' : 'resultados'}</p>
          {resultado.datos.length === 0
            ? <Vacio titulo="No hay publicaciones con esos filtros">Prueba con otra búsqueda o quita algún filtro.</Vacio>
            : <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{resultado.datos.map((p) => <TarjetaMascota key={p.id} p={p} />)}</div>}
          {resultado.paginas > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button className="btn btn-secundario" disabled={pagina <= 1} onClick={() => cambiar({ pagina: pagina - 1 })}>Anterior</button>
              <span className="text-sm text-suave">Página {pagina} de {resultado.paginas}</span>
              <button className="btn btn-secundario" disabled={pagina >= resultado.paginas} onClick={() => cambiar({ pagina: pagina + 1 })}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
