// ============================================================
//   HOUSELOOP BACKEND — Middleware de subida de archivos
//   Configura multer: dónde se dejan los archivos un momento,
//   cómo se nombran y qué se permite subir (tipo y tamaño), para
//   fotos y video de las propiedades.
//
//   Guarda este archivo en: src/middleware/upload-middleware.js
//
//   Los archivos quedan en la carpeta TEMPORAL del sistema; el
//   controlador los sube a Cloudinary y luego los borra.
// ============================================================

const multer = require('multer');
const os = require('os');

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

// Tamaños máximos por archivo (MB), según el plan gratis de Cloudinary:
//   imagen máx. 10 MB, video máx. 100 MB (y transformación de video máx. 40 MB)
const MAX_FOTO_MB = 10;
const MAX_VIDEO_MB = 40;

const storage = multer.diskStorage({
  // Carpeta temporal del sistema (en Render es /tmp)
  destination: (req, file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    // Nombre único para evitar que dos archivos se pisen entre sí
    const extension = EXTENSION_POR_TIPO[file.mimetype] || '';
    const nombreUnico = `houseloop-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    cb(null, nombreUnico);
  },
});

const upload = multer({
  storage,
  limits: {
    // Multer solo permite un límite para todos los archivos: se usa el más
    // grande (video). El límite de las fotos se revisa en upload-routes.js.
    fileSize: Math.max(MAX_FOTO_MB, MAX_VIDEO_MB) * 1024 * 1024,
    files: 11, // 1 video + 10 fotos como máximo
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

// Para que upload-routes.js use los mismos números
upload.MAX_FOTO_MB = MAX_FOTO_MB;
upload.MAX_VIDEO_MB = MAX_VIDEO_MB;

module.exports = upload;