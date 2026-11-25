const multer = require('multer');

class ErrorHttp extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

const MENSAJES_MULTER = {
  LIMIT_FILE_SIZE: 'Un archivo supera el tamaño permitido (imágenes 5 MB, videos 20 MB)',
  LIMIT_FILE_COUNT: 'Puede subir como máximo 5 archivos',
  LIMIT_UNEXPECTED_FILE: 'Puede subir como máximo 5 archivos',
};

// eslint-disable-next-line no-unused-vars
function manejarErrores(err, req, res, next) {
  if (err instanceof ErrorHttp) return res.status(err.status).json({ error: err.message });
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: MENSAJES_MULTER[err.code] || 'Error al subir los archivos' });
  }
  if (err.code === '23505') return res.status(409).json({ error: 'El registro ya existe' });
  if (err.code === '23503') return res.status(400).json({ error: 'Uno de los datos seleccionados no existe' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (process.env.NODE_ENV !== 'test') console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { ErrorHttp, manejarErrores };
