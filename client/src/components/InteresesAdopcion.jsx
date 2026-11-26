import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Alerta, Cargando, formatoFechaHora } from './Comunes';
import EnlacesContacto from './EnlacesContacto';

export default function InteresesAdopcion({ publicacion }) {
  const [intereses, setIntereses] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let vigente = true;
    api.get(`/refugios/mis-intereses${publicacion ? `?publicacion=${publicacion}` : ''}`)
      .then((datos) => { if (vigente) setIntereses(datos); })
      .catch((e) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [publicacion]);

  return (
    <section id="intereses-adopcion" className="panel scroll-mt-24 space-y-3 border-adopcion/50 bg-adopcion/10 p-5">
      <h2 className="text-lg">Personas interesadas en adoptar</h2>
      <Alerta>{error}</Alerta>
      {!intereses && !error && <Cargando />}
      {intereses?.length === 0 && <p className="text-sm text-suave">Todavía no hay solicitudes de contacto.</p>}
      {intereses?.length > 0 && <p className="text-sm text-suave">Contacta a las personas interesadas para coordinar la adopción.</p>}
      {intereses?.map((i) => (
        <div key={`${i.idPublicacion}-${i.idUsuario}`} className="space-y-2 rounded-xl border border-adopcion/40 p-3 text-sm">
          <p className="font-semibold">{i.interesado}{!publicacion && <> · <Link to={`/publicaciones/${i.idPublicacion}#intereses-adopcion`} className="underline">{i.nombreAnimal}</Link></>}</p>
          <p className="text-xs text-suave">{formatoFechaHora(i.fecha)}</p>
          <EnlacesContacto contactos={[
            ...(i.telefono ? [{ tipo: 'Teléfono', valor: i.telefono }] : []),
            { tipo: 'Correo', valor: i.correo },
          ]} />
        </div>
      ))}
    </section>
  );
}
