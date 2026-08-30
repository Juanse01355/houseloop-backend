// ============================================================
//   HOUSELOOP BACKEND — Middleware de subida de foto de perfil
//   Guarda este archivo en: src/middleware/upload-perfil-middleware.js
// ============================================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const carpetaPerfiles = path.join(__dirname, '..', '..', 'uploads', 'perfiles');

if (!fs.existsSync(carpetaPerfiles)) {
  fs.mkdirSync(carpetaPerfiles, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, carpetaPerfiles);
  },
  filename: (req, file, cb) => {
    // Usamos el id del usuario logueado (req.usuario.id, ya
    // verificado por verificarToken) para que el nombre del
    // archivo quede ligado a esa cuenta.
    const nombreUnico = `${req.usuario.id}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, nombreUnico);
  },
});

const uploadPerfil = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (tiposPermitidos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('TIPO_NO_PERMITIDO'), false);
    }
  },
});

module.exports = uploadPerfil;