import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Colores por tipo de caso (guía de Figma): rojo desaparecida, azul encontrada, verde adopción
export const ESTILO_TIPO = {
  1: { texto: 'Desaparecida', plural: 'Desaparecidas', clase: 'bg-perdida text-white', suave: 'bg-perdida/15 text-perdida border-perdida/40', ruta: '/perdidas' },
  2: { texto: 'Encontrada', plural: 'Encontradas', clase: 'bg-hallada text-white', suave: 'bg-hallada/15 text-hallada border-hallada/40', ruta: '/halladas' },
  3: { texto: 'En adopción', plural: 'En adopción', clase: 'bg-adopcion text-white', suave: 'bg-adopcion/15 text-adopcion border-adopcion/40', ruta: '/adopcion' },
};

const ESTADOS_RESUELTOS = [2, 4, 6];

export function InsigniaTipo({ idTipo }) {
  const e = ESTILO_TIPO[idTipo];
  return <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${e.clase}`}>{e.texto}</span>;
}

export function InsigniaEstado({ idEstado, estado }) {
  const resuelto = ESTADOS_RESUELTOS.includes(idEstado);
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${resuelto ? 'border-adopcion/40 bg-adopcion/15 text-adopcion' : 'border-ambar/40 bg-ambar/10 text-ambar'}`}>
      {estado}
    </span>
  );
}

export function Alerta({ tipo = 'error', children }) {
  if (!children) return null;
  const estilos = {
    error: 'border-perdida/40 bg-perdida/10 text-red-200',
    exito: 'border-adopcion/40 bg-adopcion/10 text-emerald-200',
    info: 'border-hallada/40 bg-hallada/10 text-sky-200',
  }[tipo];
  return <div role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${estilos}`}>{children}</div>;
}

export function Cargando({ texto = 'Cargando' }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-sm text-suave" aria-live="polite">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-borde border-t-violeta" />
      {texto}
    </div>
  );
}

export function Vacio({ titulo, children }) {
  return (
    <div className="panel px-6 py-12 text-center">
      <p className="text-4xl" aria-hidden="true">🐾</p>
      <h3 className="mt-3 text-lg">{titulo}</h3>
      {children && <div className="mt-2 text-sm text-suave">{children}</div>}
    </div>
  );
}

export function Modal({ titulo, abierto, alCerrar, children }) {
  useEffect(() => {
    if (!abierto) return undefined;
    const tecla = (e) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abierto, alCerrar]);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={alCerrar}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className="panel w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg text-lavanda">{titulo}</h2>
          <button onClick={alCerrar} className="text-suave hover:text-texto" aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Estrellas({ valor, alCambiar, tamano = 'text-xl' }) {
  return (
    <div className={`flex gap-0.5 ${tamano}`} role={alCambiar ? 'radiogroup' : 'img'} aria-label={`${valor} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        alCambiar ? (
          <button key={n} type="button" role="radio" aria-checked={valor === n} aria-label={`${n} estrellas`}
            onClick={() => alCambiar(n)} className={n <= valor ? 'text-ambar' : 'text-borde hover:text-ambar/60'}>★</button>
        ) : (
          <span key={n} className={n <= Math.round(valor) ? 'text-ambar' : 'text-borde'}>★</span>
        )
      ))}
    </div>
  );
}

// Protege rutas que requieren sesión o un rol específico (RF-19)
export function RutaPrivada({ children, roles }) {
  const { usuario } = useAuth();
  const ubicacion = useLocation();
  if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />;
  if (roles && !roles.includes(usuario.idRol)) return <Navigate to="/" replace />;
  return children;
}

export const formatoFecha = (valor) => {
  if (!valor) return '';
  const texto = String(valor);
  const fecha = texto.length === 10 ? new Date(`${texto}T12:00:00`) : new Date(texto);
  return fecha.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatoFechaHora = (valor) => new Date(valor).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });

export const textoUbicacion = (u) => (u?.sector ? `${u.sector}, ${u.canton}` : '');

export function IconoEspecie({ especie, className = '' }) {
  const e = (especie || '').toLowerCase();
  const icono = e.includes('gat') ? '🐱' : e.includes('perr') ? '🐶' : e.includes('ave') ? '🐦' : e.includes('conej') ? '🐰' : '🐾';
  return <span className={className} aria-hidden="true">{icono}</span>;
}
