# AGENTS.md — FindMyPet (Grupo 4, UNEMI)

Instrucciones permanentes para agentes de programación (Codex) en este repositorio. Responde y comenta en español.

## Qué es el proyecto
FindMyPet centraliza reportes de mascotas **desaparecidas**, animales **encontrados** y animales **en adopción**,
con coincidencias sugeridas por IA. Proyecto de Construcción de Software (UNEMI). Los requerimientos (RF-01 a RF-26,
RNF-01 a RNF-24) y el modelo de datos están en el Plan de Proyecto del grupo; respeta sus nombres.

## Stack
- Frontend: React 19 + Vite + Tailwind CSS 4 + React Router, Leaflet (mapas) y jsPDF (cartel) — carpeta `client/`
- Backend: Node.js 20 + Express 4, API REST — carpeta `server/`
- Base de datos: PostgreSQL con `pg` (SQL parametrizado, sin ORM). Esquema en `server/db/schema.sql`
- Seguridad: JWT (30 min, se renueva con actividad), bcryptjs, helmet, express-rate-limit
- Archivos: multer en memoria + sharp (redimensiona a 1280 px, WEBP). Se guardan en la tabla `multimedia_archivo`
- IA: Google Gemini (opcional, `GEMINI_API_KEY`). Sin clave, todo funciona solo con atributos (RNF-16)

## Estructura
```
server/
  db/schema.sql        tablas y catálogos (nombres del diagrama 2.4)
  db/migrar.js         crea el esquema; db/seed.js datos de demostración
  src/routes/index.js  todas las rutas de la API
  src/controllers/     un archivo por módulo (auth, perfil, publicaciones, coincidencias, refugios, donaciones, admin…)
  src/services/        coincidencias.service.js (IA) y alertas.service.js (proximidad)
  src/lib/             db, validar, constantes, ia, archivos, ubicacion, correo, geo
  src/middlewares/     auth (verificarToken, verificarRol), errores
  tests/               Jest + Supertest, una base de datos de pruebas aparte
client/src/
  pages/               una página por pantalla (Inicio, Listado, Detalle, Reportar, MisReportes, Coincidencias, Perfil, Refugios, MiRefugio, Admin, Auth)
  components/          Navbar, TarjetaMascota, Mapa, SelectorUbicacion, Comunes
  context/             AuthContext (sesión), CatalogosContext
  services/            api.js (fetch), cartel.js (PDF)
```

## Convenciones
- Tablas y columnas en snake_case (como el diagrama). `src/lib/db.js` convierte las filas a camelCase para la API.
- Variables y funciones en camelCase; componentes en PascalCase. Nombres en español.
- SIEMPRE consultas parametrizadas (`$1, $2…`). Nunca concatenes datos del usuario en SQL.
- Errores con `throw new ErrorHttp(status, 'mensaje en español')`; la API responde `{ "error": "..." }`.
- Comenta en cada controlador qué RF o RNF cumple.
- Secretos solo en `.env` (ver `.env.example`).
- Interfaz: paleta de Figma (fondo #14122B, tarjetas #1E1B3A, bordes #363063, violeta #7C3AED/#8B5CF6, lavanda #C4B5FD,
  rojo #F05A5A desaparecida, azul #1E8FFF encontrada, verde #1FA463 adopción), tipografía Inter, responsive de 360 a 1920 px.

## Cómo trabajar
- Antes de cambiar código, explica el plan en pocas líneas.
- Cambios pequeños y en una rama `feature/...`; deja el proyecto funcionando.
- Cada endpoint nuevo o cambiado lleva pruebas en `server/tests/`.
- Ejecuta `cd server && npm test` y `cd client && npm run build` antes de terminar. Ambos deben pasar.
- Commits en español con prefijo: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`.

## Comandos
- Base de datos: `cd server && npm run db:migrate && npm run seed`
- Backend: `cd server && npm run dev` (puerto 4000)
- Frontend: `cd client && npm run dev` (puerto 5173, redirige /api al backend)
- Pruebas: `cd server && npm test`
