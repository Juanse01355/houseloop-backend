// ============================================================
//   HOUSELOOP BACKEND — Controlador de propiedades
//   Módulo principal del sistema de bienes raíces
//   Arquitectura: MVC — Capa de Control
//
//   IMPORTANTE: este archivo reemplaza por completo tu
//   property-controller.js actual.
//
//   Requiere el paquete "uuid". Si no lo tienes instalado:
//     npm install uuid
// ============================================================

const connection = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

/**
 * obtenerPropiedades
 * Consulta y retorna todas las propiedades registradas en la base de datos.
 * Método HTTP: GET
 * Ruta: /propiedades
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
 * Crea la ubicación, la propiedad y los registros de media (fotos)
 * en una sola transacción.
 * Método HTTP: POST
 * Ruta: /propiedades
 * Recibe (desde publish.jsx): ciudad, direccion, barrio, titulo,
 *   descripcion, precio, area_m2, habitaciones, banos, tipo_operacion,
 *   tipo_inmueble, estado, id_usuario, video, fotos
 *
 * NOTA: tanto id_propiedad como id_ubicacion son varchar en la base
 * de datos (no autoincrementales), así que este controlador genera
 * ambos identificadores manualmente con uuid antes de insertar.
 */
const guardarPropiedad = (req, res) => {
  const {
    ciudad,
    direccion,
    barrio,
    titulo,
    descripcion,
    precio,
    area_m2,
    habitaciones,
    banos,
    tipo_operacion,
    tipo_inmueble,
    estado,
    id_usuario,
    video,
    fotos,
  } = req.body;

  // Validación mínima de campos obligatorios
  if (!ciudad || !direccion || !titulo || !precio || !id_usuario) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (ciudad, direccion, titulo, precio o id_usuario).' });
  }

  connection.beginTransaction((errTx) => {
    if (errTx) {
      return res.status(500).json({ error: 'Error iniciando la transacción', detalle: errTx.message });
    }

    // 1. Crear la ubicación
    const id_ubicacion = uuidv4();
    const queryUbicacion = `
      INSERT INTO ubicacion (id_ubicacion, ciudad, barrio, direccion, latitud, longitud, geohash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const valoresUbicacion = [id_ubicacion, ciudad, barrio || null, direccion, null, null, null];

    connection.query(queryUbicacion, valoresUbicacion, (errUbicacion) => {
      if (errUbicacion) {
        return connection.rollback(() => {
          res.status(500).json({ error: 'Error guardando la ubicación', detalle: errUbicacion.message });
        });
      }

      // 2. Crear la propiedad (id_propiedad es varchar, se genera aquí)
      const id_propiedad = uuidv4();
      const queryPropiedad = `
        INSERT INTO propiedad (
          id_propiedad, titulo, descripcion, precio, area_m2,
          habitaciones, banos, tipo_operacion,
          tipo_inmueble, estado, id_usuario,
          id_ubicacion, video, fecha_publicacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      const valoresPropiedad = [
        id_propiedad,
        titulo,
        descripcion || null,
        precio,
        area_m2 || null,
        habitaciones || 0,
        banos || 0,
        tipo_operacion,
        tipo_inmueble,
        estado || 'disponible',
        id_usuario,
        id_ubicacion,
        video || null,
      ];

      connection.query(queryPropiedad, valoresPropiedad, (errPropiedad) => {
        if (errPropiedad) {
          return connection.rollback(() => {
            res.status(500).json({ error: 'Error guardando la propiedad', detalle: errPropiedad.message });
          });
        }

        // 3. Insertar las fotos como filas en la tabla media
        //    (el video ya quedó guardado directo en propiedad.video)
        const archivosMedia = [];
        if (Array.isArray(fotos)) {
          fotos.forEach((url) => archivosMedia.push([id_propiedad, url, 'foto']));
        }

        if (archivosMedia.length === 0) {
          return connection.commit((errCommit) => {
            if (errCommit) {
              return connection.rollback(() => {
                res.status(500).json({ error: 'Error confirmando la transacción', detalle: errCommit.message });
              });
            }
            res.status(201).json({
              mensaje: '✅ Propiedad guardada correctamente (sin fotos)',
              id_propiedad,
              id_ubicacion,
            });
          });
        }

        const queryMedia = 'INSERT INTO media (id_propiedad, url, tipo_media) VALUES ?';

        connection.query(queryMedia, [archivosMedia], (errMedia) => {
          if (errMedia) {
            return connection.rollback(() => {
              res.status(500).json({ error: 'Error guardando fotos', detalle: errMedia.message });
            });
          }

          connection.commit((errCommit) => {
            if (errCommit) {
              return connection.rollback(() => {
                res.status(500).json({ error: 'Error confirmando la transacción', detalle: errCommit.message });
              });
            }
            res.status(201).json({
              mensaje: '✅ Propiedad guardada correctamente',
              id_propiedad,
              id_ubicacion,
            });
          });
        });
      });
    });
  });
};

/**
 * actualizarPropiedad
 * Modifica un registro existente de propiedad en la base de datos.
 * Método HTTP: PUT
 * Ruta: /propiedades/:id
 */
const actualizarPropiedad = (req, res) => {
  const { id } = req.params;
  const { titulo, precio, estado } = req.body;

  const query = `
    UPDATE propiedad 
    SET titulo = ?, precio = ?, estado = ?
    WHERE id_propiedad = ?
  `;

  connection.query(query, [titulo, precio, estado, id], (error) => {
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
 */
const eliminarPropiedad = (req, res) => {
  const { id } = req.params;

  const query = `DELETE FROM propiedad WHERE id_propiedad = ?`;

  connection.query(query, [id], (error) => {
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
 * Método HTTP: GET
 * Ruta: /propiedades/feed
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
      p.video,
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
    LEFT JOIN media m ON m.id_propiedad = p.id_propiedad
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

/**
 * obtenerPropiedadesPorUsuario
 * Consulta y retorna todas las propiedades que pertenecen a un
 * usuario específico.
 * Método HTTP: GET
 * Ruta: /propiedades/usuario/:id
 * Recibe: id — desde los parámetros de la URL (id del usuario dueño
 *         de las propiedades).
 * Respuesta: Array JSON con las propiedades de ese usuario, o un
 *            array vacío si no tiene ninguna.
 * Uso: Módulo Profile — grid de publicaciones del usuario en su
 *      propio perfil.
 */
const obtenerPropiedadesPorUsuario = (req, res) => {
  const { id } = req.params;
  connection.query('SELECT * FROM propiedad WHERE id_usuario = ?', [id], (error, results) => {
    if (error) {
      res.status(500).json({ error: 'Error consultando propiedades' });
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
  obtenerPropiedadesPorUsuario,
};