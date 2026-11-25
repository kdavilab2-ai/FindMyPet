const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { manejarErrores } = require('./middlewares/errores');

const app = express();

app.set('trust proxy', 1); // Render y otros servicios usan un proxy delante del servidor
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const origenes = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors(origenes.length ? { origin: origenes } : {}));
app.use(express.json({ limit: '1mb' }));

app.use('/api', require('./routes'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use(manejarErrores);

module.exports = app;
