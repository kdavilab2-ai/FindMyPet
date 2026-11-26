# Demostración de FindMyPet en Render

`render.demo.yaml` prepara tres recursos. React se publica como sitio estático, Express como servicio web **Free** y PostgreSQL como base **Free** en la misma región que Express. El enlace para compartir es el del sitio estático. Render proporciona HTTPS. Las fotos se procesan con Sharp y los archivos se guardan en `multimedia_archivo`, por lo que siguen en PostgreSQL al reiniciar o volver a desplegar la API.

La API gratuita puede tardar alrededor de un minuto en despertar tras 15 minutos de inactividad. PostgreSQL Free tiene 1 GB, admite una base por workspace y deja de aceptar conexiones a los 30 días de su creación. Render la elimina tras otros 14 días y el plan Free carece de copias administradas. Crea los recursos cerca de la presentación, exporta los datos que quieras conservar antes del vencimiento y comprueba el consumo incluido en el panel. [Límites de Render Free](https://render.com/docs/free).

## Crear la demostración

1. Comprueba que `render.demo.yaml` esté en `main` del repositorio privado `kdavilab2-ai/FindMyPet`. En Render abre **New → Blueprint**, conecta GitHub con acceso a ese repositorio y configura **Blueprint Path** como `render.demo.yaml`. Revisa que los tres recursos sean nuevos y que la API y PostgreSQL indiquen **Free**. Si ya tienes una base Free en el workspace o el panel propone cambiar un recurso existente, detente antes de aplicar. [Configuración de Blueprints](https://render.com/docs/infrastructure-as-code#setup).
2. Activa el envío transaccional en un relay SMTP con STARTTLS en el puerto `2525`, por ejemplo Brevo. Verifica un remitente y autentica su dominio si lo exige el proveedor. Guarda las credenciales del relay en el panel de Render. [SMTP de Brevo](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP) · [Puertos admitidos](https://help.brevo.com/hc/en-us/articles/10905415650322-Which-SMTP-port-should-I-use-Port-587-465-or-2525).
3. Completa las variables de la tabla. Si aún no conoces las URLs asignadas, introduce temporalmente `https://demo.example.invalid` para el sitio y `https://api.example.invalid` para la API. Tras crear los recursos, copia sus URLs reales desde el panel a **Environment** de cada servicio. Usa las URLs HTTPS sin `/` final ni `/api`. Guarda y vuelve a desplegar los servicios afectados. El sitio necesita una nueva compilación tras cambiar `VITE_API_URL`.
4. Cuando quieras iniciar la publicación, pulsa **Deploy Blueprint**. Render genera `JWT_SECRET`, conecta `DATABASE_URL` por la red interna y asigna `PORT`. La API ejecuta `npm run start:prod`, que aplica el esquema y los catálogos iniciales antes de escuchar. Si el esquema falla, el proceso se detiene. Los deploys automáticos de los servicios quedan desactivados. En **Blueprint → Settings**, pon **Auto Sync** en **No** para controlar también cuándo se aplican cambios del Blueprint. [Sincronización de Blueprints](https://render.com/docs/infrastructure-as-code#disabling-automatic-sync).

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

Mantén las credenciales en el panel de la API y los `.env` locales fuera de Git. Para las pruebas del repositorio, usa únicamente la base desechable local `TEST_DATABASE_URL`.

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

## Comprobar antes de compartir el enlace

1. En la URL HTTPS de la API, visita `/api/salud` y `/api/catalogos`. El primero comprueba que Express responde y el segundo confirma la lectura de PostgreSQL.
2. En la URL del sitio, registra una cuenta de prueba, entra, recarga una ruta interna, comprueba que la sesión sigue activa y ciérrala. Solicita recuperación a un buzón que controles y completa el cambio desde el enlace HTTPS recibido.
3. Publica un reporte ficticio con foto. Abre la foto desde la ficha, comprueba el mapa y descarga el cartel PDF. Revisa un avistamiento, una adopción y sus acciones con las cuentas correspondientes. Comprueba las coincidencias por atributos y también las visuales si activaste Gemini.
4. Después de volver a desplegar la API, abre el mismo reporte y la misma foto. Comparte el enlace del sitio tras comprobar que se conservaron y que los pasos anteriores funcionan.
