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
//
//   Requiere también: src/utils/urls.js
//
//   URLs de archivos: en la base de datos se guarda SOLO la ruta
//   ("/uploads/videos/xxx.mp4"). Al responder, se le antepone la
//   dirección con la que el cliente llamó al servidor. Así no
//   importa si cambia la IP, la red o el servidor.
// ============================================================

const connection = require('../db/connection');
const { v4: uuidv4 } = require('uuid');
const { rutaRelativa, urlPublica } = require('../utils/urls');

// Campos que contienen URLs de archivos subidos por este servidor
const CAMPOS_URL = ['video', 'miniatura', 'foto_perfil_url', 'media_url'];

// Devuelve una copia de la fila con esos campos completados
// (funciona también con datos viejos que aún tienen la IP guardada)
const conUrls = (req, fila) => {
  const copia = { ...fila };
  CAMPOS_URL.forEach((campo) => {
    if (campo in copia) copia[campo] = urlPublica(req, copia[campo]);
  });
  return copia;
};

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
    res.json(results.map((fila) => conUrls(req, fila)));
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
 *   tipo_inmueble, estado, id_usuario, video, miniatura, fotos
 *
 * video, miniatura y fotos pueden llegar como URL completa (la que
 * devuelve /upload); aquí se les quita el host y se guarda solo la ruta.
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
    miniatura,
    fotos,
  } = req.body;

  // Validación mínima de campos obligatorios
  if (!ciudad || !direccion || !titulo || !precio || !id_usuario || !descripcion || !tipo_operacion) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (ciudad, direccion, titulo, precio, id_usuario, descripcion o tipo_operacion).' });
  }

  // Se guarda solo la ruta, sin IP
  const videoRuta = rutaRelativa(video) || null;
  const miniaturaRuta = rutaRelativa(miniatura) || null;

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
          id_ubicacion, video, miniatura, fecha_publicacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      const valoresPropiedad = [
        id_propiedad,
        titulo,
        descripcion,
        precio,
        area_m2 || null,
        habitaciones || 0,
        banos || 0,
        tipo_operacion,
        tipo_inmueble,
        estado || 'disponible',
        id_usuario,
        id_ubicacion,
        videoRuta,
        miniaturaRuta,
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
          fotos.forEach((url) =>
            archivosMedia.push([uuidv4(), id_propiedad, rutaRelativa(url), 'foto'])
          );
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

        const queryMedia = 'INSERT INTO media (id_media, id_propiedad, url, tipo_media) VALUES ?';

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
 * Edita una propiedad completa: datos, ubicación, video y fotos.
 * Método HTTP: PUT
 * Ruta: /propiedades/:id   (protegida con verificarToken)
 * Solo puede editarla el dueño (se compara con req.usuario.id del JWT).
 * Recibe (desde publish.jsx en modo edición): ciudad, direccion, barrio,
 *   titulo, descripcion, precio, area_m2, habitaciones, banos,
 *   tipo_operacion, tipo_inmueble, video, miniatura, fotos
 *
 * - video / miniatura: si llegan, se guardan; se les quita el host.
 * - fotos: si llega un arreglo, REEMPLAZA las fotos actuales de la propiedad.
 */
const actualizarPropiedad = (req, res) => {
  const { id } = req.params;
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
    video,
    miniatura,
    fotos,
  } = req.body;

  if (!ciudad || !direccion || !titulo || !precio || !descripcion || !tipo_operacion) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  const videoRuta = rutaRelativa(video) || null;
  const miniaturaRuta = rutaRelativa(miniatura) || null;

  // 1. La propiedad debe existir y ser del usuario del token
  connection.query(
    'SELECT id_usuario, id_ubicacion, miniatura FROM propiedad WHERE id_propiedad = ?',
    [id],
    (errBusqueda, filas) => {
      if (errBusqueda) {
        return res.status(500).json({ error: 'Error consultando la propiedad', detalle: errBusqueda.message });
      }
      if (filas.length === 0) {
        return res.status(404).json({ error: 'Propiedad no encontrada' });
      }
      if (String(filas[0].id_usuario) !== String(req.usuario.id)) {
        return res.status(403).json({ error: 'Solo el dueño puede editar esta propiedad' });
      }

      const { id_ubicacion } = filas[0];
      // Si no llegó miniatura nueva, se conserva la que ya tenía
      const miniaturaFinal = miniaturaRuta || filas[0].miniatura;

      const fallar = (mensaje, err) =>
        connection.rollback(() => {
          res.status(500).json({ error: mensaje, detalle: err.message });
        });

      connection.beginTransaction((errTx) => {
        if (errTx) {
          return res.status(500).json({ error: 'Error iniciando la transacción', detalle: errTx.message });
        }

        // 2. Actualizar la ubicación
        connection.query(
          'UPDATE ubicacion SET ciudad = ?, barrio = ?, direccion = ? WHERE id_ubicacion = ?',
          [ciudad, barrio || null, direccion, id_ubicacion],
          (errUbi) => {
            if (errUbi) return fallar('Error actualizando la ubicación', errUbi);

            // 3. Actualizar la propiedad
            const queryPropiedad = `
              UPDATE propiedad
              SET titulo = ?, descripcion = ?, precio = ?, area_m2 = ?,
                  habitaciones = ?, banos = ?, tipo_operacion = ?,
                  tipo_inmueble = ?, video = ?, miniatura = ?
              WHERE id_propiedad = ?
            `;
            const valores = [
              titulo,
              descripcion,
              precio,
              area_m2 || null,
              habitaciones || 0,
              banos || 0,
              tipo_operacion,
              tipo_inmueble,
              videoRuta,
              miniaturaFinal,
              id,
            ];

            connection.query(queryPropiedad, valores, (errProp) => {
              if (errProp) return fallar('Error actualizando la propiedad', errProp);

              const terminar = () =>
                connection.commit((errCommit) => {
                  if (errCommit) return fallar('Error confirmando la transacción', errCommit);
                  res.json({ mensaje: '✅ Propiedad actualizada correctamente', id_propiedad: id });
                });

              // Si no llegó el arreglo de fotos, no se tocan las existentes
              if (!Array.isArray(fotos)) return terminar();

              // 4. Reemplazar las fotos: borrar las actuales e insertar las nuevas
              connection.query(
                "DELETE FROM media WHERE id_propiedad = ? AND tipo_media = 'foto'",
                [id],
                (errDel) => {
                  if (errDel) return fallar('Error actualizando las fotos', errDel);

                  if (fotos.length === 0) return terminar();

                  const filasMedia = fotos.map((url) => [uuidv4(), id, rutaRelativa(url), 'foto']);
                  connection.query(
                    'INSERT INTO media (id_media, id_propiedad, url, tipo_media) VALUES ?',
                    [filasMedia],
                    (errIns) => {
                      if (errIns) return fallar('Error guardando las fotos', errIns);
                      terminar();
                    }
                  );
                }
              );
            });
          }
        );
      });
    }
  );
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
 * Consulta las propiedades visibles para mostrar en el feed principal:
 * las que están "disponible" o "en_negociacion". Las "no_disponible"
 * no aparecen en el feed (el dueño las sigue viendo en su perfil).
 * Método HTTP: GET
 * Ruta: /propiedades/feed
 */
const obtenerFeed = (req, res) => {
  const query = `
    SELECT 
      p.id_propiedad,
      p.id_usuario,
      p.titulo,
      p.precio,
      p.tipo_operacion,
      p.tipo_inmueble,
      p.area_m2,
      p.habitaciones,
      p.banos,
      p.descripcion,
      p.video,
      p.estado,
      u.nombre AS propietario,
      u.foto_perfil_url,
      ub.ciudad,
      ub.barrio,
      ub.direccion,
      (
        SELECT m.url
        FROM media m
        WHERE m.id_propiedad = p.id_propiedad
        LIMIT 1
      ) AS media_url
    FROM propiedad p
    JOIN usuario u ON p.id_usuario = u.id_usuario
    JOIN ubicacion ub ON p.id_ubicacion = ub.id_ubicacion
    WHERE p.estado IN ('disponible', 'en_negociacion')
    ORDER BY p.fecha_publicacion DESC
  `;

  connection.query(query, (error, results) => {
    if (error) {
      res.status(500).json({ error: 'Error consultando el feed', detalle: error.message });
      return;
    }
    res.json(results.map((fila) => conUrls(req, fila)));
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

  const query = `
    SELECT
      p.*,
      (
        SELECT m.url
        FROM media m
        WHERE m.id_propiedad = p.id_propiedad
        LIMIT 1
      ) AS media_url
    FROM propiedad p
    WHERE p.id_usuario = ?
    ORDER BY p.fecha_publicacion DESC
  `;

  connection.query(query, [id], (error, results) => {
    if (error) {
      res.status(500).json({ error: 'Error consultando propiedades del usuario', detalle: error.message });
      return;
    }
    res.json(results.map((fila) => conUrls(req, fila)));
  });
};

/**
 * registrarReproduccion
 * Suma 1 al contador de reproducciones de una propiedad (video).
 * Método HTTP: POST
 * Ruta: /propiedades/:id/reproduccion
 * Recibe: id — desde los parámetros de la URL (id_propiedad).
 * Respuesta: { ok: true } o 404 si la propiedad no existe.
 * Uso: Feed — se llama cuando un video lleva unos segundos visible.
 */
const registrarReproduccion = (req, res) => {
  const { id } = req.params;

  const query = `
    UPDATE propiedad
    SET reproducciones = reproducciones + 1
    WHERE id_propiedad = ?
  `;

  connection.query(query, [id], (error, result) => {
    if (error) {
      res.status(500).json({ error: 'Error registrando la reproducción', detalle: error.message });
      return;
    }
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Propiedad no encontrada' });
      return;
    }
    res.json({ ok: true });
  });
};

/**
 * obtenerPropiedadPorId
 * Retorna TODOS los datos de una propiedad para la pantalla de detalle:
 * datos de la propiedad, ubicación, información del propietario
 * (incluido su correo, que se usa para contactarlo) y el arreglo
 * de URLs de sus fotos.
 * Método HTTP: GET
 * Ruta: /propiedades/:id
 * Recibe: id — desde los parámetros de la URL (id_propiedad).
 * Respuesta: objeto JSON con la propiedad, o 404 si no existe.
 * Uso: Módulo Detail — pantalla de detalle de una propiedad.
 *
 * IMPORTANTE: en property-routes.js esta ruta debe ir DESPUÉS de
 * /feed y /usuario/:id, o Express confundirá esas palabras con un id.
 */
const obtenerPropiedadPorId = (req, res) => {
  const { id } = req.params;

  const queryPropiedad = `
    SELECT
      p.id_propiedad,
      p.id_usuario,
      p.titulo,
      p.precio,
      p.tipo_operacion,
      p.tipo_inmueble,
      p.area_m2,
      p.habitaciones,
      p.banos,
      p.descripcion,
      p.video,
      p.miniatura,
      p.reproducciones,
      p.estado,
      p.fecha_publicacion,
      u.nombre AS propietario,
      u.correo AS correo_propietario,
      u.foto_perfil_url,
      ub.ciudad,
      ub.barrio,
      ub.direccion,
      ub.latitud,
      ub.longitud
    FROM propiedad p
    JOIN usuario u ON p.id_usuario = u.id_usuario
    JOIN ubicacion ub ON p.id_ubicacion = ub.id_ubicacion
    WHERE p.id_propiedad = ?
  `;

  connection.query(queryPropiedad, [id], (error, results) => {
    if (error) {
      res.status(500).json({ error: 'Error consultando la propiedad', detalle: error.message });
      return;
    }

    if (results.length === 0) {
      res.status(404).json({ error: 'Propiedad no encontrada' });
      return;
    }

    const propiedad = results[0];

    // Fotos de la propiedad (para la Galería de Fotos)
    const queryFotos = `
      SELECT url FROM media
      WHERE id_propiedad = ? AND tipo_media = 'foto'
    `;

    connection.query(queryFotos, [id], (errFotos, fotos) => {
      if (errFotos) {
        res.status(500).json({ error: 'Error consultando las fotos', detalle: errFotos.message });
        return;
      }

      res.json({
        ...conUrls(req, propiedad),
        fotos: fotos.map((f) => urlPublica(req, f.url)),
      });
    });
  });
};

/**
 * cambiarEstadoPropiedad
 * Cambia el estado de una propiedad: "disponible", "en_negociacion"
 * o "no_disponible". Solo puede hacerlo el usuario que la publicó.
 * Método HTTP: PUT
 * Ruta: /propiedades/:id/estado   (protegida con verificarToken)
 * Recibe: id — desde la URL (id_propiedad)
 *         estado — desde el body (uno de los tres valores válidos)
 *         req.usuario.id — lo deja verificarToken a partir del JWT
 * Respuesta: { ok: true, estado } o un error:
 *   400 estado inválido | 403 no es el dueño | 404 no existe
 * Uso: Módulo Detail — el dueño cambia la disponibilidad de su propiedad.
 */
const ESTADOS_VALIDOS = ['disponible', 'en_negociacion', 'no_disponible'];

const cambiarEstadoPropiedad = (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!ESTADOS_VALIDOS.includes(estado)) {
    res.status(400).json({
      error: `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`,
    });
    return;
  }

  // 1. Comprobamos que la propiedad exista y que sea del usuario del token
  connection.query(
    'SELECT id_usuario FROM propiedad WHERE id_propiedad = ?',
    [id],
    (errBusqueda, filas) => {
      if (errBusqueda) {
        res.status(500).json({ error: 'Error consultando la propiedad', detalle: errBusqueda.message });
        return;
      }

      if (filas.length === 0) {
        res.status(404).json({ error: 'Propiedad no encontrada' });
        return;
      }

      if (String(filas[0].id_usuario) !== String(req.usuario.id)) {
        res.status(403).json({ error: 'Solo el dueño puede cambiar el estado de esta propiedad' });
        return;
      }

      // 2. Es el dueño: actualizamos el estado
      connection.query(
        'UPDATE propiedad SET estado = ? WHERE id_propiedad = ?',
        [estado, id],
        (errUpdate) => {
          if (errUpdate) {
            res.status(500).json({ error: 'Error actualizando el estado', detalle: errUpdate.message });
            return;
          }
          res.json({ ok: true, estado });
        }
      );
    }
  );
};

module.exports = {
  obtenerPropiedades,
  guardarPropiedad,
  actualizarPropiedad,
  eliminarPropiedad,
  obtenerFeed,
  obtenerPropiedadesPorUsuario,
  registrarReproduccion,
  obtenerPropiedadPorId,
  cambiarEstadoPropiedad,
};