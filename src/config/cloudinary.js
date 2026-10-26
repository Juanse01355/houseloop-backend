// ============================================================
//   HOUSELOOP BACKEND — Configuración de Cloudinary
//
//   Guarda este archivo en: src/config/cloudinary.js
//
//   Lee las credenciales del entorno (.env en local, panel de
//   Render en producción). Nunca se escriben aquí.
// ============================================================

require('dotenv').config();
const cloudinary = require('cloudinary').v2;

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

// Si falta alguna variable, el servidor no arranca y dice cuál falta
const faltantes = [
  ['CLOUDINARY_CLOUD_NAME', CLOUDINARY_CLOUD_NAME],
  ['CLOUDINARY_API_KEY', CLOUDINARY_API_KEY],
  ['CLOUDINARY_API_SECRET', CLOUDINARY_API_SECRET],
]
  .filter(([, valor]) => !valor || !valor.trim())
  .map(([nombre]) => nombre);

if (faltantes.length > 0) {
  throw new Error(`Faltan variables de entorno de Cloudinary: ${faltantes.join(', ')}`);
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME.trim(),
  api_key: CLOUDINARY_API_KEY.trim(),
  api_secret: CLOUDINARY_API_SECRET.trim(),
  secure: true, // las URLs salen siempre con https
});

module.exports = cloudinary;