import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Alerta, Cargando, formatoFecha } from '../components/Comunes';

// Panel del refugio: estado de autorización y solicitudes de donación (RF-25)
export default function MiRefugio() {
  const { usuario, guardarSesion } = useAuth();
  const [solicitudes, setSolicitudes] = useState(null);
  const [nueva, setNueva] = useState({ titulo: '', descripcion: '' });
  const [estado, setEstado] = useState({ error: '', ok: '' });
  const autorizado = usuario.refugio?.autorizado;

  // Se consulta el estado actual por si el administrador lo autorizó mientras tanto
  useEffect(() => { api.post('/auth/renovar').then(guardarSesion).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cargar = useCallback(() => {
    if (!autorizado) return;
    api.get('/donaciones/mias').then(setSolicitudes).catch((e) => setEstado({ error: e.message, ok: '' }));
  }, [autorizado]);
  useEffect(() => { cargar(); }, [cargar]);

  const crear = async (e) => {
    e.preventDefault();
    try { await api.post('/donaciones', nueva); setNueva({ titulo: '', descripcion: '' }); setEstado({ error: '', ok: 'Solicitud publicada' }); cargar(); } catch (err) { setEstado({ error: err.message, ok: '' }); }
  };
  const cambiar = async (s) => {
    try { await api.patch(`/donaciones/${s.id}`, { idEstado: s.idEstadoSolicitud === 1 ? 2 : 1 }); cargar(); } catch (err) { setEstado({ error: err.message, ok: '' }); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <div>
        <h1 className="titulo-pagina">🏠 {usuario.refugio?.nombre}</h1>
        <p className="mt-1 text-sm text-suave">Panel de tu refugio o fundación.</p>
      </div>
      {!autorizado ? (
        <Alerta tipo="info">Tu refugio está pendiente de autorización. Cuando un administrador lo apruebe podrás publicar animales en adopción y pedir donaciones. Te avisaremos con una notificación.</Alerta>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Link to="/reportar?tipo=3" className="btn btn-primario">+ Publicar animal en adopción</Link>
            <Link to={`/refugios/${usuario.refugio.id}`} className="btn btn-secundario">Ver página pública</Link>
            <Link to="/mis-reportes" className="btn btn-secundario">Mis publicaciones</Link>
          </div>
          <Alerta tipo="exito">{estado.ok}</Alerta>
          <Alerta>{estado.error}</Alerta>
          <form onSubmit={crear} className="panel space-y-3 p-5">
            <h2 className="text-lg">Nueva solicitud de donación o insumos</h2>
            <input className="input" required maxLength={100} placeholder="Título, ej. Alimento para cachorros" value={nueva.titulo} onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} aria-label="Título" />
            <textarea className="input" required rows={3} placeholder="¿Qué necesitan y para qué?" value={nueva.descripcion} onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })} aria-label="Descripción" />
            <button className="btn btn-primario">Publicar solicitud</button>
          </form>
          <h2 className="text-xl">Mis solicitudes</h2>
          {!solicitudes ? <Cargando /> : solicitudes.length === 0 ? <p className="text-sm text-suave">Aún no has publicado solicitudes.</p> : (
            <ul className="space-y-3">
              {solicitudes.map((s) => (
                <li key={s.id} className="panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base">{s.titulo} <span className={`ml-2 text-xs ${s.idEstadoSolicitud === 1 ? 'text-adopcion' : 'text-suave'}`}>{s.estado}</span></h3>
                      <p className="text-sm text-suave">{s.descripcion}</p>
                    </div>
                    <button className="btn btn-secundario py-1.5 text-xs" onClick={() => cambiar(s)}>{s.idEstadoSolicitud === 1 ? 'Cerrar' : 'Reabrir'}</button>
                  </div>
                  <p className="mt-2 text-xs text-suave">{s.aportes} aporte(s) · ${s.totalMonto.toFixed(2)} comprometidos</p>
                  {s.detalleAportes.length > 0 && (
                    <ul className="mt-2 divide-y divide-borde rounded-xl border border-borde text-sm">
                      {s.detalleAportes.map((a) => (
                        <li key={a.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                          <span><b>{a.donante}</b> · {a.monto ? `$${a.monto.toFixed(2)}` : ''} {a.detalle}</span>
                          <span className="text-xs text-suave">{a.telefono || a.correo} · {formatoFecha(a.fecha)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
