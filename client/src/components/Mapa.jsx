import { useEffect, useRef } from 'react';
import L from 'leaflet';

const CENTRO_MILAGRO = [-2.1342, -79.5939];

const icono = (color) => L.divIcon({
  className: 'marcador-mapa',
  html: `<svg width="30" height="40" viewBox="0 0 30 40"><path d="M15 0C7 0 0 6.5 0 14.5 0 25 15 40 15 40s15-15 15-25.5C30 6.5 23 0 15 0z" fill="${color}"/><circle cx="15" cy="14.5" r="6" fill="#fff"/></svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
});

/**
 * Mapa de OpenStreetMap (RF-20).
 * - Modo lectura: muestra un marcador en `punto` y opcionalmente un círculo de `radioKm`.
 * - Modo selección (alSeleccionar): el usuario hace clic para fijar la ubicación.
 */
export default function Mapa({ punto, alSeleccionar, radioKm, color = '#8B5CF6', alto = 'h-64' }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const capa = useRef(null);
  const callback = useRef(alSeleccionar);
  callback.current = alSeleccionar;

  useEffect(() => {
    const m = L.map(contenedor.current, { scrollWheelZoom: false }).setView(punto ? [punto.latitud, punto.longitud] : CENTRO_MILAGRO, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(m);
    capa.current = L.layerGroup().addTo(m);
    if (callback.current) {
      m.on('click', (e) => callback.current({ latitud: Number(e.latlng.lat.toFixed(6)), longitud: Number(e.latlng.lng.toFixed(6)) }));
    }
    mapa.current = m;
    return () => m.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!capa.current) return;
    capa.current.clearLayers();
    if (!punto || punto.latitud === null || punto.latitud === undefined) return;
    const pos = [Number(punto.latitud), Number(punto.longitud)];
    L.marker(pos, { icon: icono(color) }).addTo(capa.current);
    if (radioKm) {
      const circulo = L.circle(pos, { radius: radioKm * 1000, color, weight: 1, fillOpacity: 0.12 }).addTo(capa.current);
      mapa.current.fitBounds(circulo.getBounds());
    } else {
      mapa.current.setView(pos, Math.max(mapa.current.getZoom(), 15));
    }
  }, [punto?.latitud, punto?.longitud, radioKm, color]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={contenedor} className={`${alto} w-full overflow-hidden rounded-xl border border-borde`} />;
}
