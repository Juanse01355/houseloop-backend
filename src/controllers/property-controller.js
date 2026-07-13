// ============================================================
//   HOUSELOOP BACKEND — Controlador de propiedades
//   Módulo principal del sistema de bienes raíces
//   Métodos con verbo siguiendo estándares de codificación
//   Arquitectura: MVC — Capa de Control
// ============================================================

const connection = require('../db/connection');

/**
 * obtenerPropiedades
 * Consulta y retorna todas las propiedades registradas en la base de datos.
 * Método HTTP: GET
 * Ruta: /propiedades
 * Respuesta: Array JSON con todos los registros de la tabla propiedad.
 * Uso: Listado general de propiedades para administración del sistema.
 */
const obtenerPropiedades = (req, res) => {
  connection.query('SELECT * FROM propiedad', (error, results) => {
    if (error) {
      res.status(500).json({ error: 'Error consultando propiedades' });
      return;
    }
    res.json(results);
  });
};

/**
 * guardarPropiedad
 * Inserta un nuevo registro de propiedad en la base de datos.
 * Método HTTP: POST
 * Ruta: /propiedades
 * Recibe: titulo, descripcion, precio, area_m2, habitaciones, banos,
 *         tipo_operacion, tipo_inmueble, estado, id_usuario,
 *         id_ubicacion, video, fotos — desde el cuerpo de la petición.
 * Respuesta: Mensaje de confirmación con el ID del nuevo registro.
 * Uso: Módulo Publish — el propietario publica una nueva propiedad.
 */
const guardarPropiedad = (req, res) => {
  const {
    titulo, descripcion, precio, area_m2,
    habitaciones, banos, tipo_operacion,
    tipo_inmueble, estado, id_usuario,
    id_ubicacion, video, fotos
  } = req.body;

  const query = `
    INSERT INTO propiedad (
      titulo, descripcion, precio, area_m2,
      habitaciones, banos, tipo_operacion,
      tipo_inmueble, estado, id_usuario,
      id_ubicacion, video, fotos
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const valores = [
    titulo, descripcion, precio, area_m2,
    habitaciones, banos, tipo_operacion,
    tipo_inmueble, estado, id_usuario,
    id_ubicacion, video, fotos
  ];

  connection.query(query, valores, (error, results) => {
    if (error) {
      res.status(500).json({ error: 'Error guardando propiedad', detalle: error.message });
      return;
    }
    res.json({ mensaje: '✅ Propiedad guardada correctamente', id: results.insertId });
  });
};

/**
 * actualizarPropiedad
 * Modifica un registro existente de propiedad en la base de datos.
 * Método HTTP: PUT
 * Ruta: /propiedades/:id
 * Recibe: id — desde los parámetros de la URL.
 *         titulo, precio, estado — desde el cuerpo de la petición.
 * Respuesta: Mensaje de confirmación de la actualización.
 * Uso: Edición de propiedades publicadas por el propietario.
 */
const actualizarPropiedad = (req, res) => {
  const { id } = req.params;
  const { titulo, precio, estado } = req.body;

  const query = `
    UPDATE propiedad 
    SET titulo = ?, precio = ?, estado = ?
    WHERE id_propiedad = ?
  `;

  connection.query(query, [titulo, precio, estado, id], (error, results) => {
    if (error) {
      res.status(500).json({ error: 'Error actualizando propiedad', detalle: error.message });
      return;
    }
    res.json({ mensaje: '✅ Propiedad actualizada correctamente' });
  });
};

/**
 * eliminarPropiedad
 * Elimina un registro de propiedad de la base de datos.
 * Método HTTP: DELETE
 * Ruta: /propiedades/:id
 * Recibe: id — desde los parámetros de la URL.
 * Respuesta: Mensaje de confirmación de la eliminación.
 * Uso: Baja de propiedades que ya no están disponibles.
 */
const eliminarPropiedad = (req, res) => {
  const { id } = req.params;

  const query = `DELETE FROM propiedad WHERE id_propiedad = ?`;

  connection.query(query, [id], (error, results) => {
    if (error) {
      res.status(500).json({ error: 'Error eliminando propiedad', detalle: error.message });
      return;
    }
    res.json({ mensaje: '✅ Propiedad eliminada correctamente' });
  });
};

/**
 * obtenerFeed
 * Consulta las propiedades disponibles para mostrar en el feed principal.
 * Realiza un JOIN entre las tablas propiedad, usuario, ubicacion y media
 * para obtener todos los datos necesarios para cada tarjeta del feed.
 * Método HTTP: GET
 * Ruta: /propiedades/feed
 * Respuesta: Array JSON con propiedades activas ordenadas por fecha de publicación.
 * Uso: Módulo Feed — pantalla principal de HouseLoop estilo TikTok.
 */
const obtenerFeed = (req, res) => {
  const query = `
    SELECT 
      p.id_propiedad,
      p.titulo,
      p.precio,
      p.tipo_operacion,
      p.tipo_inmueble,
      p.area_m2,
      p.habitaciones,
      p.banos,
      p.descripcion,
      u.nombre AS propietario,
      u.foto_perfil_url,
      ub.ciudad,
      ub.barrio,
      ub.direccion,
      m.url AS media_url,
      m.tipo_media
    FROM propiedad p
    JOIN usuario u ON p.id_usuario = u.id_usuario
    JOIN ubicacion ub ON p.id_ubicacion = ub.id_ubicacion
    JOIN media m ON m.id_propiedad = p.id_propiedad
    WHERE p.estado = 'disponible'
    ORDER BY p.fecha_publicacion DESC
  `;

  connection.query(query, (error, results) => {
    if (error) {
      res.status(500).json({ error: 'Error consultando el feed', detalle: error.message });
      return;
    }
    res.json(results);
  });
};

module.exports = {
  obtenerPropiedades,
  guardarPropiedad,
  actualizarPropiedad,
  eliminarPropiedad,
  obtenerFeed,
};