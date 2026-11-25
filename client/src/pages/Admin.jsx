import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCatalogos } from '../context/CatalogosContext';
import { Alerta, Cargando, InsigniaEstado, InsigniaTipo, Modal, formatoFecha, formatoFechaHora } from '../components/Comunes';

const VISTAS = [
  ['resumen', 'Resumen'], ['publicaciones', 'Publicaciones'], ['usuarios', 'Usuarios y refugios'], ['auditoria', 'Auditoría'],
];

// Modal que pide el motivo de cada acción administrativa (RNF-22)
function AccionConMotivo({ accion, alCerrar, alConfirmar }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  if (!accion) return null;
  const confirmar = async (e) => {
    e.preventDefault();
    try { await alConfirmar(motivo); setMotivo(''); } catch (err) { setError(err.message); }
  };
  return (
    <Modal titulo={accion.titulo} abierto alCerrar={alCerrar}>
      <form onSubmit={confirmar} className="space-y-3">
        <p className="text-sm text-suave">{accion.descripcion}</p>
        <Alerta>{error}</Alerta>
        {accion.extra}
        <label className="etiqueta" htmlFor="motivo">Motivo (queda registrado en la auditoría)</label>
        <textarea id="motivo" className="input" rows={3} required minLength={5} maxLength={255} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secundario" onClick={alCerrar}>Cancelar</button>
          <button className={`btn ${accion.peligro ? 'btn-peligro' : 'btn-primario'}`}>{accion.boton}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Admin() {
  const { usuario: yo } = useAuth();
  const { catalogos } = useCatalogos();
  const [params, setParams] = useSearchParams();
  const vista = params.get('vista') || 'resumen';
  const [datos, setDatos] = useState({});
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [accion, setAccion] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const ruta = { resumen: 'estadisticas', publicaciones: 'publicaciones', usuarios: 'usuarios', auditoria: 'auditoria' }[vista];
      const r = await api.get(`/admin/${ruta}`);
      setDatos((d) => ({ ...d, [vista]: r }));
    } catch (e) { setError(e.message); }
  }, [vista]);
  useEffect(() => { cargar(); }, [cargar]);

  const ejecutar = async (fn, mensaje) => { await fn(); setAccion(null); setAviso(mensaje); cargar(); };

  const moderar = (p, tipo) => {
    const config = {
      eliminar: { titulo: 'Eliminar publicación', descripcion: `Se eliminará la publicación de ${p.nombreAnimal || 'este animal'} y se notificará al autor.`, boton: 'Eliminar', peligro: true, fn: (m) => api.delete(`/admin/publicaciones/${p.id}`, { motivo: m }), ok: 'Publicación eliminada' },
      advertir: { titulo: 'Enviar advertencia', descripcion: `El autor de ${p.nombreAnimal || 'esta publicación'} recibirá una notificación con el motivo.`, boton: 'Enviar advertencia', fn: (m) => api.post(`/admin/publicaciones/${p.id}/advertencia`, { motivo: m }), ok: 'Advertencia enviada' },
    }[tipo];
    setAccion({ ...config, confirmar: (m) => ejecutar(() => config.fn(m), config.ok) });
  };

  const cambiarEstadoCuenta = (u, idEstado) => {
    const nombre = { 1: 'Reactivar', 2: 'Suspender', 3: 'Bloquear' }[idEstado];
    setAccion({
      titulo: `${nombre} cuenta`, descripcion: `${u.nombres} ${u.apellidos} (${u.correo})`, boton: nombre, peligro: idEstado !== 1,
      confirmar: (m) => ejecutar(() => api.patch(`/admin/usuarios/${u.id}/estado`, { idEstado, motivo: m }), `Cuenta actualizada: ${nombre.toLowerCase()}`),
    });
  };

  const autorizar = async (u) => {
    try { await api.patch(`/admin/refugios/${u.idRefugio}`, { autorizado: !u.autorizado }); setAviso(u.autorizado ? 'Autorización retirada' : `${u.refugio} autorizado`); cargar(); } catch (e) { setError(e.message); }
  };

  const filtrar = (lista, campos) => lista?.filter((x) => !busqueda || campos.some((c) => String(x[c] || '').toLowerCase().includes(busqueda.toLowerCase())));
  const d = datos[vista];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="titulo-pagina">🛡️ Administración</h1>
      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-borde" role="tablist">
        {VISTAS.map(([v, t]) => (
          <button key={v} role="tab" aria-selected={vista === v} onClick={() => { setParams({ vista: v }); setBusqueda(''); }}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${vista === v ? 'border-violeta text-lavanda' : 'border-transparent text-suave hover:text-texto'}`}>{t}</button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        <Alerta tipo="exito">{aviso}</Alerta>
        <Alerta>{error}</Alerta>
      </div>
      {!d && !error && <Cargando />}

      {vista === 'resumen' && d && (
        <div className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {d.porRol.map((r) => <div key={r.rol} className="panel p-4"><p className="text-3xl font-extrabold">{r.total}</p><p className="text-sm text-suave">{r.rol === 'Refugio' ? 'Refugios' : `${r.rol}s`}</p></div>)}
            <div className="panel p-4"><p className="text-3xl font-extrabold text-ambar">{d.refugios.pendientes}</p><p className="text-sm text-suave">Refugios por autorizar</p></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel p-5">
              <h2 className="mb-3 text-base">Publicaciones por estado</h2>
              <table className="w-full text-sm"><tbody>
                {d.porEstado.map((e) => <tr key={`${e.tipo}${e.estado}`} className="border-b border-borde/50"><td className="py-2 text-suave">{e.tipo}</td><td>{e.estado}</td><td className="text-right font-bold">{e.total}</td></tr>)}
              </tbody></table>
            </div>
            <div className="panel p-5">
              <h2 className="mb-3 text-base">Coincidencias de la IA</h2>
              <table className="w-full text-sm"><tbody>
                {d.coincidencias.map((c) => <tr key={c.estado} className="border-b border-borde/50"><td className="py-2">{c.estado}</td><td className="text-right font-bold">{c.total}</td></tr>)}
              </tbody></table>
              <p className="mt-3 text-xs text-suave">{d.moderaciones} acciones de moderación registradas · IA {catalogos?.iaDisponible ? 'con Gemini activa' : 'por atributos (sin clave de Gemini)'}</p>
            </div>
          </div>
        </div>
      )}

      {vista === 'publicaciones' && d && (
        <>
          <input className="input mt-4 max-w-sm" placeholder="Buscar por nombre o autor" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <div className="panel mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-borde text-suave"><tr><th className="p-3">Publicación</th><th className="p-3">Estado</th><th className="p-3">Autor</th><th className="p-3">Fecha</th><th className="p-3" /></tr></thead>
              <tbody>
                {filtrar(d, ['nombreAnimal', 'autor', 'correoAutor', 'especie']).map((p) => (
                  <tr key={p.id} className="border-b border-borde/50 last:border-0">
                    <td className="p-3"><InsigniaTipo idTipo={p.idTipo} /> <Link to={`/publicaciones/${p.id}`} className="ml-1 font-semibold hover:text-lavanda">{p.nombreAnimal || 'Sin nombre'}</Link> <span className="text-suave">· {p.especie}</span>
                      {p.advertencias > 0 && <span className="ml-2 text-xs text-ambar">⚠ {p.advertencias}</span>}</td>
                    <td className="p-3"><InsigniaEstado idEstado={p.idEstado} estado={p.estado} /></td>
                    <td className="p-3">{p.autor}<br /><span className="text-xs text-suave">{p.correoAutor}</span></td>
                    <td className="p-3 text-suave">{formatoFecha(p.fechaCreacion)}</td>
                    <td className="space-x-1 whitespace-nowrap p-3 text-right">
                      <button className="btn btn-secundario px-2.5 py-1.5 text-xs" onClick={() => moderar(p, 'advertir')}>Advertir</button>
                      <button className="btn btn-peligro px-2.5 py-1.5 text-xs" onClick={() => moderar(p, 'eliminar')}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {vista === 'usuarios' && d && (
        <>
          <input className="input mt-4 max-w-sm" placeholder="Buscar por nombre, correo o refugio" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <div className="panel mt-3 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-borde text-suave"><tr><th className="p-3">Usuario</th><th className="p-3">Rol</th><th className="p-3">Publicaciones</th><th className="p-3">Cuenta</th><th className="p-3" /></tr></thead>
              <tbody>
                {filtrar(d, ['nombres', 'apellidos', 'correo', 'refugio']).map((u) => (
                  <tr key={u.id} className="border-b border-borde/50 last:border-0">
                    <td className="p-3"><span className="font-semibold">{u.nombres} {u.apellidos}</span><br /><span className="text-xs text-suave">{u.correo} · desde {formatoFecha(u.fechaRegistro)}</span></td>
                    <td className="p-3">{u.rol}{u.refugio && <><br /><span className="text-xs text-suave">{u.refugio}</span> <span className={`text-xs ${u.autorizado ? 'text-adopcion' : 'text-ambar'}`}>{u.autorizado ? '✓ autorizado' : '⏳ pendiente'}</span></>}</td>
                    <td className="p-3">{u.publicaciones}</td>
                    <td className={`p-3 font-semibold ${{ 1: 'text-adopcion', 2: 'text-ambar', 3: 'text-perdida' }[u.idEstadoCuenta]}`}>{u.estado}</td>
                    <td className="space-x-1 whitespace-nowrap p-3 text-right">
                      {u.idRefugio && <button className="btn btn-secundario px-2.5 py-1.5 text-xs" onClick={() => autorizar(u)}>{u.autorizado ? 'Retirar autorización' : 'Autorizar refugio'}</button>}
                      {u.id !== yo.id && (u.idEstadoCuenta === 1 ? (
                        <>
                          <button className="btn btn-secundario px-2.5 py-1.5 text-xs" onClick={() => cambiarEstadoCuenta(u, 2)}>Suspender</button>
                          <button className="btn btn-peligro px-2.5 py-1.5 text-xs" onClick={() => cambiarEstadoCuenta(u, 3)}>Bloquear</button>
                        </>
                      ) : <button className="btn btn-exito px-2.5 py-1.5 text-xs" onClick={() => cambiarEstadoCuenta(u, 1)}>Reactivar</button>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {vista === 'auditoria' && d && (
        <div className="panel mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-borde text-suave"><tr><th className="p-3">Fecha y hora</th><th className="p-3">Categoría</th><th className="p-3">Acción</th><th className="p-3">Detalle</th><th className="p-3">Responsable</th></tr></thead>
            <tbody>
              {d.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-suave">Sin registros todavía</td></tr>}
              {d.map((a, i) => (
                <tr key={i} className="border-b border-borde/50 last:border-0">
                  <td className="whitespace-nowrap p-3 text-suave">{formatoFechaHora(a.fecha)}</td>
                  <td className="p-3">{a.categoria}</td><td className="p-3 font-semibold">{a.accion}</td>
                  <td className="p-3">{a.detalle}</td><td className="p-3 text-suave">{a.responsable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AccionConMotivo accion={accion} alCerrar={() => setAccion(null)} alConfirmar={(m) => accion.confirmar(m)} />
    </div>
  );
}
