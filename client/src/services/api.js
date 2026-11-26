// Cliente de la API REST. En producción VITE_API_URL apunta al backend (ej. https://findmypet-api.onrender.com)
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function urlArchivo(ruta) {
  if (!ruta) return null;
  return ruta.startsWith('http') ? ruta : `${API_URL}${ruta}`;
}

async function peticion(ruta, { metodo = 'GET', datos, formulario, archivo = false } = {}) {
  const encabezados = {};
  const token = localStorage.getItem('token');
  if (token) encabezados.Authorization = `Bearer ${token}`;
  let cuerpo;
  if (formulario) cuerpo = formulario;
  else if (datos !== undefined) {
    encabezados['Content-Type'] = 'application/json';
    cuerpo = JSON.stringify(datos);
  }

  let res;
  try {
    res = await fetch(`${API_URL}/api${ruta}`, { method: metodo, headers: encabezados, body: cuerpo });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Revise su conexión');
  }
  if (res.status === 204) return null;
  if (archivo && res.ok) return res.blob();
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && localStorage.getItem('token') === token && ruta !== '/auth/login') {
      window.dispatchEvent(new Event('sesion-expirada'));
    }
    const error = new Error(json.error || 'Ocurrió un error inesperado');
    error.status = res.status;
    throw error;
  }
  return json;
}

export const api = {
  get: (ruta) => peticion(ruta),
  descargar: (ruta) => peticion(ruta, { archivo: true }),
  post: (ruta, datos) => peticion(ruta, { metodo: 'POST', datos }),
  put: (ruta, datos) => peticion(ruta, { metodo: 'PUT', datos }),
  patch: (ruta, datos) => peticion(ruta, { metodo: 'PATCH', datos }),
  delete: (ruta, datos) => peticion(ruta, { metodo: 'DELETE', datos }),
  formulario: (ruta, formulario, metodo = 'POST') => peticion(ruta, { metodo, formulario }),
};
