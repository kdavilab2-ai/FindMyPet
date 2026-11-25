import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useCatalogos } from '../context/CatalogosContext';
import TarjetaMascota from '../components/TarjetaMascota';
import IconoFigma from '../components/IconoFigma';
import { Alerta, Cargando, ESTILO_TIPO, Vacio } from '../components/Comunes';

const RESUMEN = [[1, 'desaparecidas'], [2, 'encontradas'], [3, 'adopcion']];
const normalizar = (texto) => texto.toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu, '');

// RF-16. Figma Inicio web y móvil: buscador, filtros y resultados en la misma pantalla.
export default function Inicio() {
  const { catalogos } = useCatalogos();
  const [params, setParams] = useSearchParams();
  const [resumen, setResumen] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const clave = params.toString();

  useEffect(() => {
    api.get('/publicaciones/resumen').then(setResumen).catch(() => {});
  }, []);

  useEffect(() => {
    const consulta = new URLSearchParams(clave);
    if (consulta.has('color')) consulta.delete('q');
    if (!consulta.has('estado')) consulta.set('activas', 'true');
    let vigente = true;
    api.get(`/publicaciones?${consulta}`)
      .then((r) => { if (vigente) { setResultado({ clave, datos: r.datos.slice(0, 8) }); setError(''); } })
      .catch((e) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [clave]);

  const cambiar = (valores) => {
    setError('');
    setParams((anterior) => {
      const siguiente = new URLSearchParams(anterior);
      for (const [campo, valor] of Object.entries(valores)) {
        if (valor) siguiente.set(campo, valor);
        else siguiente.delete(campo);
      }
      return siguiente;
    });
  };
  const buscar = (e) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('buscar').trim();
    const color = catalogos?.colores.find((c) => normalizar(c.nombre) === normalizar(q));
    cambiar({ q, color: color?.id });
  };
  const filtro = (campo, titulo, opciones) => (
    <select className={`input figma-filtro figma-filtro-${campo}`} aria-label={titulo}
      value={params.get(campo) || ''} onChange={(e) => cambiar({ [campo]: e.target.value })}>
      <option value="">{titulo}</option>
      {opciones?.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
    </select>
  );
  const recientes = resultado?.clave === clave ? resultado.datos : null;
  const estadoElegido = catalogos?.estados.find((e) => String(e.id) === params.get('estado'));
  const urlListado = (tipo) => {
    const filtros = new URLSearchParams(params);
    if (filtros.has('color')) filtros.delete('q');
    if (estadoElegido && estadoElegido.idTipo !== tipo) filtros.delete('estado');
    return `${ESTILO_TIPO[tipo].ruta}${filtros.size ? '?' + filtros : ''}`;
  };

  return (
    <section className="figma-pagina figma-inicio">
      <header className="figma-titulo-inicio">
        <h1>Encuentra, reporta o adopta</h1>
        <p>Juntos podemos volver a casa.</p>
      </header>
      <form className="figma-busqueda" onSubmit={buscar} role="search">
        <input className="input" name="buscar" key={params.get('q') || ''} defaultValue={params.get('q') || ''}
          placeholder="Busca una mascota por especie, color o zona…" aria-label="Buscar una mascota" />
        <button type="submit" aria-label="Buscar"><IconoFigma nombre="buscar" /></button>
      </form>
      {filtro('especie', 'Especie', catalogos?.especies)}
      {filtro('estado', 'Estado', catalogos?.estados)}
      {filtro('canton', 'Zona', catalogos?.cantones)}
      <div className="figma-resumen">
        {RESUMEN.map(([tipo, campo]) => (
          <Link key={tipo} to={urlListado(tipo)} className={`figma-contador ${ESTILO_TIPO[tipo].clase}`}>
            <span className="figma-contador-icono"><IconoFigma nombre="pata" /></span>
            <span className="figma-contador-texto">
              <span>{ESTILO_TIPO[tipo].plural}</span>
              <strong>{resumen?.[campo] ?? '–'}</strong>
            </span>
          </Link>
        ))}
      </div>
      <h2 className="figma-recientes-titulo">Mascotas recientes</h2>
      <Link to={urlListado(estadoElegido?.idTipo || 1)} className="figma-ver-todas">Ver todas</Link>
      <div className="figma-resultados" aria-live="polite">
        <Alerta>{error}</Alerta>
        {!recientes && !error && <Cargando />}
        {recientes && (recientes.length === 0
          ? <Vacio titulo="No hay publicaciones para esta búsqueda">Cambia los filtros o crea un reporte.</Vacio>
          : <div className="figma-tarjetas">{recientes.map((p) => <TarjetaMascota key={p.id} p={p} variante="inicio" />)}</div>)}
      </div>
    </section>
  );
}
