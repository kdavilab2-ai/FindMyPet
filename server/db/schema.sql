-- =====================================================================
-- FindMyPet · Esquema de base de datos (PostgreSQL 14+)
-- Basado en el Modelo de datos (sección 2.4 del Plan de Proyecto, Grupo 4)
-- Se ejecuta con: npm run db:migrate
-- =====================================================================

-- ---------- Catálogos ----------
CREATE TABLE IF NOT EXISTS rol (
  id_rol  INT PRIMARY KEY,
  nombre  VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS estado_cuenta (
  id_estado_cuenta INT PRIMARY KEY,
  nombre           VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tipo_token (
  id_tipo_token INT PRIMARY KEY,
  nombre        VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tipo_publicacion (
  id_tipo INT PRIMARY KEY,
  nombre  VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS estado_publicacion (
  id_estado INT PRIMARY KEY,
  id_tipo   INT NOT NULL REFERENCES tipo_publicacion(id_tipo),
  nombre    VARCHAR(20) NOT NULL,
  UNIQUE (id_tipo, nombre)
);

CREATE TABLE IF NOT EXISTS especie (
  id_especie INT PRIMARY KEY,
  nombre     VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS raza (
  id_raza    SERIAL PRIMARY KEY,
  id_especie INT NOT NULL REFERENCES especie(id_especie),
  nombre     VARCHAR(60) NOT NULL,
  UNIQUE (id_especie, nombre)
);

CREATE TABLE IF NOT EXISTS tamano (
  id_tamano INT PRIMARY KEY,
  nombre    VARCHAR(15) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS color (
  id_color SERIAL PRIMARY KEY,
  nombre   VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tipo_multimedia (
  id_tipo_multimedia INT PRIMARY KEY,
  nombre             VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tipo_contacto (
  id_tipo_contacto INT PRIMARY KEY,
  nombre           VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS provincia (
  id_provincia SERIAL PRIMARY KEY,
  nombre       VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS canton (
  id_canton    SERIAL PRIMARY KEY,
  id_provincia INT NOT NULL REFERENCES provincia(id_provincia),
  nombre       VARCHAR(60) NOT NULL,
  UNIQUE (id_provincia, nombre)
);

CREATE TABLE IF NOT EXISTS sector (
  id_sector SERIAL PRIMARY KEY,
  id_canton INT NOT NULL REFERENCES canton(id_canton),
  nombre    VARCHAR(80) NOT NULL,
  UNIQUE (id_canton, nombre)
);

CREATE TABLE IF NOT EXISTS tipo_notificacion (
  id_tipo_notificacion INT PRIMARY KEY,
  nombre               VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tipo_accion (
  id_tipo_accion INT PRIMARY KEY,
  nombre         VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS estado_coincidencia (
  id_estado INT PRIMARY KEY,
  nombre    VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS criterio_ia (
  id_criterio INT PRIMARY KEY,
  nombre      VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS estado_solicitud (
  id_estado_solicitud INT PRIMARY KEY,
  nombre              VARCHAR(20) NOT NULL UNIQUE
);

-- ---------- Usuarios y cuentas ----------
CREATE TABLE IF NOT EXISTS ubicacion (
  id_ubicacion SERIAL PRIMARY KEY,
  id_sector    INT NOT NULL REFERENCES sector(id_sector),
  direccion    VARCHAR(200),
  latitud      DECIMAL(9,6),
  longitud     DECIMAL(9,6)
);

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario         SERIAL PRIMARY KEY,
  id_rol             INT NOT NULL REFERENCES rol(id_rol),
  id_estado_cuenta   INT NOT NULL DEFAULT 1 REFERENCES estado_cuenta(id_estado_cuenta),
  nombres            VARCHAR(80) NOT NULL,
  apellidos          VARCHAR(80) NOT NULL,
  correo             VARCHAR(120) NOT NULL UNIQUE,
  contrasena_hash    VARCHAR(255) NOT NULL,
  telefono           VARCHAR(15),
  fecha_verificacion TIMESTAMP,
  fecha_registro     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_usuario (
  id_token      SERIAL PRIMARY KEY,
  id_usuario    INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_tipo_token INT NOT NULL REFERENCES tipo_token(id_tipo_token),
  token_hash    VARCHAR(255) NOT NULL UNIQUE,
  expira_en     TIMESTAMP NOT NULL,
  fecha_uso     TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consentimiento (
  id_consentimiento SERIAL PRIMARY KEY,
  id_usuario        INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  version_politica  VARCHAR(10) NOT NULL,
  fecha_aceptacion  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preferencia_alerta (
  id_usuario   INT PRIMARY KEY REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_ubicacion INT NOT NULL REFERENCES ubicacion(id_ubicacion),
  radio_km     INT NOT NULL DEFAULT 5 CHECK (radio_km BETWEEN 1 AND 50)
);

CREATE TABLE IF NOT EXISTS refugio (
  id_refugio   SERIAL PRIMARY KEY,
  id_usuario   INT NOT NULL UNIQUE REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_ubicacion INT NOT NULL REFERENCES ubicacion(id_ubicacion),
  nombre       VARCHAR(100) NOT NULL,
  autorizado   BOOLEAN NOT NULL DEFAULT FALSE
);

-- ---------- Publicaciones ----------
CREATE TABLE IF NOT EXISTS publicacion (
  id_publicacion SERIAL PRIMARY KEY,
  id_usuario     INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_tipo        INT NOT NULL REFERENCES tipo_publicacion(id_tipo),
  id_estado      INT NOT NULL REFERENCES estado_publicacion(id_estado),
  id_especie     INT NOT NULL REFERENCES especie(id_especie),
  id_raza        INT REFERENCES raza(id_raza),
  id_tamano      INT REFERENCES tamano(id_tamano),
  nombre_animal  VARCHAR(60),
  descripcion    TEXT NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_publicacion_tipo ON publicacion(id_tipo, id_estado);

CREATE TABLE IF NOT EXISTS publicacion_color (
  id_publicacion INT REFERENCES publicacion(id_publicacion) ON DELETE CASCADE,
  id_color       INT REFERENCES color(id_color),
  PRIMARY KEY (id_publicacion, id_color)
);

-- Reporte: mascota desaparecida o animal encontrado
CREATE TABLE IF NOT EXISTS reporte (
  id_publicacion INT PRIMARY KEY REFERENCES publicacion(id_publicacion) ON DELETE CASCADE,
  id_ubicacion   INT NOT NULL REFERENCES ubicacion(id_ubicacion),
  fecha_evento   DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS adopcion (
  id_publicacion INT PRIMARY KEY REFERENCES publicacion(id_publicacion) ON DELETE CASCADE,
  estado_salud   VARCHAR(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS contacto_publicacion (
  id_contacto      SERIAL PRIMARY KEY,
  id_publicacion   INT NOT NULL REFERENCES publicacion(id_publicacion) ON DELETE CASCADE,
  id_tipo_contacto INT NOT NULL REFERENCES tipo_contacto(id_tipo_contacto),
  valor            VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS multimedia (
  id_multimedia      SERIAL PRIMARY KEY,
  id_publicacion     INT NOT NULL REFERENCES publicacion(id_publicacion) ON DELETE CASCADE,
  id_tipo_multimedia INT NOT NULL REFERENCES tipo_multimedia(id_tipo_multimedia),
  url                VARCHAR(255) NOT NULL,
  es_valida_ia       BOOLEAN
);

-- Contenido binario de cada archivo (así las fotos no se pierden al reiniciar el servidor)
CREATE TABLE IF NOT EXISTS multimedia_archivo (
  id_multimedia INT PRIMARY KEY REFERENCES multimedia(id_multimedia) ON DELETE CASCADE,
  mime          VARCHAR(40) NOT NULL,
  datos         BYTEA NOT NULL
);

-- ---------- Inteligencia artificial ----------
CREATE TABLE IF NOT EXISTS coincidencia (
  id_coincidencia SERIAL PRIMARY KEY,
  id_desaparecida INT NOT NULL REFERENCES reporte(id_publicacion) ON DELETE CASCADE,
  id_encontrada   INT NOT NULL REFERENCES reporte(id_publicacion) ON DELETE CASCADE,
  id_estado       INT NOT NULL DEFAULT 1 REFERENCES estado_coincidencia(id_estado),
  porcentaje      DECIMAL(5,2) NOT NULL,
  fecha_analisis  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (id_desaparecida, id_encontrada)
);

CREATE TABLE IF NOT EXISTS coincidencia_criterio (
  id_coincidencia INT REFERENCES coincidencia(id_coincidencia) ON DELETE CASCADE,
  id_criterio     INT REFERENCES criterio_ia(id_criterio),
  puntaje         DECIMAL(5,2) NOT NULL,
  PRIMARY KEY (id_coincidencia, id_criterio)
);

-- ---------- Administración y auditoría ----------
CREATE TABLE IF NOT EXISTS moderacion (
  id_moderacion  SERIAL PRIMARY KEY,
  id_admin       INT NOT NULL REFERENCES usuario(id_usuario),
  id_publicacion INT REFERENCES publicacion(id_publicacion) ON DELETE SET NULL,
  id_tipo_accion INT NOT NULL REFERENCES tipo_accion(id_tipo_accion),
  motivo         VARCHAR(255) NOT NULL,
  fecha_hora     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS control_cuenta (
  id_control      SERIAL PRIMARY KEY,
  id_admin        INT NOT NULL REFERENCES usuario(id_usuario),
  id_usuario      INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_estado_nuevo INT NOT NULL REFERENCES estado_cuenta(id_estado_cuenta),
  motivo          VARCHAR(255) NOT NULL,
  fecha_hora      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notificacion (
  id_notificacion      SERIAL PRIMARY KEY,
  id_usuario           INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_publicacion       INT REFERENCES publicacion(id_publicacion) ON DELETE CASCADE,
  id_tipo_notificacion INT NOT NULL REFERENCES tipo_notificacion(id_tipo_notificacion),
  mensaje              VARCHAR(255) NOT NULL,
  leida                BOOLEAN NOT NULL DEFAULT FALSE,
  fecha                TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notificacion_usuario ON notificacion(id_usuario, leida);

-- ---------- Refugios: valoraciones y donaciones ----------
CREATE TABLE IF NOT EXISTS valoracion (
  id_valoracion SERIAL PRIMARY KEY,
  id_refugio    INT NOT NULL REFERENCES refugio(id_refugio) ON DELETE CASCADE,
  id_usuario    INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  calificacion  INT NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
  comentario    TEXT,
  fecha         TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (id_refugio, id_usuario)
);

CREATE TABLE IF NOT EXISTS solicitud_donacion (
  id_solicitud        SERIAL PRIMARY KEY,
  id_refugio          INT NOT NULL REFERENCES refugio(id_refugio) ON DELETE CASCADE,
  id_estado_solicitud INT NOT NULL DEFAULT 1 REFERENCES estado_solicitud(id_estado_solicitud),
  titulo              VARCHAR(100) NOT NULL,
  descripcion         TEXT NOT NULL,
  fecha               TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Aporte registrado (dinero comprometido o insumos). Sin pagos en línea: exclusión del alcance.
CREATE TABLE IF NOT EXISTS donacion (
  id_donacion  SERIAL PRIMARY KEY,
  id_usuario   INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_refugio   INT NOT NULL REFERENCES refugio(id_refugio) ON DELETE CASCADE,
  id_solicitud INT REFERENCES solicitud_donacion(id_solicitud) ON DELETE SET NULL,
  monto        DECIMAL(10,2) CHECK (monto IS NULL OR monto > 0),
  detalle      VARCHAR(255),
  fecha        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------- Datos de catálogo ----------
INSERT INTO rol VALUES (1, 'Ciudadano'), (2, 'Refugio'), (3, 'Administrador') ON CONFLICT DO NOTHING;
INSERT INTO estado_cuenta VALUES (1, 'Activa'), (2, 'Suspendida'), (3, 'Bloqueada') ON CONFLICT DO NOTHING;
INSERT INTO tipo_token VALUES (1, 'Recuperación'), (2, 'Verificación') ON CONFLICT DO NOTHING;
INSERT INTO tipo_publicacion VALUES (1, 'Desaparecida'), (2, 'Encontrada'), (3, 'Adopción') ON CONFLICT DO NOTHING;
INSERT INTO estado_publicacion VALUES
  (1, 1, 'Pendiente'), (2, 1, 'Recuperada'),
  (3, 2, 'Pendiente'), (4, 2, 'Entregada'),
  (5, 3, 'Disponible'), (6, 3, 'Adoptado')
ON CONFLICT DO NOTHING;
INSERT INTO especie VALUES (1, 'Perro'), (2, 'Gato'), (3, 'Ave'), (4, 'Conejo'), (5, 'Otro') ON CONFLICT DO NOTHING;
INSERT INTO raza (id_especie, nombre) VALUES
  (1, 'Mestizo'), (1, 'Labrador'), (1, 'Golden Retriever'), (1, 'Pastor Alemán'), (1, 'Poodle'), (1, 'Chihuahua'),
  (1, 'Bulldog'), (1, 'Pitbull'), (1, 'Schnauzer'), (1, 'Husky'), (1, 'Beagle'), (1, 'Shih Tzu'), (1, 'Pug'),
  (2, 'Mestizo'), (2, 'Siamés'), (2, 'Persa'), (2, 'Angora'), (2, 'Bengalí'),
  (3, 'Perico'), (3, 'Loro'), (3, 'Canario'),
  (4, 'Mestizo'), (4, 'Cabeza de león'),
  (5, 'No aplica')
ON CONFLICT DO NOTHING;
INSERT INTO tamano VALUES (1, 'Pequeño'), (2, 'Mediano'), (3, 'Grande') ON CONFLICT DO NOTHING;
INSERT INTO color (nombre) VALUES
  ('Negro'), ('Blanco'), ('Café'), ('Gris'), ('Dorado'), ('Crema'), ('Beige'), ('Naranja'), ('Atigrado'), ('Manchado')
ON CONFLICT DO NOTHING;
INSERT INTO tipo_multimedia VALUES (1, 'Imagen'), (2, 'Video') ON CONFLICT DO NOTHING;
INSERT INTO tipo_contacto VALUES (1, 'Teléfono'), (2, 'WhatsApp'), (3, 'Correo') ON CONFLICT DO NOTHING;
INSERT INTO tipo_notificacion VALUES
  (1, 'Alerta de proximidad'), (2, 'Coincidencia IA'), (3, 'Interés en adopción'), (4, 'Moderación'), (5, 'Cuenta')
ON CONFLICT DO NOTHING;
INSERT INTO tipo_accion VALUES (1, 'Eliminar'), (2, 'Advertencia'), (3, 'Actualizar') ON CONFLICT DO NOTHING;
INSERT INTO estado_coincidencia VALUES (1, 'Sugerida'), (2, 'Confirmada'), (3, 'Descartada') ON CONFLICT DO NOTHING;
INSERT INTO criterio_ia VALUES
  (1, 'Especie'), (2, 'Raza'), (3, 'Color'), (4, 'Tamaño'), (5, 'Ubicación'), (6, 'Fecha'), (7, 'Imagen')
ON CONFLICT DO NOTHING;
INSERT INTO estado_solicitud VALUES (1, 'Abierta'), (2, 'Cerrada') ON CONFLICT DO NOTHING;

INSERT INTO provincia (nombre) VALUES ('Guayas'), ('Los Ríos'), ('Pichincha') ON CONFLICT DO NOTHING;
INSERT INTO canton (id_provincia, nombre)
SELECT p.id_provincia, c.nombre FROM provincia p
JOIN (VALUES ('Guayas', 'Milagro'), ('Guayas', 'Guayaquil'), ('Guayas', 'Durán'), ('Guayas', 'Naranjito'),
             ('Guayas', 'Yaguachi'), ('Guayas', 'Simón Bolívar'), ('Los Ríos', 'Babahoyo'), ('Pichincha', 'Quito'))
  AS c(provincia, nombre) ON c.provincia = p.nombre
ON CONFLICT DO NOTHING;
INSERT INTO sector (id_canton, nombre)
SELECT c.id_canton, s.nombre FROM canton c
JOIN (VALUES
  ('Milagro', 'Centro'), ('Milagro', 'Las Piñas'), ('Milagro', 'Los Chirijos'), ('Milagro', 'Bellavista'),
  ('Milagro', 'Ciudadela Universitaria'), ('Milagro', 'Enrique Valdez'), ('Milagro', 'Los Pinos'), ('Milagro', 'San Miguel'),
  ('Guayaquil', 'Centro'), ('Guayaquil', 'Urdesa'), ('Guayaquil', 'Alborada'), ('Guayaquil', 'Sauces'), ('Guayaquil', 'Guasmo'),
  ('Durán', 'Centro'), ('Naranjito', 'Centro'), ('Yaguachi', 'Centro'), ('Simón Bolívar', 'Centro'),
  ('Babahoyo', 'Centro'), ('Quito', 'Centro Histórico'), ('Quito', 'La Carolina')
) AS s(canton, nombre) ON s.canton = c.nombre
ON CONFLICT DO NOTHING;
