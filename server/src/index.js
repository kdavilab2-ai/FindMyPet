require('dotenv').config({ quiet: true });
const app = require('./app');

if (!process.env.JWT_SECRET) {
  console.error('Falta la variable de entorno JWT_SECRET (ver .env.example)');
  process.exit(1);
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API de FindMyPet en http://localhost:${PORT}`));
