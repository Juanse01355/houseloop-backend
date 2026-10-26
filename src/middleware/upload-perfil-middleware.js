// ============================================================
//   HOUSELOOP BACKEND — Middleware de subida de foto de perfil
//   Guarda este archivo en: src/middleware/upload-perfil-middleware.js
//
//   La foto se deja un momento en la carpeta TEMPORAL del sistema;
//   el controlador la sube a Cloudinary y luego la borra.
// ============================================================

const multer = require('multer');
const os = require('os');

// La extensión la decidimos nosotros según el tipo de imagen,
// no la que traiga el nombre original del archivo.
const EXTENSION_POR_TIPO = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  // Carpeta temporal del sistema (en Render es /tmp, en Windows AppData\Local\Temp)
  destination: (req, file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    // Usamos el id del usuario logueado (req.usuario.id, ya
    // verificado por verificarToken) para que el nombre del
    // archivo quede ligado a esa cuenta.
    const nombreUnico = `${req.usuario.id}-${Date.now()}${EXTENSION_POR_TIPO[file.mimetype] || ''}`;
    cb(null, nombreUnico);
  },
});

const uploadPerfil = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB: suficiente para una foto de perfil
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (EXTENSION_POR_TIPO[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('TIPO_NO_PERMITIDO'), false);
    }
  },
});

module.exports = uploadPerfil;