// ============================================================
//   HOUSELOOP BACKEND — Controlador de propiedades
//   Módulo principal del sistema de bienes raíces
//   Arquitectura: MVC — Capa de Control
//
//   Requiere el paquete "uuid" y src/utils/urls.js
//
//   URLs de archivos: en la base de datos se guarda SOLO la ruta
//   ("/uploads/videos/xxx.mp4"). Al responder, se le antepone la
//   dirección con la que el cliente llamó al servidor.
//
//   BASE DE DATOS: "connection" es un POOL de conexiones.
//   - Consultas simples: connection.query(...) funciona igual.
//   - Transacciones: se pide una conexión con connection.getConnection,
//     se usa para todos los pasos y SIEMPRE se devuelve con release().
//
//   VALIDACIÓN: validarPropiedad() repite en el servidor las mismas
//   reglas de publish.jsx. La app se puede saltar con Postman; el
//   servidor es la protección real.
// ============================================================

const connection = require('../db/connection');
const { v4: uuidv4 } = require('uuid');
const { rutaRelativa, urlPublica } = require('../utils/urls');

// Campos que contienen URLs de archivos subidos por este servidor
const CAMPOS_URL = ['video', 'miniatura', 'foto_perfil_url', 'media_url'];

const ESTADOS_VALIDOS = ['disponible', 'en_negociacion', 'no_disponible'];

// Devuelve una copia de la fila con esos campos completados
// (funciona también con datos viejos que aún tienen la IP guardada)
const conUrls = (req, fila) => {
  const copia = { ...fila };
  CAMPOS_URL.forEach((campo) => {
    if (campo in copia) copia[campo] = urlPublica(req, copia[campo]);
  });
  return copia;
};

// Convierte un valor (latitud / longitud) a número, o null si no es válido
const aNumeroONull = (v) =>
  v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);

