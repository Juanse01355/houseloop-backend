// Este archivo tiene la lógica real del módulo de perfil.
// La conexión (db) usa el estilo de callbacks de mysql2,
// no async/await — por eso la consulta recibe una función
// como último argumento, que se ejecuta cuando MySQL responde.

const db = require('../db/connection');

// Función para GET /api/perfil
// req.usuario.id viene del middleware (auth-middleware.js),
// que ya verificó el token antes de llegar hasta acá
const obtenerPerfil = (req, res) => {
  const idUsuario = req.usuario.id;

  // db.query recibe: la consulta SQL, los parámetros (reemplazan
  // los "?" en orden), y un callback que se ejecuta al terminar
  db.query(
     `SELECT id_usuario, nombre, correo, foto_perfil_url, fecha_registro
      FROM usuario WHERE id_usuario = ?`,
    [idUsuario],
    (error, results) => {
      // Si algo falló en la consulta (ej: error de conexión,
      // columna que no existe, etc.), entra acá
      if (error) {
        console.error(error);
        return res.status(500).json({ mensaje: 'Error al obtener el perfil' });
      }

      // Si la consulta funcionó pero no encontró ningún usuario
      // con ese id_usuario, results va a ser un array vacío
      if (results.length === 0) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
      }

      // Si todo salió bien, results[0] tiene los datos del usuario
      // (results es un array porque SELECT siempre devuelve filas,
      // pero acá solo esperamos una)
      res.status(200).json(results[0]);
    }
  );
};

// Función para PUT /api/perfil
const actualizarPerfil = (req, res) => {
  const idUsuario = req.usuario.id;
  const { nombre, correo } = req.body;

  // Validación básica: ambos campos son obligatorios
  if (!nombre || !correo) {
    return res.status(400).json({ mensaje: 'Nombre y correo son obligatorios' });
  }

  db.query(
    `UPDATE usuario SET nombre = ?, correo = ?, fecha_actualizacion = NOW()
     WHERE id_usuario = ?`,
    [nombre, correo, idUsuario],
    (error, results) => {
      if (error) {
        console.error(error);

        // Si el correo ya existe en otro usuario, MySQL tira este código
        if (error.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ mensaje: 'Ese correo ya está en uso' });
        }

        return res.status(500).json({ mensaje: 'Error al actualizar el perfil' });
      }

      res.status(200).json({ mensaje: 'Perfil actualizado correctamente', nombre, correo });
    }
  );
};
// Función para POST /api/perfil/foto
// Multer (upload-perfil-middleware.js) ya guardó el archivo en
// disco antes de que esta función se ejecute. Aquí armamos la
// URL pública y la guardamos en la base de datos.
const subirFotoPerfil = (req, res) => {
  const idUsuario = req.usuario.id;

  if (!req.file) {
    return res.status(400).json({ mensaje: 'No se recibió ninguna imagen' });
  }

  const host = `${req.protocol}://${req.get('host')}`;
  const fotoUrl = `${host}/uploads/perfiles/${req.file.filename}`;

  db.query(
    `UPDATE usuario SET foto_perfil_url = ?, fecha_actualizacion = NOW()
     WHERE id_usuario = ?`,
    [fotoUrl, idUsuario],
    (error, results) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ mensaje: 'Error al guardar la foto de perfil' });
      }

      res.status(200).json({ mensaje: 'Foto de perfil actualizada', foto_perfil_url: fotoUrl });
    }
  );
};

module.exports = { obtenerPerfil, actualizarPerfil, subirFotoPerfil };