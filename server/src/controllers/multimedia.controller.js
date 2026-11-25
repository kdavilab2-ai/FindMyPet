const { una } = require('../lib/db');
const { entero } = require('../lib/validar');

// Entrega una foto o video guardado en la base de datos
async function obtener(req, res) {
  const archivo = await una('SELECT mime, datos FROM multimedia_archivo WHERE id_multimedia = $1', [entero(req.params.id)]);
  if (!archivo) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.set('Content-Type', archivo.mime);
  res.set('Cache-Control', 'public, max-age=604800, immutable');
  res.set('X-Content-Type-Options', 'nosniff');
  res.send(archivo.datos);
}

module.exports = { obtener };
