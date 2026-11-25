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

### Sincronización con GitHub

El remoto autorizado es el repositorio privado [kdavilab2-ai/FindMyPet](https://github.com/kdavilab2-ai/FindMyPet). Cada cambio solicitado incluye su sincronización en la rama correspondiente.

1. Trabaja en el proyecto local y verifica el comportamiento con las pruebas pertinentes. Ejecuta también las comprobaciones obligatorias del backend y del frontend.
2. Revisa el diff y los archivos preparados. Excluye secretos, credenciales, datos personales, archivos temporales y otros datos sensibles. Prepara únicamente los archivos de la tarea.
3. Cuando el cambio esté completo, revisado y verificado, crea un commit descriptivo y súbelo a la rama correspondiente en `origin`. Solicita autorización si el entorno la exige.
4. Comprueba que el identificador del commit en la rama remota coincide con el local. Nunca uses `git push --force` ni `--force-with-lease`. Antes de integrar cambios remotos, verifica su historial y conserva los cambios ajenos.
5. Si falla una prueba, investiga y corrige el fallo cuando puedas. Mantén local el cambio hasta completar la verificación. Mantén también locales los cambios incompletos, inseguros o sin revisar.
6. Al cerrar la tarea, indica qué modificaste, qué verificaste y si quedó sincronizado. Prioriza el desarrollo del aplicativo y actualiza la documentación cuando cambie el uso o la operación del proyecto.

## Comandos
- Base de datos: `cd server && npm run db:migrate && npm run seed`
- Backend: `cd server && npm run dev` (puerto 4000)
- Frontend: `cd client && npm run dev` (puerto 5173, redirige /api al backend)
- Pruebas: `cd server && npm test`