// ------------------------------------------------------------
//   VALIDACIÓN DE PROPIEDADES (mismas reglas que publish.jsx)
// ------------------------------------------------------------
const RE_DIRECCION = /^[\p{L}\p{N} #.,-]+$/u; // letras, números, espacio y # . , -
const RE_BARRIO = /^[\p{L}\p{N} .-]+$/u; // letras, números, espacio, . y -
const RE_DESCRIPCION_PROHIBIDA = /[<>{}[\]\\|^~`]/; // < > { } [ ] \ | ^ ~ `

const esTexto = (v) => typeof v === 'string';
const estaVacio = (v) => v === undefined || v === null || v === '';
// Acepta texto o número y lo devuelve como texto sin espacios; otro tipo (objeto, arreglo) → null
const comoTexto = (v) =>
  typeof v === 'string' || typeof v === 'number' ? String(v).trim() : null;

const MAX_FOTOS = 20; // provisional: súbelo si la app permite más

/**
 * Revisa el cuerpo de la petición de crear/editar una propiedad.
 * Devuelve { error: 'mensaje' } si algo no cumple, o { datos } con los
 * valores ya limpios (sin espacios sobrantes y con el tipo correcto).
 */
const validarPropiedad = (body) => {
  const {
    ciudad, direccion, barrio, latitud, longitud, titulo, descripcion,
    precio, area_m2, habitaciones, banos, tipo_operacion, tipo_inmueble,
    estado, video, miniatura, fotos,
  } = body || {};

  // --- Textos obligatorios: deben ser texto (no objetos) ---
  if (!esTexto(titulo) || !esTexto(ciudad) || !esTexto(direccion) || !esTexto(descripcion) || !esTexto(tipo_operacion)) {
    return { error: 'Faltan campos obligatorios (ciudad, direccion, titulo, precio, descripcion o tipo_operacion).' };
  }
  const tituloL = titulo.trim();
  const ciudadL = ciudad.trim();
  const direccionL = direccion.trim();
  const descripcionL = descripcion.trim();
  const operacionL = tipo_operacion.trim();

  if (!tituloL || !ciudadL || !direccionL || !descripcionL || !operacionL || estaVacio(precio)) {
    return { error: 'Faltan campos obligatorios (ciudad, direccion, titulo, precio, descripcion o tipo_operacion).' };
  }

  if (tituloL.length > 250) return { error: 'El título es demasiado largo (máximo 250 caracteres).' };
  if (ciudadL.length > 250) return { error: 'La ciudad es demasiado larga (máximo 250 caracteres).' };
  if (operacionL.length > 250) return { error: 'El tipo de operación no es válido.' };

  // --- Dirección: 5 a 60 ---
  if (direccionL.length < 5 || direccionL.length > 60) {
    return { error: 'La dirección debe tener entre 5 y 60 caracteres.' };
  }
  if (!RE_DIRECCION.test(direccionL)) {
    return { error: 'La dirección solo puede tener letras, números, espacios y los símbolos # . , -' };
  }

  // --- Barrio (opcional): 3 a 40 ---
  let barrioL = null;
  if (!estaVacio(barrio)) {
    if (!esTexto(barrio)) return { error: 'El barrio no es válido.' };
    barrioL = barrio.trim();
    if (barrioL.length < 3 || barrioL.length > 40) {
      return { error: 'El barrio debe tener entre 3 y 40 caracteres.' };
    }
    if (!RE_BARRIO.test(barrioL)) {
      return { error: 'El barrio solo puede tener letras, números, espacios, punto y guion.' };
    }
  }

  // --- Descripción: hasta 720, sin símbolos peligrosos ---
  if (descripcionL.length > 720) {
    return { error: 'La descripción puede tener máximo 720 caracteres.' };
  }
  if (RE_DESCRIPCION_PROHIBIDA.test(descripcionL)) {
    return { error: 'La descripción tiene símbolos no permitidos.' };
  }

  // --- Precio: solo dígitos, mayor que 0, hasta 12 dígitos ---
  const precioT = comoTexto(precio);
  if (precioT === null || !/^\d{1,12}$/.test(precioT) || Number(precioT) <= 0) {
    return { error: 'El precio debe ser un número entero mayor que 0, de hasta 12 dígitos.' };
  }

  // --- Área (opcional): hasta 7 dígitos y 2 decimales, mayor que 0 ---
  let areaT = null;
  if (!estaVacio(area_m2)) {
    areaT = comoTexto(area_m2);
    if (areaT === null || !/^\d{1,7}(\.\d{1,2})?$/.test(areaT) || Number(areaT) <= 0) {
      return { error: 'El área debe ser mayor que 0, con hasta 7 dígitos y 2 decimales.' };
    }
  }

  // --- Habitaciones y baños: enteros de 0 a 20 (si no llegan, 0) ---
  const aEntero0a20 = (valor) => {
    if (estaVacio(valor)) return 0;
    const t = comoTexto(valor);
    if (t === null || !/^\d{1,2}$/.test(t)) return null;
    const n = Number(t);
    return n >= 0 && n <= 20 ? n : null;
  };
  const habitacionesN = aEntero0a20(habitaciones);
  if (habitacionesN === null) return { error: 'Las habitaciones deben ser un número entero de 0 a 20.' };
  const banosN = aEntero0a20(banos);
  if (banosN === null) return { error: 'Los baños deben ser un número entero de 0 a 20.' };

  // --- tipo_inmueble (opcional) ---
  let inmuebleL = null;
  if (!estaVacio(tipo_inmueble)) {
    if (!esTexto(tipo_inmueble) || tipo_inmueble.trim().length > 250) {
      return { error: 'El tipo de inmueble no es válido.' };
    }
    inmuebleL = tipo_inmueble.trim();
  }

  // --- Estado (opcional al crear): solo los tres válidos ---
  let estadoL = 'disponible';
  if (!estaVacio(estado)) {
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return { error: `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}` };
    }
    estadoL = estado;
  }

  // --- Latitud / longitud (opcionales) ---
  let lat = null;
  if (!estaVacio(latitud)) {
    lat = aNumeroONull(latitud);
    if (lat === null || lat < -90 || lat > 90) return { error: 'La latitud no es válida.' };
  }
  let lng = null;
  if (!estaVacio(longitud)) {
    lng = aNumeroONull(longitud);
    if (lng === null || lng < -180 || lng > 180) return { error: 'La longitud no es válida.' };
  }

  // --- Video y miniatura (opcionales): texto; se guarda solo la ruta ---
  let videoRuta = null;
  if (!estaVacio(video)) {
    if (!esTexto(video)) return { error: 'El video no es válido.' };
    videoRuta = rutaRelativa(video) || null;
    if (videoRuta && videoRuta.length > 500) return { error: 'La dirección del video es demasiado larga.' };
  }
  let miniaturaRuta = null;
  if (!estaVacio(miniatura)) {
    if (!esTexto(miniatura)) return { error: 'La miniatura no es válida.' };
    miniaturaRuta = rutaRelativa(miniatura) || null;
    if (miniaturaRuta && miniaturaRuta.length > 500) return { error: 'La dirección de la miniatura es demasiado larga.' };
  }

  // --- Fotos (opcional): arreglo de textos. undefined = "no tocar" al editar ---
  let fotosRutas = null;
  if (fotos !== undefined && fotos !== null) {
    if (!Array.isArray(fotos)) return { error: 'Las fotos deben enviarse como una lista.' };
    if (fotos.length > MAX_FOTOS) return { error: `Máximo ${MAX_FOTOS} fotos por propiedad.` };
    fotosRutas = [];
    for (const url of fotos) {
      const ruta = esTexto(url) ? rutaRelativa(url) : null;
      if (!ruta || ruta.length > 250) return { error: 'Una de las fotos no es válida.' };
      fotosRutas.push(ruta);
    }
  }

  return {
    datos: {
      ciudad: ciudadL,
      direccion: direccionL,
      barrio: barrioL,
      latitud: lat,
      longitud: lng,
      titulo: tituloL,
      descripcion: descripcionL,
      precio: precioT,
      area_m2: areaT,
      habitaciones: habitacionesN,
      banos: banosN,
      tipo_operacion: operacionL,
      tipo_inmueble: inmuebleL,
      estado: estadoL,
      video: videoRuta,
      miniatura: miniaturaRuta,
      fotos: fotosRutas, // null = no se envió
    },
  };
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
 * Ruta: /propiedades   (protegida con verificarToken)
 * Recibe (desde publish.jsx): ciudad, direccion, barrio, latitud, longitud,
 *   titulo, descripcion, precio, area_m2, habitaciones, banos,
 *   tipo_operacion, tipo_inmueble, estado, video, miniatura, fotos
 *
 * El dueño (id_usuario) NO viene del cuerpo de la petición: se toma
 * del token (req.usuario.id), para que nadie pueda publicar a nombre
 * de otro usuario.
 *
 * video, miniatura y fotos pueden llegar como URL completa (la que
 * devuelve /upload); aquí se les quita el host y se guarda solo la ruta.
 *
 * NOTA: id_propiedad e id_ubicacion son varchar (no autoincrementales),
 * así que se generan aquí con uuid antes de insertar.
 */
const guardarPropiedad = (req, res) => {
  // Se revisan todos los datos ANTES de tocar la base
  const { error: errorValidacion, datos } = validarPropiedad(req.body);
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  // El dueño es el usuario del token, ya verificado por verificarToken
  const id_usuario = req.usuario.id;

  const id_ubicacion = uuidv4();
  const id_propiedad = uuidv4();

  // Pedimos UNA conexión del pool para toda la transacción
  connection.getConnection((errConn, conn) => {
    if (errConn) {
      return res.status(500).json({ error: 'Error obteniendo conexión a la base de datos', detalle: errConn.message });
    }

    // Deshace todo, devuelve la conexión al pool y responde el error
    const fallar = (mensaje, err) =>
      conn.rollback(() => {
        conn.release();
        res.status(500).json({ error: mensaje, detalle: err.message });
      });

    // Confirma la transacción, devuelve la conexión al pool y responde OK
    const terminar = (mensaje) =>
      conn.commit((errCommit) => {
        if (errCommit) return fallar('Error confirmando la transacción', errCommit);
        conn.release();
        res.status(201).json({ mensaje, id_propiedad, id_ubicacion });
      });

    conn.beginTransaction((errTx) => {
      if (errTx) {
        conn.release();
        return res.status(500).json({ error: 'Error iniciando la transacción', detalle: errTx.message });
      }

      // 1. Crear la ubicación
      const queryUbicacion = `
        INSERT INTO ubicacion (id_ubicacion, ciudad, barrio, direccion, latitud, longitud, geohash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const valoresUbicacion = [id_ubicacion, datos.ciudad, datos.barrio, datos.direccion, datos.latitud, datos.longitud, null];

      conn.query(queryUbicacion, valoresUbicacion, (errUbicacion) => {
        if (errUbicacion) return fallar('Error guardando la ubicación', errUbicacion);

        // 2. Crear la propiedad
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
          datos.titulo,
          datos.descripcion,
          datos.precio,
          datos.area_m2,
          datos.habitaciones,
          datos.banos,
          datos.tipo_operacion,
          datos.tipo_inmueble,
          datos.estado,
          id_usuario,
          id_ubicacion,
          datos.video,
          datos.miniatura,
        ];

        conn.query(queryPropiedad, valoresPropiedad, (errPropiedad) => {
          if (errPropiedad) return fallar('Error guardando la propiedad', errPropiedad);

          // 3. Insertar las fotos como filas en la tabla media
          //    (el video ya quedó guardado directo en propiedad.video)
          const archivosMedia = (datos.fotos || []).map((ruta) => [uuidv4(), id_propiedad, ruta, 'foto']);

          if (archivosMedia.length === 0) {
            return terminar('✅ Propiedad guardada correctamente (sin fotos)');
          }

          const queryMedia = 'INSERT INTO media (id_media, id_propiedad, url, tipo_media) VALUES ?';

          conn.query(queryMedia, [archivosMedia], (errMedia) => {
            if (errMedia) return fallar('Error guardando fotos', errMedia);
            terminar('✅ Propiedad guardada correctamente');
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
 *
 * - video / miniatura: si llegan, se guardan; se les quita el host.
 * - fotos: si llega un arreglo, REEMPLAZA las fotos actuales.
 * - latitud / longitud: si llegan, actualizan el punto; si no, se conserva el anterior.
 */
const actualizarPropiedad = (req, res) => {
  const { id } = req.params;

  // Se revisan todos los datos ANTES de tocar la base
  const { error: errorValidacion, datos } = validarPropiedad(req.body);
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

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
      const miniaturaFinal = datos.miniatura || filas[0].miniatura;

      // Pedimos UNA conexión del pool para toda la transacción
      connection.getConnection((errConn, conn) => {
        if (errConn) {
          return res.status(500).json({ error: 'Error obteniendo conexión a la base de datos', detalle: errConn.message });
        }

        // Deshace todo, devuelve la conexión al pool y responde el error
        const fallar = (mensaje, err) =>
          conn.rollback(() => {
            conn.release();
            res.status(500).json({ error: mensaje, detalle: err.message });
          });

        // Confirma la transacción, devuelve la conexión al pool y responde OK
        const terminar = () =>
          conn.commit((errCommit) => {
            if (errCommit) return fallar('Error confirmando la transacción', errCommit);
            conn.release();
            res.json({ mensaje: '✅ Propiedad actualizada correctamente', id_propiedad: id });
          });

        conn.beginTransaction((errTx) => {
          if (errTx) {
            conn.release();
            return res.status(500).json({ error: 'Error iniciando la transacción', detalle: errTx.message });
          }

          // 2. Actualizar la ubicación
          conn.query(
            'UPDATE ubicacion SET ciudad = ?, barrio = ?, direccion = ?, latitud = COALESCE(?, latitud), longitud = COALESCE(?, longitud) WHERE id_ubicacion = ?',
            [datos.ciudad, datos.barrio, datos.direccion, datos.latitud, datos.longitud, id_ubicacion],
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
                datos.titulo,
                datos.descripcion,
                datos.precio,
                datos.area_m2,
                datos.habitaciones,
                datos.banos,
                datos.tipo_operacion,
                datos.tipo_inmueble,
                datos.video,
                miniaturaFinal,
                id,
              ];

              conn.query(queryPropiedad, valores, (errProp) => {
                if (errProp) return fallar('Error actualizando la propiedad', errProp);

                // Si no llegó el arreglo de fotos, no se tocan las existentes
                if (datos.fotos === null) return terminar();

                // 4. Reemplazar las fotos: borrar las actuales e insertar las nuevas
                conn.query(
                  "DELETE FROM media WHERE id_propiedad = ? AND tipo_media = 'foto'",
                  [id],
                  (errDel) => {
                    if (errDel) return fallar('Error actualizando las fotos', errDel);

                    if (datos.fotos.length === 0) return terminar();

                    const filasMedia = datos.fotos.map((ruta) => [uuidv4(), id, ruta, 'foto']);
                    conn.query(
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
      });
    }
  );
};

/**
 * eliminarPropiedad
 * Elimina un registro de propiedad de la base de datos.
 * Método HTTP: DELETE
 * Ruta: /propiedades/:id   (protegida con verificarToken)
 * Solo puede eliminarla el dueño (se compara con req.usuario.id del JWT).
 *
 * Después de borrarla, se borra su ubicación si ninguna otra propiedad
 * la usa (antes lo hacía un trigger de la base; ahora se hace aquí).
 */
const eliminarPropiedad = (req, res) => {
  const { id } = req.params;

  // 1. La propiedad debe existir y ser del usuario del token
  connection.query(
    'SELECT id_usuario, id_ubicacion FROM propiedad WHERE id_propiedad = ?',
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
        res.status(403).json({ error: 'Solo el dueño puede eliminar esta propiedad' });
        return;
      }

      const { id_ubicacion } = filas[0];

      // 2. Es el dueño: eliminamos la propiedad
      connection.query('DELETE FROM propiedad WHERE id_propiedad = ?', [id], (error) => {
        if (error) {
          res.status(500).json({ error: 'Error eliminando propiedad', detalle: error.message });
          return;
        }

        // 3. Limpieza: borrar la ubicación si ya nadie la usa.
        //    Si esta limpieza falla, la propiedad ya está borrada: se responde OK igual.
        connection.query(
          'DELETE FROM ubicacion WHERE id_ubicacion = ? AND NOT EXISTS (SELECT 1 FROM propiedad WHERE id_ubicacion = ?)',
          [id_ubicacion, id_ubicacion],
          (errUbi) => {
            if (errUbi) console.error('No se pudo limpiar la ubicación:', errUbi.message);
            res.json({ mensaje: '✅ Propiedad eliminada correctamente' });
          }
        );
      });
    }
  );
};

/**
 * obtenerFeed
 * Propiedades visibles en el feed principal: "disponible" o
 * "en_negociacion". Las "no_disponible" no aparecen en el feed.
 * Método HTTP: GET
 * Ruta: /propiedades/feed
 * Incluye latitude / longitude (el punto exacto guardado) para el mapa.
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
      ub.latitud AS latitude,
      ub.longitud AS longitude,
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
 * Propiedades de un usuario específico.
 * Método HTTP: GET
 * Ruta: /propiedades/usuario/:id
 * Uso: Módulo Profile — grid de publicaciones del usuario.
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
 * Todos los datos de una propiedad para la pantalla de detalle:
 * propiedad, ubicación, propietario (con su correo) y fotos.
 * Método HTTP: GET
 * Ruta: /propiedades/:id
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
 * Cambia el estado: "disponible", "en_negociacion" o "no_disponible".
 * Solo puede hacerlo el usuario que la publicó.
 * Método HTTP: PUT
 * Ruta: /propiedades/:id/estado   (protegida con verificarToken)
 */
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