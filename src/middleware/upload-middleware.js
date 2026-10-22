// ============================================================
//   HOUSELOOP BACKEND — Middleware de subida de archivos
//   Configura multer: dónde se guardan los archivos, cómo
//   se nombran y qué se permite subir (tipo y tamaño), para
//   fotos y video de las propiedades.
//
//   Guarda este archivo en: src/middleware/upload-middleware.js
// ============================================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Carpetas donde se guardan los archivos físicamente.
// __dirname aquí es src/middleware, por eso subimos dos niveles (..)
// para llegar a la raíz del proyecto del backend.
const raizUploads = path.join(__dirname, '..', '..', 'uploads');
const carpetaFotos = path.join(raizUploads, 'fotos');
const carpetaVideos = path.join(raizUploads, 'videos');
const carpetaMiniaturas = path.join(raizUploads, 'miniaturas');

// Si las carpetas no existen todavía (por ejemplo, en un servidor nuevo
// donde el disco empieza vacío), las crea automáticamente.
[carpetaFotos, carpetaVideos, carpetaMiniaturas].forEach((carpeta) => {
  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }
});

// Tipos permitidos y la extensión que le ponemos a cada uno.
// La extensión la decidimos nosotros según el tipo, NO la que traiga
// el nombre original del archivo (el cliente puede mentir en el nombre).
const EXTENSION_POR_TIPO = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov', // videos grabados con iPhone
  'video/webm': '.webm',
};
const TIPOS_FOTO = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const TIPOS_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm'];

// Tamaño máximo por archivo (aplica a fotos y a video)
const MAX_MB = 100;

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
    const extension = EXTENSION_POR_TIPO[file.mimetype] || '';
    const nombreUnico = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    cb(null, nombreUnico);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_MB * 1024 * 1024, // bytes por archivo
    files: 11,                      // 1 video + 10 fotos como máximo
  },
  // Rechaza lo que no sea del tipo esperado para cada campo
  fileFilter: (req, file, cb) => {
    const permitidos =
      file.fieldname === 'video' ? TIPOS_VIDEO :
      file.fieldname === 'fotos' ? TIPOS_FOTO : [];

    if (permitidos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('TIPO_NO_PERMITIDO'), false);
    }
  },
});

module.exports = upload;