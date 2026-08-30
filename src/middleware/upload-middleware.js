// ============================================================
//   HOUSELOOP BACKEND — Middleware de subida de archivos
//   Configura multer: dónde se guardan los archivos y cómo
//   se nombran, para fotos y video de las propiedades.
//
//   Requiere el paquete "multer". Si no lo tienes instalado:
//     npm install multer
//
//   Guarda este archivo en: src/middleware/upload-middleware.js
// ============================================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Carpetas donde se van a guardar los archivos físicamente.
// __dirname aquí es src/middleware, por eso subimos dos niveles (..)
// para llegar a la raíz del proyecto del backend.
const carpetaFotos = path.join(__dirname, '..', '..', 'uploads', 'fotos');
const carpetaVideos = path.join(__dirname, '..', '..', 'uploads', 'videos');

// Si las carpetas no existen todavía, las crea automáticamente.
[carpetaFotos, carpetaVideos].forEach((carpeta) => {
  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }
});

// Le dice a multer EN DÓNDE y CON QUÉ NOMBRE guardar cada archivo.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'video') {
      cb(null, carpetaVideos);
    } else {
      cb(null, carpetaFotos);
    }
  },
  filename: (req, file, cb) => {
    // Nombre único para evitar que dos archivos se sobreescriban
    // entre sí si se llaman igual (ej: dos "foto.jpg" distintas).
    const nombreUnico = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, nombreUnico);
  },
});

const upload = multer({ storage });

module.exports = upload;