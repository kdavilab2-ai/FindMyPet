import { Link } from 'react-router-dom';
import IconoFigma from './IconoFigma';

export default function EncabezadoFigma({ titulo, volverA = '/', children }) {
  return (
    <div className="figma-encabezado">
      <Link to={volverA} className="figma-volver" aria-label="Volver"><IconoFigma nombre="volver" /></Link>
      <h1>{titulo}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
