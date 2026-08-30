// ============================================================
//   HOUSELOOP BACKEND — Controlador de subida de archivos
//   Arquitectura: MVC — Capa de Control
//
//   Guarda este archivo en: src/controllers/upload-controller.js
// ============================================================

/**
 * subirArchivos
 * Multer ya guardó los archivos en disco (carpetas uploads/fotos
 * y uploads/videos) antes de que esta función se ejecute. Aquí
 * solo armamos las URLs públicas con las que cualquier dispositivo
 * en la misma red puede acceder a esos archivos.
 * Método HTTP: POST
 * Ruta: /upload
 * Recibe: multipart/form-data con los campos "video" (un archivo)
 *         y "fotos" (varios archivos).
 * Respuesta: { video: "http://IP:PUERTO/uploads/videos/xxx.mp4",
 *              fotos: ["http://IP:PUERTO/uploads/fotos/xxx.jpg", ...] }
 */
const subirArchivos = (req, res) => {
  // req.protocol + req.get('host') arma algo como "http://192.168.1.24:3300"
  // automáticamente, sin tener que escribir la IP a mano aquí.
  const host = `${req.protocol}://${req.get('host')}`;

  const videoFile = req.files['video'] ? req.files['video'][0] : null;
  const fotosFiles = req.files['fotos'] || [];

  const videoUrl = videoFile ? `${host}/uploads/videos/${videoFile.filename}` : null;
  const fotosUrls = fotosFiles.map((archivo) => `${host}/uploads/fotos/${archivo.filename}`);

  res.json({
    video: videoUrl,
    fotos: fotosUrls,
  });
};

module.exports = { subirArchivos };