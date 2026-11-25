import { useMemo, useState } from 'react';
import { useCatalogos } from '../context/CatalogosContext';
import Mapa from './Mapa';

/**
 * RF-20: ubicación por zona (provincia → cantón → sector), dirección o punto en el mapa.
 * valor = { idProvincia, idCanton, idSector, direccion, latitud, longitud }
 */
export default function SelectorUbicacion({ valor, alCambiar, etiquetaDireccion = 'Dirección o referencia', conMapa = true, radioKm }) {
  const { catalogos } = useCatalogos();
  const [verMapa, setVerMapa] = useState(Boolean(valor.latitud));
  const cantones = useMemo(() => catalogos?.cantones.filter((c) => c.idProvincia === Number(valor.idProvincia)) || [], [catalogos, valor.idProvincia]);
  const sectores = useMemo(() => catalogos?.sectores.filter((s) => s.idCanton === Number(valor.idCanton)) || [], [catalogos, valor.idCanton]);
  if (!catalogos) return null;

  const cambiar = (cambios) => alCambiar({ ...valor, ...cambios });

  const usarMiUbicacion = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { setVerMapa(true); cambiar({ latitud: Number(pos.coords.latitude.toFixed(6)), longitud: Number(pos.coords.longitude.toFixed(6)) }); },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="etiqueta" htmlFor="provincia">Provincia</label>
          <select id="provincia" className="input" value={valor.idProvincia || ''} required
            onChange={(e) => cambiar({ idProvincia: e.target.value, idCanton: '', idSector: '' })}>
            <option value="">Seleccione</option>
            {catalogos.provincias.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="canton">Cantón</label>
          <select id="canton" className="input" value={valor.idCanton || ''} required disabled={!valor.idProvincia}
            onChange={(e) => cambiar({ idCanton: e.target.value, idSector: '' })}>
            <option value="">Seleccione</option>
            {cantones.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="sector">Sector o barrio</label>
          <select id="sector" className="input" value={valor.idSector || ''} required disabled={!valor.idCanton}
            onChange={(e) => cambiar({ idSector: e.target.value })}>
            <option value="">Seleccione</option>
            {sectores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      </div>
      {etiquetaDireccion && (
        <div>
          <label className="etiqueta" htmlFor="direccion">{etiquetaDireccion}</label>
          <input id="direccion" className="input" maxLength={200} placeholder="Ej. Cdla. Las Piñas, frente al parque"
            value={valor.direccion || ''} onChange={(e) => cambiar({ direccion: e.target.value })} />
        </div>
      )}
      {conMapa && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secundario py-1.5 text-xs" onClick={() => setVerMapa(!verMapa)}>
              🗺️ {verMapa ? 'Ocultar mapa' : 'Marcar en el mapa (opcional)'}
            </button>
            <button type="button" className="btn btn-secundario py-1.5 text-xs" onClick={usarMiUbicacion}>📍 Usar mi ubicación</button>
            {valor.latitud && (
              <button type="button" className="btn btn-secundario py-1.5 text-xs" onClick={() => cambiar({ latitud: null, longitud: null })}>Quitar punto</button>
            )}
          </div>
          {verMapa && (
            <>
              <Mapa punto={valor.latitud ? valor : null} radioKm={radioKm} alSeleccionar={(p) => cambiar(p)} />
              <p className="text-xs text-suave">
                {valor.latitud ? `Punto marcado: ${valor.latitud}, ${valor.longitud}` : 'Haga clic en el mapa para marcar el lugar exacto.'}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Convierte la ubicación que devuelve la API al formato del selector
export const ubicacionDesdeApi = (u) => (u ? {
  idProvincia: u.idProvincia, idCanton: u.idCanton, idSector: u.idSector, direccion: u.direccion || '', latitud: u.latitud, longitud: u.longitud,
} : { idProvincia: '', idCanton: '', idSector: '', direccion: '', latitud: null, longitud: null });
