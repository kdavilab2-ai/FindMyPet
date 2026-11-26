import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Alerta } from './Comunes';

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
const LIMITE_FOTO = 5 * 1024 * 1024;

export default function FormularioTraslado({ id, alGuardar, alCancelar }) {
  const [refugios, setRefugios] = useState(null);
  const [errorRefugios, setErrorRefugios] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    api.get('/refugios').then((lista) => { if (vigente) setRefugios(lista); })
      .catch((e) => { if (vigente) setErrorRefugios(e.message); });
    return () => { vigente = false; };
  }, []);

  const guardar = async (e) => {
    e.preventDefault();
    const formulario = new FormData(e.currentTarget);
    const fecha = new Date(formulario.get('entregadaEn'));
    if (!Number.isFinite(fecha.getTime()) || fecha.getTime() > Date.now()) {
      setError('Indica la fecha y hora de la entrega. Deben ser actuales o pasadas.');
      return;
    }
    formulario.set('entregadaEn', fecha.toISOString());
    const foto = formulario.get('fotoEntrega');
    if (!foto.size) formulario.delete('fotoEntrega');
    else if (!TIPOS_FOTO.includes(foto.type) || foto.size > LIMITE_FOTO) {
      setError('Selecciona una imagen JPG, PNG o WEBP de hasta 5 MB.');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      await api.formulario(`/publicaciones/${id}/custodia`, formulario);
      await alGuardar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form id="formulario-traslado" onSubmit={guardar} className="space-y-3 rounded-xl border border-borde bg-fondo/50 p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-lavanda">Datos de la entrega</h3>
      <Alerta>{errorRefugios || error}</Alerta>
      {!refugios && !errorRefugios && <p role="status" className="text-sm text-suave">Cargando refugios…</p>}
      {refugios?.length === 0 && <Alerta tipo="info">Por ahora no hay refugios disponibles. Tu avistamiento queda publicado y puedes informar la entrega más adelante.</Alerta>}
      {refugios?.length > 0 && (
        <fieldset className="min-w-0 space-y-3" disabled={guardando}>
          <legend className="sr-only">Entrega al refugio</legend>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="etiqueta" htmlFor="refugio-receptor">Refugio receptor</label>
              <select id="refugio-receptor" name="idRefugioCustodia" className="input" defaultValue="" required>
                <option value="">Selecciona un refugio</option>
                {refugios.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div className="min-w-0">
              <label className="etiqueta" htmlFor="fecha-entrega">Fecha y hora de entrega</label>
              <input id="fecha-entrega" name="entregadaEn" type="datetime-local" className="input min-w-0" required />
            </div>
          </div>
          <div>
            <label className="etiqueta" htmlFor="persona-receptora">Persona que lo recibió (opcional)</label>
            <input id="persona-receptora" name="personaReceptora" className="input" maxLength={120} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="observaciones-entrega">Observaciones de entrega (opcional)</label>
            <textarea id="observaciones-entrega" name="notasCustodia" className="input" rows={2} maxLength={500} placeholder="Cuidados, comportamiento o detalles de la entrega" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="foto-entrega">Fotografía de la entrega (opcional)</label>
            <input id="foto-entrega" name="fotoEntrega" type="file" className="input" accept={TIPOS_FOTO.join(',')} aria-describedby="ayuda-foto-entrega" />
            <p id="ayuda-foto-entrega" className="mt-1 text-xs text-suave">JPG, PNG o WEBP hasta 5 MB. Solo tú y el refugio asignado podrán verla.</p>
          </div>
        </fieldset>
      )}
      <div className="flex flex-wrap gap-2">
        {refugios?.length > 0 && <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar entrega'}</button>}
        <button type="button" className="btn btn-secundario" onClick={alCancelar} disabled={guardando}>{refugios?.length === 0 ? 'Cerrar' : 'Cancelar'}</button>
      </div>
    </form>
  );
}
