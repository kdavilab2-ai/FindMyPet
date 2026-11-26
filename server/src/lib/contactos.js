// RNF-05: aplica la preferencia de visibilidad del autor al leer canales de una publicación.
function contactosPublicacion(consultar, id, esAutor = false) {
  return consultar(`SELECT tc.nombre AS tipo, cp.valor FROM contacto_publicacion cp
    JOIN tipo_contacto tc ON tc.id_tipo_contacto = cp.id_tipo_contacto
    JOIN publicacion p ON p.id_publicacion = cp.id_publicacion
    WHERE cp.id_publicacion = $1 AND ($2::boolean OR p.id_tipo_contacto_visible IS NULL OR p.id_tipo_contacto_visible = cp.id_tipo_contacto)
    ORDER BY cp.id_tipo_contacto`, [id, esAutor]);
}

module.exports = { contactosPublicacion };
