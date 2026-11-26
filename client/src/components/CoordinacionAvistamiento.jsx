import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Alerta, Modal, formatoFechaHora } from './Comunes';
import EnlacesContacto from './EnlacesContacto';

export default function CoordinacionAvistamiento({ id, nombreAnimal, alConfirmar }) {
  const [datos, setDatos] = useState(null);
  const [destino, setDestino] = useState('');
  const [contenido, setContenido] = useState('');
  const [mensaje, setMensaje] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const campoMensaje = useRef(null);
  const ruta = `/publicaciones/${id}/coordinacion`;

  const cargar = useCallback(async () => {
    try {
      const caso = await api.get(ruta);
      setDatos(caso);
      setDestino((actual) => caso.destinos.some((d) => String(d.id) === actual) ? actual : String(caso.destinos[0]?.id || ''));
    } catch (e) {
      setDatos(null);
      if (![403, 404].includes(e.status)) setMensaje({ error: e.message });
    }
  }, [ruta]);

  useEffect(() => { cargar(); }, [cargar]);

  const operar = async (accion) => {
    setOcupado(true);
    setMensaje({});
    try { setMensaje({ ok: await accion() }); await cargar(); }
    catch (e) { setMensaje({ error: e.message }); }
    finally { setOcupado(false); }
  };

  if (!datos) return <Alerta>{mensaje.error}</Alerta>;

  const enviar = (e) => {
    e.preventDefault();
    operar(async () => {
      const r = await api.post(ruta, { destino: Number(destino), contenido });
      setContenido('');
      return r.mensaje;
    });
  };

  const confirmarRecepcion = () => {
    setConfirmar(false);
    operar(async () => {
      await api.patch(`/publicaciones/${id}/custodia/confirmar`, {});
      await alConfirmar();
      return 'Recepción confirmada';
    });
  };

  return (
    <section className="panel space-y-4 p-5" aria-labelledby="coordinacion">
      <h2 id="coordinacion" className="text-base text-lavanda">Coordinación del traslado</h2>
      <div className="rounded-xl border border-borde p-3 text-sm">
        <p><strong>Refugio responsable</strong> · {datos.refugio.nombre}</p>
        <p className="text-suave">Traslado informado el {formatoFechaHora(datos.refugio.informadaEn)}</p>
        <p className="text-suave">{datos.refugio.confirmadaEn ? `Recepción confirmada el ${formatoFechaHora(datos.refugio.confirmadaEn)}` : 'Recepción pendiente de confirmación'}</p>
      </div>
      <p className="text-sm text-suave">Los mensajes son visibles para quien los envía y quien los recibe.</p>
      {datos.notas && <p className="break-words text-sm"><strong>Notas de entrega</strong><br />{datos.notas}</p>}
      <Alerta>{mensaje.error}</Alerta><Alerta tipo="exito">{mensaje.ok}</Alerta>
      {datos.puedeConfirmar && <button className="btn btn-secundario" disabled={ocupado} onClick={() => setConfirmar(true)}>Confirmar recepción</button>}
      {datos.autor && <div className="space-y-2 rounded-xl border border-borde p-3 text-sm">
        <h3 className="font-semibold">Persona que reportó el avistamiento</h3>
        <p className="text-suave">{datos.autor.nombre} · Contactos autorizados en este reporte</p>
        <EnlacesContacto contactos={datos.autor.contactos} nombre={nombreAnimal} />
      </div>}
      {(datos.esRefugio || datos.coincidencias.length > 0) && <div className="space-y-2">
        <h3 className="text-sm font-semibold">Seguimiento de posibles propietarios</h3>
        {datos.coincidencias.length === 0 && <p className="text-sm text-suave">Por ahora no hay coincidencias sugeridas.</p>}
        {datos.coincidencias.map((c) => <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-borde p-3 text-sm">
          <div className="min-w-0 break-words">
            <Link to={`/publicaciones/${c.id}`} className="font-semibold text-lavanda underline">{c.mascota || 'Reporte de desaparición'}</Link>
            <p className="text-suave">{c.identificada ? 'Posible identificación indicada por el propietario' : `${Math.round(c.porcentaje)} % de similitud sugerida`}</p>
            {c.recuperada && <p className="text-adopcion">Recuperación confirmada por el propietario en su reporte</p>}
          </div>
          {datos.esRefugio && c.destino && !c.recuperada && <button type="button" className="btn btn-secundario"
            onClick={() => { setDestino(String(c.destino)); campoMensaje.current?.focus(); }}>Enviar mensaje al propietario</button>}
          {c.contactos?.length > 0 && <div className="w-full"><EnlacesContacto contactos={c.contactos} /></div>}
        </div>)}
      </div>}
      <h3 className="text-sm font-semibold">{datos.mensajes.length > 0 ? 'Comunicación en curso' : 'Mensajes de coordinación'}</h3>
      {datos.mensajes.length > 0 && <ul className="max-h-64 space-y-2 overflow-y-auto" aria-label="Mensajes privados">
        {datos.mensajes.map((m) => <li key={m.id} className="rounded-xl border border-borde p-2 text-sm">
          <p className="text-xs text-suave">{m.mio ? 'Para' : 'De'} {m.interlocutor} · {formatoFechaHora(m.fecha)}</p>
          <p className="whitespace-pre-wrap break-words">{m.contenido}</p>
        </li>)}
      </ul>}
      {datos.destinos.length > 0 && <form onSubmit={enviar} className="space-y-2">
        <label className="etiqueta" htmlFor="destino-avistamiento">Enviar mensaje a</label>
        <select id="destino-avistamiento" className="input" value={destino} onChange={(e) => setDestino(e.target.value)} required>
          {datos.destinos.map((d) => <option key={d.id} value={d.id}>{d.etiqueta}</option>)}
        </select>
        <label className="etiqueta" htmlFor="mensaje-avistamiento">Mensaje</label>
        <textarea ref={campoMensaje} id="mensaje-avistamiento" className="input" rows={2} maxLength={500} required value={contenido} onChange={(e) => setContenido(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primario" disabled={ocupado || !contenido.trim()}>Enviar mensaje</button>
          <button type="button" className="btn btn-secundario" disabled={ocupado} onClick={cargar}>Actualizar mensajes</button>
        </div>
      </form>}
      <Modal titulo="Confirmar recepción del animal" abierto={confirmar} alCerrar={() => setConfirmar(false)}>
        <p className="text-sm text-suave">Confirma solo si el animal ya está en el refugio. Su reporte seguirá su curso hasta que el propietario confirme la recuperación.</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button className="btn btn-secundario" onClick={() => setConfirmar(false)}>Cancelar</button>
          <button className="btn btn-primario" onClick={confirmarRecepcion}>Confirmar recepción</button>
        </div>
      </Modal>
    </section>
  );
}
