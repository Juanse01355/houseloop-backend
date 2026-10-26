// Este archivo tiene la lógica real del módulo de perfil.
// La conexión (db) usa el estilo de callbacks de mysql2,
// no async/await — por eso la consulta recibe una función
// como último argumento, que se ejecuta cuando MySQL responde.

const fs = require('fs');
const db = require('../db/connection');
const cloudinary = require('../config/cloudinary');
const { urlPublica } = require('../utils/urls');

// ── Límites y reglas (deben ser iguales a las de signup y editar perfil en la app) ──
const LIMITES = {
  nombre: { min: 2, max: 30 },
  correo: { max: 60 },
};

// Nombre: solo letras (con tildes, ñ y ü) y un solo espacio entre palabras
const LETRAS = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
const NOMBRE_REGEX = new RegExp(`^[${LETRAS}]+( [${LETRAS}]+)*$`);

// Correo: parte antes de la @ (letras y números separados por un solo . _ + o -)
const CORREO_LOCAL_REGEX = /^[A-Za-z0-9]+([._+-][A-Za-z0-9]+)*$/;
// Correo: parte después de la @ (dominio con punto y terminación de solo letras)
const CORREO_DOMINIO_REGEX = /^([A-Za-z0-9]+(-[A-Za-z0-9]+)*\.)+[A-Za-z]{2,}$/;

// Devuelve true si el correo tiene un formato válido
const correoValido = (correo) => {
  const partes = correo.split('@');
  if (partes.length !== 2) return false;
  const [local, dominio] = partes;
  return CORREO_LOCAL_REGEX.test(local) && CORREO_DOMINIO_REGEX.test(dominio);
};

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

      // Las fotos nuevas ya son URLs completas de Cloudinary y pasan
      // sin cambios. Las viejas ("/uploads/perfiles/xxx.jpg") se
      // completan con la dirección actual del servidor.
      const perfil = {
        ...results[0],
        foto_perfil_url: urlPublica(req, results[0].foto_perfil_url),
      };

      res.status(200).json(perfil);
    }
  );
};

// Función para PUT /api/perfil
const actualizarPerfil = (req, res) => {
  const idUsuario = req.usuario.id;
  const { nombre, correo } = req.body;

  // Ambos deben ser texto no vacío (si llega un objeto o un número, se rechaza)
  if (
    typeof nombre !== 'string' || typeof correo !== 'string' ||
    !nombre.trim() || !correo.trim()
  ) {
    return res.status(400).json({ mensaje: 'Nombre y correo son obligatorios' });
  }

  // Quitar espacios sobrantes al inicio y al final; el correo se guarda en minúsculas
  const nombreLimpio = nombre.trim();
  const correoLimpio = correo.trim().toLowerCase();

  // ── Nombre ──
  if (nombreLimpio.length < LIMITES.nombre.min || nombreLimpio.length > LIMITES.nombre.max) {
    return res.status(400).json({
      mensaje: `El nombre debe tener entre ${LIMITES.nombre.min} y ${LIMITES.nombre.max} caracteres`,
    });
  }
  if (!NOMBRE_REGEX.test(nombreLimpio)) {
    return res.status(400).json({
      mensaje: 'El nombre solo puede tener letras y un espacio entre palabras',
    });
  }

  // ── Correo ──
  if (correoLimpio.length > LIMITES.correo.max || !correoValido(correoLimpio)) {
    return res.status(400).json({ mensaje: 'El correo no tiene un formato válido' });
  }

  db.query(
    `UPDATE usuario SET nombre = ?, correo = ?, fecha_actualizacion = NOW()
     WHERE id_usuario = ?`,
    [nombreLimpio, correoLimpio, idUsuario],
    (error, results) => {
      if (error) {
        console.error(error);

        // Si el correo ya existe en otro usuario, MySQL tira este código
        if (error.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ mensaje: 'Ese correo ya está en uso' });
        }

        return res.status(500).json({ mensaje: 'Error al actualizar el perfil' });
      }

      res.status(200).json({
        mensaje: 'Perfil actualizado correctamente',
        nombre: nombreLimpio,
        correo: correoLimpio,
      });
    }
  );
};

// Función para POST /api/perfil/foto_perfil
// Multer (upload-perfil-middleware.js) dejó la imagen en la carpeta
// temporal antes de que esta función se ejecute. Aquí:
//   1. se sube a Cloudinary (una sola foto por usuario: si ya había
//      una, se reemplaza),
//   2. se borra el archivo temporal,
//   3. se guarda en la base de datos la URL https que devuelve
//      Cloudinary y se responde con esa misma URL.
const subirFotoPerfil = async (req, res) => {
  const idUsuario = req.usuario.id;

  if (!req.file) {
    return res.status(400).json({ mensaje: 'No se recibió ninguna imagen' });
  }

  let resultado;
  try {
    resultado = await cloudinary.uploader.upload(req.file.path, {
      folder: 'houseloop/perfiles',
      public_id: idUsuario,   // el nombre del archivo en Cloudinary = el id del usuario
      overwrite: true,        // si ya tenía foto, la reemplaza
      invalidate: true,       // pide a Cloudinary olvidar la copia vieja
      resource_type: 'image',
      // Reduce la imagen a un máximo de 512 px por lado antes de guardarla
      transformation: [{ width: 512, height: 512, crop: 'limit' }],
    });
  } catch (error) {
    console.error('Error subiendo la foto de perfil a Cloudinary:', error.message);
    return res.status(502).json({ mensaje: 'No se pudo subir la imagen. Intenta de nuevo.' });
  } finally {
    // Se borra el archivo temporal, haya salido bien o mal la subida
    fs.unlink(req.file.path, () => {});
  }

  const urlFoto = resultado.secure_url;

  db.query(
    `UPDATE usuario SET foto_perfil_url = ?, fecha_actualizacion = NOW()
     WHERE id_usuario = ?`,
    [urlFoto, idUsuario],
    (error, results) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ mensaje: 'Error al guardar la foto de perfil' });
      }

      res.status(200).json({
        mensaje: 'Foto de perfil actualizada',
        foto_perfil_url: urlFoto,
      });
    }
  );
};

module.exports = { obtenerPerfil, actualizarPerfil, subirFotoPerfil };