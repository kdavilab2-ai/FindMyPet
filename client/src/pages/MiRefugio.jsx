import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Alerta, Cargando } from '../components/Comunes';

// Panel del refugio: estado de autorización, adopciones y traslados
export default function MiRefugio() {
  const { usuario, guardarSesion } = useAuth();
  const [avistamientos, setAvistamientos] = useState(null);
  const [errorAvistamientos, setErrorAvistamientos] = useState('');
  const autorizado = usuario.refugio?.autorizado;

  // Se consulta el estado actual por si el administrador lo autorizó mientras tanto
  useEffect(() => { api.post('/auth/renovar').then(guardarSesion).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (autorizado) api.get('/refugios/mis-avistamientos').then(setAvistamientos).catch((e) => setErrorAvistamientos(e.message));
  }, [autorizado]);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <div>
        <h1 className="titulo-pagina">🏠 {usuario.refugio?.nombre}</h1>
        <p className="mt-1 text-sm text-suave">Panel de tu refugio o fundación.</p>
      </div>
      {!autorizado ? (
        <Alerta tipo="info">Tu refugio está pendiente de autorización. Cuando un administrador lo apruebe podrás publicar animales en adopción. Te avisaremos con una notificación.</Alerta>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Link to="/reportar?tipo=3" className="btn btn-primario">+ Publicar animal en adopción</Link>
            <Link to={`/refugios/${usuario.refugio.id}`} className="btn btn-secundario">Ver página pública</Link>
            <Link to="/mis-reportes" className="btn btn-secundario">Mis publicaciones</Link>
          </div>
          <section className="panel space-y-3 p-5">
            <h2 className="text-lg">Animales trasladados a mi refugio</h2>
            <Alerta>{errorAvistamientos}</Alerta>
            {!avistamientos && !errorAvistamientos && <Cargando />}
            {avistamientos?.length === 0 && <p className="text-sm text-suave">Todavía no se han informado traslados a tu refugio.</p>}
            {avistamientos?.map((a) => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borde p-3 text-sm">
              <div><p className="font-semibold">{a.nombreAnimal || a.especie}</p>
                <p className="text-suave">{a.confirmadaEn ? 'Recepción confirmada' : 'Recepción pendiente'} · {a.coincidencias} {a.coincidencias === 1 ? 'posible coincidencia' : 'posibles coincidencias'}</p>
                {a.recuperacionConfirmada && <p className="text-adopcion">Recuperación confirmada por el propietario</p>}
              </div>
              <Link to={`/publicaciones/${a.id}`} className="btn btn-secundario">Gestionar traslado</Link>
            </div>)}
          </section>
        </>
      )}
    </div>
  );
}
