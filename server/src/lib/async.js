// Envuelve controladores async para que Express 4 reciba sus errores
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
