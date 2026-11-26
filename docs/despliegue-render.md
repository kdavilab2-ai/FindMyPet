# Demostración de FindMyPet en Render

`render.demo.yaml` prepara tres recursos. React se publica como sitio estático, Express como servicio web **Free** y PostgreSQL como base **Free** en la misma región que Express. El enlace para compartir es el del sitio estático. Render proporciona HTTPS. Las fotos se procesan con Sharp y los archivos se guardan en `multimedia_archivo`, por lo que siguen en PostgreSQL al reiniciar o volver a desplegar la API.

La API gratuita puede tardar alrededor de un minuto en despertar tras 15 minutos de inactividad. PostgreSQL Free tiene 1 GB, admite una base por workspace y deja de aceptar conexiones a los 30 días de su creación. Render la elimina tras otros 14 días y el plan Free carece de copias administradas. Crea los recursos cerca de la presentación y exporta los datos que quieras conservar antes del vencimiento. Para una demo sin cargos por excedentes, usa un workspace Hobby sin método de pago y comprueba el consumo en **Billing → Monthly Included Usage**. Si agotas la transferencia incluida, Render suspende los servicios Free del workspace. Si agotas los minutos de compilación, bloquea las compilaciones nuevas hasta el mes siguiente. [Límites de Render Free](https://render.com/docs/free).

## Crear la demostración

1. Prepara un relay SMTP con STARTTLS en el puerto `2525`. Render Free bloquea los puertos `25`, `465` y `587`. Brevo sirve como ejemplo con plan gratuito. Activa el correo transaccional, verifica el remitente y autentica el dominio si lo exige tu proveedor. En Brevo, copia el usuario y la clave **SMTP** desde **SMTP & API**. [Restricciones de Render](https://render.com/articles/can-i-send-email-over-smtp-from-render) · [SMTP de Brevo](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP) · [Plan Free de Brevo](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans).
2. En Render, abre **New → Blueprint**, concede acceso a GitHub al repositorio privado `kdavilab2-ai/FindMyPet` y selecciona `main`. En **Blueprint Path**, escribe `render.demo.yaml`. Revisa que el plan muestre tres recursos nuevos y que la API y PostgreSQL indiquen **Free**. Si el workspace ya tiene una base Free o Render propone cambiar un recurso existente, revisa el workspace y los nombres antes de aplicar. [Configuración de Blueprints](https://render.com/docs/infrastructure-as-code#setup).
3. Completa los campos solicitados según la tabla. Si todavía desconoces las URLs asignadas, usa `https://demo.example.invalid` en `FRONTEND_URL` y `CORS_ORIGIN`, y `https://api.example.invalid` en `VITE_API_URL`. Estos valores permiten completar el formulario inicial. La aplicación quedará lista para probar después de sustituirlos.
4. Cuando decidas publicar, pulsa **Deploy Blueprint**. Render genera `JWT_SECRET`, conecta `DATABASE_URL` por la red interna y asigna `PORT`. La API ejecuta `npm run start:prod`, que aplica el esquema y los catálogos iniciales antes de escuchar. Si la migración falla, el proceso se detiene. Los deploys automáticos de los servicios quedan desactivados. En **Blueprint → Settings**, pon **Auto Sync** en **No** para controlar cuándo se aplican cambios de infraestructura. [Sincronización de Blueprints](https://render.com/docs/infrastructure-as-code#disabling-automatic-sync).
5. Copia las URLs HTTPS reales que Render muestra para cada servicio. En **Environment** de la API, guarda la URL del sitio en `FRONTEND_URL` y `CORS_ORIGIN`. En **Environment** del sitio estático, guarda la URL de la API en `VITE_API_URL`. Usa las URLs sin `/` final ni `/api`. Guarda los cambios y vuelve a desplegar ambos servicios. `VITE_API_URL` se incorpora durante la compilación del sitio. [Variables de entorno de Render](https://render.com/docs/configure-environment-variables).

| Servicio | Variable | Valor en Render |
| --- | --- | --- |
| API | `FRONTEND_URL` | URL HTTPS del sitio, por ejemplo `https://findmypet-unemi-demo.onrender.com`. Se usa en el enlace de recuperación. |
| API | `CORS_ORIGIN` | La misma URL HTTPS del sitio. Autoriza las peticiones de React desde ese origen. |
| API | `SMTP_HOST` | Host del relay, por ejemplo `smtp-relay.brevo.com`. El Blueprint ya define `SMTP_PORT=2525`. |
| API | `SMTP_USER` | Usuario SMTP que figura en el panel del proveedor. |
| API | `SMTP_PASS` | Clave SMTP generada en el proveedor. |
| API | `SMTP_FROM` | Remitente verificado, en el formato `FindMyPet <correo-verificado>`. |
| API | `GEMINI_API_KEY` | Opcional. Si habilitas Gemini, añade la clave en **Environment** de la API y verifica la cuota del proyecto. También puedes establecer `GEMINI_MODEL`. Sin la clave funciona el cálculo por atributos definido en RNF-16. |
| Sitio | `VITE_API_URL` | URL HTTPS de la API, por ejemplo `https://findmypet-unemi-demo-api.onrender.com`. Las variables `VITE_*` se incluyen en el código que descarga el navegador. |

Mantén las credenciales en el panel de la API y los `.env` locales fuera de Git. `JWT_SECRET` debe conservar su valor entre deploys para mantener la validez de las sesiones. Para las pruebas del repositorio, usa exclusivamente una base desechable local en `TEST_DATABASE_URL`, ya que Jest reinicializa su esquema.

## Datos de prueba y administración

La base de Render empieza con catálogos. Registra cuentas de demostración y crea reportes ficticios desde la interfaz. `npm run seed` y el lanzador local de demostración usan cuentas con contraseña de muestra conocida. Reserva esos comandos para el entorno local.

Para habilitar **Administración** en la demo, registra primero una cuenta dedicada con contraseña privada. Desde **Networking** de la base, permite temporalmente solo tu IP pública y abre `psql` con la conexión externa de Render y TLS (`sslmode=require`). Comprueba `SELECT current_database();` y, en la base de la demo, ejecuta lo siguiente. `psql` te pedirá el correo de la cuenta que acabas de registrar.

```sql
\prompt 'Correo de la cuenta dedicada: ' correo_demo
UPDATE usuario SET id_rol = (SELECT id_rol FROM rol WHERE nombre = 'Administrador')
WHERE correo = lower(trim(:'correo_demo'))
  AND id_rol = (SELECT id_rol FROM rol WHERE nombre = 'Ciudadano')
RETURNING id_usuario;
```

Confirma que se actualizó una sola cuenta, cierra su sesión y vuelve a entrar. Retira tu IP de la lista de acceso externo al terminar. Comparte la URL del sitio y reserva las credenciales administrativas para el equipo. [Acceso externo de PostgreSQL](https://render.com/docs/postgresql-creating-connecting#restricting-external-access).

## Copia y restauración de PostgreSQL

- Para exportar la demo antes de su vencimiento, habilita temporalmente tu IP en PostgreSQL. Usa `pg_dump` con la conexión externa y TLS, mantén la copia en un lugar privado y retira tu IP al terminar. Usa una versión de `pg_dump` igual o posterior a la del servidor que exportas. El formato personalizado incluye las fotos almacenadas en PostgreSQL. [Documentación de pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html).
- Si necesitas trasladar datos previos, revisa primero la autorización para publicar reportes, contactos y fotos. Prepara y revisa una copia separada con datos aptos para la demostración. Restaura la copia en una base PostgreSQL nueva y vacía antes de conectar la API. En ese caso, crea la base primero desde el panel y crea luego la API y el sitio como servicios manuales usando los mismos ajustes de `render.demo.yaml`. Introduce en la API la **Internal Database URL** de la base restaurada. Conserva la base de origen hasta validar la restauración y la aplicación. Si llenaste una base mediante el Blueprint, conserva también esa base mientras pruebas la restauración en otra.
- En PowerShell puedes usar los comandos de abajo. Sustituye los marcadores entre comillas y deja que las herramientas pidan la contraseña. Usa `PGSSLMODE=require` para cada conexión externa a Render y el modo habitual de tu instalación para una conexión local. Comprueba que los comandos terminen correctamente y compara en origen y destino los recuentos de `usuario`, `publicacion` y `multimedia_archivo`. Abre fotos y fichas recuperadas para comprobar que el contenido también sea legible. [Documentación de pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html).

```powershell
$env:PGSSLMODE = 'require'
pg_dump -h 'HOST_ORIGEN' -U 'USUARIO_ORIGEN' -d 'BASE_ORIGEN' -W --format=custom --no-owner --no-privileges --file='findmypet.dump'
pg_restore --list 'findmypet.dump'
pg_restore -h 'HOST_DESTINO' -U 'USUARIO_DESTINO' -d 'BASE_NUEVA_VACIA' -W --no-owner --no-privileges --single-transaction --exit-on-error 'findmypet.dump'
Remove-Item Env:PGSSLMODE
```

Si creas los servicios manualmente para publicar una copia revisada, usa estos valores. Desactiva el acceso externo a PostgreSQL después de restaurar. Conecta la API a la base restaurada por la red interna y configura sus variables según la tabla anterior. Introduce también `NODE_ENV=production`, `NODE_VERSION=24.x`, `DB_SSL=true`, `SMTP_PORT=2525` y un `JWT_SECRET` nuevo y aleatorio. Conserva ese secreto para los siguientes deploys de la demo. En el sitio, añade `NODE_VERSION=24.x` y `SKIP_INSTALL_DEPS=true` junto a `VITE_API_URL`.

| Servicio | Ajustes manuales |
| --- | --- |
| PostgreSQL | Free, región Oregon. Usa una base nueva y habilita solo tu IP pública durante la restauración. |
| Web Service (API) | Node, Free, región Oregon, rama `main`, **Root Directory** `server`, **Build Command** `npm ci --omit=dev`, **Start Command** `npm run start:prod`, **Health Check Path** `/api/salud`, **Auto-Deploy** Off. |
| Static Site (sitio) | Rama `main`, **Root Directory** `client`, **Build Command** `npm ci --include=dev && npm run build`, **Publish Directory** `./dist`, **Auto-Deploy** Off. En **Redirects/Rewrites**, añade una regla **Rewrite** de `/*` a `/index.html` para abrir enlaces directos y recargar rutas como `/restablecer`. |

## Comprobar antes de compartir el enlace

1. En la URL HTTPS de la API, visita `/api/salud` y `/api/catalogos`. El primero comprueba que Express responde y el segundo confirma la lectura de PostgreSQL.
2. En la URL del sitio, registra una cuenta de prueba, entra, recarga una ruta interna, comprueba que la sesión sigue activa y ciérrala. Solicita recuperación a un buzón que controles y completa el cambio desde el enlace HTTPS recibido.
3. Publica un reporte ficticio con foto y prueba también un video permitido. Abre los archivos desde la ficha, comprueba el mapa y descarga el cartel PDF. Revisa un avistamiento, una adopción y sus acciones con las cuentas correspondientes. Comprueba las coincidencias por atributos y también las visuales si activaste Gemini.
4. Después de volver a desplegar la API, abre el mismo reporte y la misma foto. Comparte el enlace del sitio tras comprobar que se conservaron y que los pasos anteriores funcionan.
