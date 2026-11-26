import { useState } from 'react';
import { Alerta, Modal } from './Comunes';

function FormularioRecuperacion({ nombre, alCerrar, alConfirmar }) {
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    const nota = descripcion.trim();
    if (nota.length < 10) return setError('Cuéntanos en al menos 10 caracteres dónde o cómo encontraste a tu mascota.');
    setError('');
    setGuardando(true);
    try {
      await alConfirmar(nota);
      alCerrar();
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  };

  return (
    <Modal titulo="Confirmar recuperación" abierto alCerrar={() => { if (!guardando) alCerrar(); }}>
      <form className="space-y-4" onSubmit={enviar}>
        <p className="text-sm text-suave">Confirma cuando hayas recuperado a {nombre || 'tu mascota'}. Esta nota se mostrará en la ficha de Recuperados.</p>
        <div>
          <label className="etiqueta" htmlFor="nota-recuperacion">¿Dónde o cómo encontraste a tu mascota?</label>
          <textarea id="nota-recuperacion" className="input" rows={3} required minLength={10} maxLength={300}
            aria-describedby="limite-nota-recuperacion" placeholder="Ej. La encontramos cerca del parque y volvió a casa esa tarde."
            value={descripcion} onChange={(e) => setDescripcion(e.target.value)} disabled={guardando} />
          <p id="limite-nota-recuperacion" className="text-xs text-suave">{descripcion.length}/300 caracteres</p>
        </div>
        <Alerta>{error}</Alerta>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secundario" disabled={guardando} onClick={alCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Confirmar recuperación'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function ConfirmarRecuperacion({ abierto, ...props }) {
  return abierto ? <FormularioRecuperacion {...props} /> : null;
}
