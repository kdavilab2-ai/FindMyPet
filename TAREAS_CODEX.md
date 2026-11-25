# Tareas para Codex

El sistema base de FindMyPet ya está construido. Estas son tareas **reales** para hacer con Codex sobre este
repositorio, grabarlas para el video y explicar qué hizo Codex. Cada tarea es independiente: hagan las que alcancen.

Antes de empezar: suban el repositorio a GitHub, abran chatgpt.com/codex (o la CLI `codex`) y conéctenlo al repositorio.
Codex lee `AGENTS.md` automáticamente. Para cada tarea: copiar el prompt, revisar el plan y el diff, verificar que
`npm test` pase, crear el pull request y hacer merge.

---

## 1. Revisión de código y seguridad (recomendada para empezar)
```text
Revisa el backend en server/src buscando problemas de seguridad (inyección SQL, rutas sin proteger, validaciones
faltantes, datos personales expuestos según RNF-05) y de calidad. Dame una lista priorizada de hallazgos con el
archivo y la línea. Después corrige los 3 más importantes, con pruebas que demuestren la corrección.
```

## 2. Pruebas del frontend
```text
Configura Vitest y React Testing Library en client/. Escribe pruebas para: el formulario de Registro (valida
contraseña débil, contraseñas distintas y consentimiento), la TarjetaMascota (muestra la insignia según el tipo)
y el SelectorUbicacion (los cantones se filtran por provincia). Agrega el script "test" en client/package.json.
```

## 3. Historial de cambios de estado (nueva funcionalidad)
```text
Agrega un historial de estados para cada publicación: una tabla historial_estado (id_historial, id_publicacion,
id_estado_anterior, id_estado_nuevo, id_usuario, fecha) en db/schema.sql, que se registre cada vez que cambia el
estado (por el autor o por el administrador). Muéstralo como una línea de tiempo en la página de Detalle, visible
solo para el autor y el administrador. Incluye pruebas.
```

## 4. Compartir publicación
```text
En la página de Detalle agrega un botón "Compartir" que use la Web Share API en el celular y, si no está
disponible, copie el enlace al portapapeles y muestre un aviso. Agrega también un botón para compartir
directamente en WhatsApp con un texto como "Ayúdanos a encontrar a Rocky: <enlace>".
```

## 5. Rendimiento: división de código
```text
El build del frontend genera un archivo JavaScript de más de 500 kB. Aplica carga diferida (React.lazy y Suspense)
a las páginas Admin, MiRefugio, Refugios, Coincidencias y Perfil, y a Leaflet en el componente Mapa. Compara el
tamaño del build antes y después y explícame la mejora en relación con RNF-03.
```

## 6. Preparar el despliegue
```text
Prepara el proyecto para desplegar el backend en Render (render.yaml ya existe), la base en Neon y el frontend en
Vercel. Revisa que CORS, FRONTEND_URL y VITE_API_URL estén bien usados, y escribe en el README una guía paso a
paso con las variables de entorno de cada servicio. No incluyas contraseñas reales.
```

## 7. Corregir un bug que encuentren
Cuando prueben el sistema y algo falle, denle a Codex el error exacto:
```text
Al hacer <acción> en <pantalla> pasa <lo que pasa> y debería pasar <lo esperado>. El error de la consola es:
<pegar error>. Encuentra la causa, corrígela y agrega una prueba que evite que vuelva a pasar.
```

---

### Qué mostrar en el video
1. Qué es Codex y dónde se usa (web, CLI, extensión del editor).
2. El archivo AGENTS.md y por qué Codex lo lee antes de trabajar.
3. Una tarea completa: prompt → plan → diff → pruebas en verde → pull request → merge.
4. Un caso en que Codex se equivocó o propuso algo que tuvieron que corregir. Eso demuestra que revisaron.
5. El resultado funcionando en el sistema.
