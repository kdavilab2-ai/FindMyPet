# FindMyPet 🐾

Plataforma web para el reporte y la recuperación de mascotas desaparecidas, animales encontrados y animales en adopción,
con coincidencias sugeridas por inteligencia artificial.

Proyecto de **Construcción de Software** · Ingeniería de Software · Universidad Estatal de Milagro (UNEMI) · Grupo 4

| Integrante | Rol |
| --- | --- |
| Bravo Yepez Dana Anaelys | Líder |
| Davila Briones Kevin Saul | Desarrollador / QA |
| Diaz Macas Dayana Mishelle | Analista |
| Icaza Vergara Billy Mauricio | Diseñador UI/UX |
| Zuñiga Lozano Ayelen Romina | Desarrollador / QA |

Docente: Merino Gavilanes Jonathan Eduardo

## Funcionalidades

| Módulo | Requerimientos |
| --- | --- |
| Registro de ciudadanos y refugios, inicio de sesión, perfil, recuperación de contraseña por correo | RF-01, RF-02, RF-03, RF-18, RF-19, RNF-21 |
| Reportes de mascotas desaparecidas y animales encontrados con al menos una foto, hasta cinco archivos en total y ubicación por zona, dirección o mapa | RF-04 a RF-08, RF-20, RF-21 |
| Coincidencias con IA (especie, raza, color, tamaño, ubicación, fecha y foto) que el propietario confirma o descarta | RF-09, RF-10, RF-11 |
| Validación de fotos con IA (que contengan un animal y sean aptas) | RF-22 |
| Adopciones publicadas por refugios autorizados, contacto con aviso al refugio | RF-12 a RF-15 |
| Búsqueda y filtros por tipo, especie, tamaño, color, estado, provincia, cantón y sector | RF-16 |
| Moderación, control de cuentas, autorización de refugios y auditoría | RF-17, RNF-22 |
| Cartel de búsqueda en PDF | RF-23 |
| Valoraciones de refugios y enlaces de apoyo externo a Patreon y GoFundMe | RF-24, RF-25 |
| Alertas de mascotas perdidas cerca del usuario | RF-26 |

## Tecnologías
- **Frontend:** React 19, Vite, Tailwind CSS 4, React Router, Leaflet + OpenStreetMap, jsPDF
- **Backend:** Node.js 20, Express 4, API REST, JWT, bcryptjs, helmet, multer, sharp, nodemailer
- **Base de datos:** PostgreSQL (esquema en `server/db/schema.sql`, basado en el diagrama 2.4 del plan)
- **IA:** Google Gemini (opcional) + algoritmo de puntaje por atributos
- **Pruebas:** Jest + Supertest (48 pruebas automáticas)

## Instalación y uso en Windows

