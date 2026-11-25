import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Alerta, Cargando, Modal, formatoFechaHora } from '../components/Comunes';

const CLAVE_VACIA = { actual: '', nueva: '', confirmar: '' };
const SOLICITUDES = { desactivacion: 'Desactivación temporal', eliminacion: 'Eliminación permanente' };

function Bloque({ icono, titulo, descripcion, children, className = '' }) {
  const id = useId();
  return (
    <section className={`panel space-y-4 p-4 sm:p-6 ${className}`} aria-labelledby={id}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violeta/15 text-lg" aria-hidden="true">{icono}</span>
        <div><h2 id={id} className="text-lg text-lavanda">{titulo}</h2><p className="mt-1 text-sm text-suave">{descripcion}</p></div>
      </div>
      {children}
    </section>
  );
}

function CampoClave({ etiqueta, valor, alCambiar, actual = false }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="etiqueta" htmlFor={id}>{etiqueta}</label>
      <div className="flex items-stretch gap-2">
        <input id={id} type={visible ? 'text' : 'password'} required className="input min-w-0"
          autoComplete={actual ? 'current-password' : 'new-password'} value={valor} onChange={(e) => alCambiar(e.target.value)} />
        <button type="button" className="btn btn-secundario px-3 text-xs" aria-controls={id}
          aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${etiqueta.toLowerCase()}`} onClick={() => setVisible(!visible)}>{visible ? 'Ocultar' : 'Mostrar'}</button>
      </div>
    </div>
  );
}

function ContactoReporte({ reporte }) {
  const id = useId();
  const [guardado, setGuardado] = useState(reporte.idTipoContactoVisible || '');
  const [elegido, setElegido] = useState(guardado);
  const [estado, setEstado] = useState({});
  const guardar = async (e) => {
    e.preventDefault();
    setEstado({ trabajando: true });
    try {
      await api.patch(`/seguridad/contactos/${reporte.id}`, { idTipoContactoVisible: elegido ? Number(elegido) : null });
      setGuardado(elegido);
      setEstado({ ok: 'Visibilidad guardada' });
    } catch (err) { setEstado({ error: err.message }); }
  };
  return (
    <form className="space-y-2 rounded-xl border border-borde p-3" onSubmit={guardar}>
      <Link to={`/publicaciones/${reporte.id}`} className="font-semibold text-lavanda hover:underline">
        {reporte.nombreAnimal || 'Animal sin nombre'} · {reporte.tipo}
      </Link>
      <label className="etiqueta" htmlFor={id}>Contacto visible</label>
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <select id={id} className="input min-w-0" value={elegido} onChange={(e) => setElegido(e.target.value)}>
          <option value="">Todos los canales registrados</option>
          {reporte.canales.map((c) => <option key={c.id} value={c.id}>Solo {c.tipo}</option>)}
        </select>
        <button className="btn btn-secundario" disabled={estado.trabajando || String(elegido) === String(guardado)}>Guardar visibilidad</button>
      </div>
      <Alerta>{estado.error}</Alerta><Alerta tipo="exito">{estado.ok}</Alerta>
    </form>
  );
}

function ConfirmarSolicitud({ tipo, alCerrar, alGuardar }) {
  const [clave, setClave] = useState('');
  const [confirmada, setConfirmada] = useState(false);
  const [estado, setEstado] = useState({});
  const enviar = async (e) => {
    e.preventDefault();
    setEstado({ trabajando: true });
    try {
      const r = await api.post('/seguridad/solicitudes', { tipo, actual: clave, confirmar: confirmada });
      alGuardar(r.mensaje);
    } catch (err) { setEstado({ error: err.message }); }
  };
  return (
    <Modal titulo={`Solicitar ${SOLICITUDES[tipo].toLowerCase()}`} abierto alCerrar={() => { if (!estado.trabajando) alCerrar(); }}>
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-suave">
          {tipo === 'eliminacion' ? 'Si procede, la eliminación es permanente y puede afectar tu perfil, reportes y fotografías.' : 'Si procede, la desactivación suspenderá temporalmente el acceso a tu cuenta.'}
          {' '}La administración revisará la solicitud antes de cualquier cambio.
        </p>
        <Alerta>{estado.error}</Alerta>
        <CampoClave actual etiqueta="Contraseña actual" valor={clave} alCambiar={setClave} />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-violeta" required checked={confirmada} onChange={(e) => setConfirmada(e.target.checked)} />Confirmo que quiero enviar esta solicitud.</label>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secundario" disabled={estado.trabajando} onClick={alCerrar}>Cancelar</button>
          <button className="btn btn-primario" disabled={estado.trabajando || !confirmada}>Enviar solicitud</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Seguridad() {
  const [datos, setDatos] = useState(null);
  const [reportes, setReportes] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [solicitud, setSolicitud] = useState(null);
  const [clave, setClave] = useState(CLAVE_VACIA);
  const [mensajes, setMensajes] = useState({});
  const cambiarEstado = (seccion, mensaje) => setMensajes((d) => ({ ...d, [seccion]: mensaje }));

  useEffect(() => {
    let activa = true;
    Promise.all([api.get('/seguridad'), api.get('/seguridad/contactos'), api.get('/seguridad/solicitudes')]).then(([res, contactos, pendientes]) => {
      if (!activa) return;
      setDatos(res);
      setReportes(contactos);
      setSolicitudes(pendientes);
    }).catch((e) => { if (activa) setMensajes({ carga: { error: e.message } }); });
    return () => { activa = false; };
  }, []);

  const ejecutar = async (seccion, operacion) => {
    cambiarEstado(seccion, { trabajando: true });
    try { cambiarEstado(seccion, { ok: await operacion() }); }
    catch (e) { cambiarEstado(seccion, { error: e.message }); }
  };
  const mensaje = (seccion) => <><Alerta>{mensajes[seccion]?.error}</Alerta><Alerta tipo="exito">{mensajes[seccion]?.ok}</Alerta></>;
  const ocupado = (seccion) => Boolean(mensajes[seccion]?.trabajando);

  const cambiarClave = (e) => {
    e.preventDefault();
    ejecutar('clave', async () => {
      if (clave.nueva.length < 8 || !/[A-Za-z]/.test(clave.nueva) || !/\d/.test(clave.nueva)) throw new Error('Usa al menos 8 caracteres, con letras y números');
      if (new TextEncoder().encode(clave.nueva).length > 72) throw new Error('La contraseña no puede superar los 72 bytes');
      if (clave.nueva !== clave.confirmar) throw new Error('Las contraseñas no coinciden');
      const r = await api.put('/perfil/contrasena', clave);
      setClave(CLAVE_VACIA);
      setDatos((d) => ({ ...d, sesiones: d.sesiones.filter((s) => s.actual) }));
      return r.mensaje;
    });
  };
  const cerrar = (id) => ejecutar('sesiones', async () => {
    await api.delete(`/seguridad/sesiones${id ? `/${id}` : ''}`);
    setDatos((d) => ({ ...d, sesiones: d.sesiones.filter((s) => id ? s.id !== id : s.actual) }));
    return id ? 'Sesión cerrada' : 'Se cerraron las demás sesiones';
  });
  const avisar = (valor) => ejecutar('avisos', async () => {
    const p = await api.put('/seguridad/notificaciones', { avisarAccesos: valor });
    setDatos((d) => ({ ...d, ...p }));
    return 'Preferencia guardada';
  });
  const descargar = () => ejecutar('datos', async () => {
    const url = URL.createObjectURL(await api.descargar('/seguridad/mis-datos'));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'findmypet-mis-datos.json';
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'Descarga iniciada';
  });
  const retirarSolicitud = (tipo) => ejecutar('cuenta', async () => {
    await api.delete(`/seguridad/solicitudes/${tipo}`);
    setSolicitudes((actuales) => actuales.filter((s) => s.tipo !== tipo));
    return 'Solicitud retirada';
  });
  const guardarSolicitud = (aviso) => {
    setSolicitud(null);
    ejecutar('cuenta', async () => {
      setSolicitudes(await api.get('/seguridad/solicitudes'));
      return aviso;
    });
  };

  return (
    <div className="figma-pagina mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <header className="mb-6 space-y-2">
        <Link to="/perfil" className="text-sm font-semibold text-lavanda hover:underline">← Volver a mi perfil</Link>
        <h1 className="titulo-pagina">Seguridad y privacidad</h1>
        <p className="text-sm text-suave">Protege tu cuenta y decide qué datos compartes en FindMyPet.</p>
      </header>
      {mensaje('carga')}
      {!datos && !mensajes.carga?.error && <Cargando />}
      {datos && (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <Bloque icono="🔑" titulo="Cambiar contraseña" descripcion="Al cambiarla, se cierran las otras sesiones de tu cuenta.">
            <form onSubmit={cambiarClave} className="space-y-3">
              {mensaje('clave')}
              <CampoClave actual etiqueta="Contraseña actual" valor={clave.actual} alCambiar={(actual) => setClave({ ...clave, actual })} />
              <CampoClave etiqueta="Nueva contraseña" valor={clave.nueva} alCambiar={(nueva) => setClave({ ...clave, nueva })} />
              <CampoClave etiqueta="Confirmar nueva contraseña" valor={clave.confirmar} alCambiar={(confirmar) => setClave({ ...clave, confirmar })} />
              <p className="text-xs text-suave">Usa al menos 8 caracteres, con letras y números.</p>
              <button className="btn btn-primario" disabled={ocupado('clave')}>Actualizar contraseña</button>
            </form>
          </Bloque>
          <Bloque icono="💻" titulo="Sesiones activas" descripcion="Consulta los accesos vigentes. El navegador y el sistema se identifican cuando están disponibles.">
            {mensaje('sesiones')}
            <ul className="divide-y divide-borde" aria-label="Sesiones activas">
              {datos.sesiones.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{s.navegador} · {s.sistema}</p>
                    <p className="text-xs text-suave">Inicio {formatoFechaHora(s.iniciadaEn)}</p>
                    <p className="text-xs text-suave">Última renovación {formatoFechaHora(s.renovadaEn)}</p>
                  </div>
                  {s.actual ? <span className="rounded-full bg-violeta/15 px-3 py-1 text-xs font-semibold text-lavanda">Sesión actual</span>
                    : <button className="btn btn-secundario" disabled={ocupado('sesiones')} onClick={() => cerrar(s.id)} aria-label={`Cerrar sesión de ${s.navegador} en ${s.sistema}, iniciada ${formatoFechaHora(s.iniciadaEn)}`}>Cerrar sesión</button>}
                </li>
              ))}
            </ul>
            {datos.sesiones.some((s) => !s.actual) && <button className="btn btn-secundario" disabled={ocupado('sesiones')} onClick={() => cerrar()}>Cerrar las demás sesiones</button>}
          </Bloque>
          <Bloque icono="🔒" titulo="Privacidad de mis datos" descripcion="Elige qué canales ven los usuarios con sesión iniciada en tus reportes de pérdida y hallazgo. Debe quedar disponible al menos uno." className="md:col-span-2">
            <Link to="/privacidad" className="text-sm text-lavanda underline">Política de privacidad</Link>
            {reportes.length ? <div className="grid gap-3 md:grid-cols-2">{reportes.map((p) => <ContactoReporte key={p.id} reporte={p} />)}</div>
              : <p className="text-sm text-suave">Cuando publiques un reporte de pérdida o hallazgo, podrás cambiar aquí su visibilidad de contacto.</p>}
          </Bloque>
          <Bloque icono="🔔" titulo="Notificaciones de seguridad" descripcion="Los avisos aparecen en la campana de FindMyPet.">
            {mensaje('avisos')}
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-violeta" checked={datos.avisarAccesos} disabled={ocupado('avisos')} onChange={(e) => avisar(e.target.checked)} />Avisarme cuando se inicie una sesión nueva</label>
            <p className="text-sm text-suave">Los avisos críticos de cambios de contraseña y de seguridad están siempre activos.</p>
          </Bloque>
          <Bloque icono="📥" titulo="Descargar mis datos" descripcion="Descarga un JSON con tu perfil, publicaciones, contactos propios, referencias a tus fotos y otros datos asociados a tu cuenta.">
            {mensaje('datos')}
            <button className="btn btn-secundario" disabled={ocupado('datos')} onClick={descargar}>Descargar mis datos</button>
          </Bloque>
          <Bloque icono="🛡️" titulo="Verificación en dos pasos" descripcion="La verificación en dos pasos aún no está disponible en FindMyPet." />
          <Bloque icono="⚙️" titulo="Gestionar mi cuenta" descripcion="Envía una solicitud de desactivación temporal o de eliminación permanente para que la revise la administración.">
            {mensaje('cuenta')}
            {Object.entries(SOLICITUDES).map(([tipo, texto]) => {
              const pendiente = solicitudes.find((s) => s.tipo === tipo);
              return (
                <div key={tipo} className="flex flex-wrap items-center justify-between gap-2 border-t border-borde pt-3">
                  <span className="text-sm font-semibold">{texto}{pendiente && <small className="block font-normal text-suave">Pendiente desde {formatoFechaHora(pendiente.creadaEn)}</small>}</span>
                  {pendiente ? <button className="btn btn-secundario" disabled={ocupado('cuenta')} onClick={() => retirarSolicitud(tipo)}>Retirar solicitud</button>
                    : <button className="btn btn-secundario" disabled={ocupado('cuenta')} onClick={() => setSolicitud(tipo)}>{tipo === 'eliminacion' ? 'Solicitar eliminación' : 'Solicitar desactivación'}</button>}
                </div>
              );
            })}
          </Bloque>
        </div>
      )}
      {solicitud && <ConfirmarSolicitud tipo={solicitud} alCerrar={() => setSolicitud(null)} alGuardar={guardarSolicitud} />}
    </div>
  );
}
