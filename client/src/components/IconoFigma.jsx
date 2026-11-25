import iconos from './iconosFigma.json';

export default function IconoFigma({ nombre, className = '' }) {
  const { ancho, alto, capas } = iconos[nombre];
  return (
    <span className={`figma-icono ${className}`} aria-hidden="true"
      style={{ '--ancho-icono': `${ancho}px`, aspectRatio: ancho / alto }}>
      {capas.map(([archivo, x, y, anchoCapa, giro], i) => (
        <img key={`${archivo}-${i}`} src={`/figma/${archivo}`} alt="" draggable="false"
          style={{ left: `${x}%`, top: `${y}%`, width: `${anchoCapa}%`, rotate: `${giro}deg` }} />
      ))}
    </span>
  );
}