1. Descarga o clona FindMyPet con tu cuenta autorizada de GitHub. Si descargaste un ZIP, extráelo antes de abrir los archivos.
2. La primera vez, haz doble clic en **Instalar FindMyPet.bat**. Si aún falta la conexión local, indica los datos de tu PostgreSQL. Pulsa Enter para aceptar el servidor, puerto y usuario que aparecen entre corchetes si corresponden a tu instalación. Si PostgreSQL solicita contraseña, escríbela en la ventana del instalador. Permanece oculta.
3. Cada vez que quieras usar la aplicación, haz doble clic en **Iniciar FindMyPet.bat**. Abre [FindMyPet](http://localhost:5173) en tu navegador y deja los servidores funcionando.
4. Cuando termines, haz doble clic en **Detener FindMyPet.bat**. Cierra los servidores locales de FindMyPet y de la demostración.

Necesitas Node.js LTS 22.12 o posterior y PostgreSQL 14 o posterior. También se admite Node.js 20 desde la versión 20.19. Si tu copia ya está configurada con el PostgreSQL portátil de FindMyPet, el lanzador lo inicia cuando hace falta. Para una instalación como servicio de Windows, comprueba en **Servicios** que PostgreSQL esté iniciado. El usuario de PostgreSQL necesita acceso a las bases y permiso para crearlas si todavía faltan.

El instalador completa los valores ausentes en `server/.env`, conserva los valores existentes, genera la clave de sesión y prepara las tablas y catálogos iniciales. La base de la aplicación y la de pruebas son distintas. Si instalas por primera vez y la base está vacía, regístrate desde la pantalla de inicio de sesión. Ejecuta el instalador de nuevo tras actualizar el esquema o las dependencias.

Al abrir FindMyPet sin una sesión iniciada, verás **Iniciar sesión**. Al ingresar se abre **Inicio**, y al cerrar sesión vuelves a **Iniciar sesión**.

### Presentación con datos ficticios

Después de instalar FindMyPet, haz doble clic en **Abrir demostracion FindMyPet.bat**. Abre [la demostración](http://localhost:5174) con una base PostgreSQL separada y un rótulo visible. El primer inicio prepara el contenido. Los siguientes conservan lo que hagas durante el ensayo y evitan duplicar los ejemplos. Usa **Detener FindMyPet.bat** para cerrar los servidores.

Abre `.runtime/windows/.env.demo-clave` con el Bloc de notas para leer la clave generada para las cuentas ficticias. Usa la demostración local para estas cuentas. Los contactos están bajo el dominio reservado `.test` y las coincidencias se calculan por atributos sin enviar fotos a servicios externos.

| Cuenta | Recorrido sugerido |
| --- | --- |
| `sofia@presentacion.findmypet.test` | Abre **Perdidas** y busca a Bruno, Lima o Michi. En sus fichas, baja a **Avistamientos** para ver fotos y observaciones. Abre la campana o **Coincidencias IA** para revisar las sugerencias de tu cuenta. |
| `mateo@presentacion.findmypet.test` | Consulta las alertas de proximidad en la campana y los hallazgos propios en **Mis reportes**. Explora Kira, Milo y Nina en **Recuperados**. |
| `patitas@presentacion.findmypet.test` | Abre **Mi refugio → Gestionar traslado** para ver el aviso sobre el avistamiento de Oliva. La recepción queda pendiente para que puedas mostrar cómo la confirma el refugio. |
| `admin@presentacion.findmypet.test` | Abre **Administración** y localiza la solicitud de autorización de Red de Rescate La Ribera. |

Desde **Adopción** puedes filtrar perros, gatos, aves, conejos y otros animales. Abre **Refugios y fundaciones** para consultar el directorio, las reseñas y los enlaces externos de apoyo.

Las 36 fotos nuevas en `server/db/fotos-presentacion/` se generaron con la herramienta integrada de imágenes. Se pidieron cuatro cuadrículas de fotografías de celular con mascotas de distintas especies y razas, en casas, refugios o espacios públicos, y tomas distintas para los avistamientos. La historia de Michi reutiliza dos fotos existentes de `server/db/fotos-demo/`.

### Cuentas de las bases locales preparadas anteriormente (contraseña `Clave1234`)

Estas cuentas ficticias están disponibles en bases que el equipo ya preparó para demostración.

| Correo | Rol |
| --- | --- |
| admin@findmypet.test | Administrador |
| ana@findmypet.test | Ciudadano (tiene a Rocky perdido, con una coincidencia sugerida) |
| luis@findmypet.test | Ciudadano (con alertas de proximidad activas) |
| huellitas@findmypet.test | Refugio autorizado |
| patitas@findmypet.test | Refugio pendiente de autorización |

## Pruebas

El instalador de Windows prepara una base separada. Jest reinicializa el esquema de `TEST_DATABASE_URL`. Usa este comando únicamente con una base de pruebas desechable.

```bash
cd server && npm test
```

## Seguridad y privacidad

Abre **Mi perfil → Seguridad y privacidad**. Después de actualizar el esquema, vuelve a iniciar sesión. Los JWT anteriores a la migración deberán renovarse mediante un nuevo inicio de sesión. Los avisos críticos se entregan en la campana de FindMyPet.

La exportación JSON incluye datos de la cuenta y referencias a los archivos propios. Las solicitudes de desactivación o eliminación llegan a **Administración → Solicitudes de cuenta**, donde se revisan. Para automatizar su ejecución hace falta definir qué sucede con reportes y adopciones pendientes, cómo se reactiva la cuenta y qué datos se deben conservar o eliminar. La verificación en dos pasos queda pendiente hasta configurar el almacenamiento protegido del segundo factor y el procedimiento de recuperación de acceso.

## Avistamientos y traslados a refugios

Cada ficha de mascota perdida tiene una sección **Avistamientos**. Usa **Publicar avistamiento** desde esa ficha para añadir fotos y observaciones. El avistamiento también conserva su propia página. Las coincidencias sugeridas y los reportes publicados por separado siguen su flujo habitual.

En una base local con las fichas de demostración, `npm run seed:avistamientos` desde `server` añade ejemplos ficticios a Rocky y Michi. Este comando conserva los reportes existentes.

Cuando el propietario confirma la recuperación, la ficha pasa de **Perdidas** a **Recuperados**. Los avistamientos vinculados se consultan en esa misma ficha. Los reportes independientes siguen disponibles en **Mis reportes** y en el flujo de coincidencias.

En una publicación de mascota perdida, abre **¿La has visto?**. Usa **Registra un avistamiento** si solo viste al animal. Si ya lo entregaste, abre **Informar traslado a un refugio** e indica en qué estado estaba, dónde y cuándo lo localizaste y qué refugio lo recibió. Las señas particulares son opcionales. El formulario toma el tipo de animal de la ficha de origen y usa la categoría **Otro** cuando se abre sin una referencia disponible. Puedes añadir notas de entrega para las cuentas vinculadas y también informar de un traslado desde el detalle de un avistamiento propio.

Desde **Mi refugio → Gestionar traslado**, el refugio confirma la recepción, consulta los contactos autorizados de quien reportó el avistamiento y puede escribir por privado a los posibles propietarios. Recibe avisos de nuevas coincidencias, de la posible identificación y de la confirmación de recuperación de un reporte vinculado.

El análisis sugiere similitudes y avisa a los propietarios. Usa ubicación, fechas y atributos locales, incluidas señas comparables en la descripción. Con `GEMINI_API_KEY`, la comparación visual usa la foto principal de la mascota perdida y las fotos del aporte publicado en **Avistamientos** de esa ficha. Los reportes independientes siguen participando mediante sus atributos. Indicar una posible identificación deja la desaparición activa. El propietario confirma la recuperación en el estado de su reporte.

## Despliegue
- **Base de datos:** Neon → crear proyecto → copiar la *connection string* (incluye `?sslmode=require`).
- **Backend:** Render → New → Blueprint con `render.yaml`, o Web Service con raíz `server`, build `npm install`,
  start `npm run start:prod`. Variables: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `CORS_ORIGIN`, `GEMINI_API_KEY` (opcional).
  Reserva `npm run seed` para una base desechable.
- **Frontend:** Vercel → importar el repositorio con raíz `client`, framework Vite, variable `VITE_API_URL` = URL del backend.

## Variables de entorno
Ver `server/.env.example` y `client/.env.example`. Sin `GEMINI_API_KEY` la plataforma funciona igual: las coincidencias
se calculan por atributos y las fotos no se validan con IA (RNF-16). Sin SMTP, el enlace de recuperación de contraseña
se muestra en la consola del servidor.

## Control de versiones con Git y GitHub

Abre esta carpeta en Codex de escritorio. El repositorio de respaldo es [FindMyPet](https://github.com/kdavilab2-ai/FindMyPet). Usa tu cuenta autorizada de GitHub y confirma que tienes acceso al repositorio privado.

Trabaja en `main`. Con el árbol de trabajo limpio, actualiza la rama antes de iniciar una modificación.

```powershell
git switch main
git pull --ff-only
```

Después de verificar los cambios con `npm test` en `server` y `npm run build` en `client`, prepara los archivos seleccionados y revisa qué se incluirá.

```powershell
git status --short
git diff
git add -- ruta/al/archivo
git diff --cached
git commit -m "feat: describe el cambio"
git push origin main
```

Compara `git rev-parse HEAD` con el identificador que devuelve `git ls-remote origin refs/heads/main`. Si GitHub rechaza el push porque `main` avanzó, revisa el historial remoto e integra los cambios antes de volver a verificar y subir.

- **Consultar una versión.** Ejecuta `git log --oneline --graph --all` y luego `git show SHA`, sustituyendo `SHA` por el identificador del commit.
- **Recuperar una versión en otra rama.** Ejecuta `git switch -c feature/recuperar-version SHA` con un árbol de trabajo limpio. Para deshacer un commit ya compartido, usa `git revert SHA` en una rama y revisa el cambio antes de subirlo.
- **Revisar privacidad.** Mantén las credenciales en `.env` local y usa valores de ejemplo en `.env.example`. Revisa `git status --ignored --short` y el diff preparado antes de cada commit. Excluye bases, cargas, copias y correos de prueba de `.runtime/mail/`. Si una credencial se llegó a compartir, revócala y rótala. Cambiar `.gitignore` solo afecta archivos no rastreados.
- **Autenticación local.** Con [GitHub CLI](https://cli.github.com/) instalado, usa `gh auth login --hostname github.com --git-protocol https --web` y comprueba la cuenta con `gh auth status`. Completa el acceso en GitHub.
