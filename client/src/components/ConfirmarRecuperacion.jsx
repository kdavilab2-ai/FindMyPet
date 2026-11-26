import { Modal } from './Comunes';

export default function ConfirmarRecuperacion({ nombre, abierto, alCerrar, alConfirmar }) {
  return (
    <Modal titulo="Confirmar recuperación" abierto={abierto} alCerrar={alCerrar}>
      <p className="text-sm text-suave">Confirma solo si ya recuperaste a {nombre || 'tu mascota'}. El reporte dejará de aparecer entre las desapariciones activas.</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className="btn btn-secundario" onClick={alCerrar}>Cancelar</button>
        <button className="btn btn-primario" onClick={alConfirmar}>Confirmar recuperación</button>
      </div>
    </Modal>
  );
}
