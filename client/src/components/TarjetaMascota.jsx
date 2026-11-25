import { Link } from 'react-router-dom';
import { urlArchivo } from '../services/api';
import { ESTILO_TIPO, IconoEspecie, InsigniaEstado, InsigniaTipo, formatoFecha, textoUbicacion } from './Comunes';
import IconoFigma from './IconoFigma';

export function FotoMascotaFigma({ p, className = '' }) {
  const especie = p.especie?.toLocaleLowerCase('es');
  const icono = especie === 'gato' ? 'gato' : especie === 'perro' ? 'perro' : null;
  return (
    <span className={`figma-foto ${className}`}>
      {p.foto ? <img src={urlArchivo(p.foto)} alt="" loading="lazy" />
        : icono ? <IconoFigma nombre={icono} className={`figma-animal-${icono}`} />
          : <IconoEspecie especie={p.especie} />}
    </span>
  );
}

export default function TarjetaMascota({ p, variante }) {
  const resuelta = [2, 4, 6].includes(p.idEstado);
  const lugar = p.idTipo === 3 ? (p.refugio || textoUbicacion(p.ubicacion)) : textoUbicacion(p.ubicacion);
  const rasgos = [p.raza, p.colores?.map((c) => c.nombre).join(', ')].filter(Boolean).join(' · ');
  if (variante === 'inicio') {
    return (
      <Link className="figma-tarjeta" to={`/publicaciones/${p.id}`}>
        <FotoMascotaFigma p={p} />
        <span className={`figma-tipo figma-tipo-${p.idTipo}`}>{ESTILO_TIPO[p.idTipo].texto}</span>
        <div className="figma-tarjeta-texto">
          <h3>{p.nombreAnimal || 'Sin nombre'} · {p.especie}</h3>
          {resuelta && <InsigniaEstado idEstado={p.idEstado} estado={p.estado} />}
          {rasgos && <p>{rasgos}</p>}
          {(lugar || p.fechaEvento) && <p className="figma-lugar"><IconoFigma nombre="ubicacion" />
            {[lugar, formatoFecha(p.fechaEvento)].filter(Boolean).join(' · ')}
          </p>}
        </div>
        <span className="figma-ver-detalle">Ver detalle</span>
      </Link>
    );
  }
  const foto = urlArchivo(p.foto);
  return (
    <Link
      to={`/publicaciones/${p.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-borde bg-panel transition hover:-translate-y-0.5 hover:border-violeta/60"
    >
      <div className="relative aspect-[4/3] bg-tarjeta">
        {foto ? (
          <img src={foto} alt={p.nombreAnimal || p.especie} loading="lazy" className={`h-full w-full object-cover ${resuelta ? 'opacity-60' : ''}`} />
        ) : (
          <div className="flex h-full items-center justify-center"><IconoEspecie especie={p.especie} className="text-6xl" /></div>
        )}
        <div className="absolute left-2.5 top-2.5"><InsigniaTipo idTipo={p.idTipo} /></div>
        {resuelta && <div className="absolute right-2.5 top-2.5"><InsigniaEstado idEstado={p.idEstado} estado={p.estado} /></div>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <h3 className="text-base font-bold group-hover:text-lavanda">{p.nombreAnimal || 'Sin nombre'} · {p.especie}</h3>
        <p className="text-xs text-suave">{rasgos}</p>
        <p className="mt-auto flex items-center gap-1 pt-1 text-xs text-suave">
          <span className="text-perdida" aria-hidden="true">●</span>
          {lugar}
          {p.fechaEvento && <span> · {formatoFecha(p.fechaEvento)}</span>}
        </p>
      </div>
    </Link>
  );
}
