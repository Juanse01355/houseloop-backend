// ============================================================
//   HOUSELOOP BACKEND — Controlador de subida de archivos
//   Arquitectura: MVC — Capa de Control
//
//   Guarda este archivo en: src/controllers/upload-controller.js
//
//   Requiere: src/utils/generar-miniatura.js
//   (y haber ejecutado: npm install fluent-ffmpeg ffmpeg-static)
// ============================================================

const path = require('path');
const { generarMiniatura } = require('../utils/generar-miniatura');
const { hostDe } = require('../utils/urls');

/**
 * subirArchivos
 * Multer ya guardó los archivos en disco (carpetas uploads/fotos
 * y uploads/videos) antes de que esta función se ejecute. Aquí
 * armamos las URLs con las que el cliente puede ver los archivos
 * ahora mismo, y generamos la miniatura del video (un frame
 * guardado como .jpg en uploads/miniaturas).
 *
 * Método HTTP: POST
 * Ruta: /upload
 * Recibe: multipart/form-data con los campos "video" (un archivo)
 *         y "fotos" (varios archivos).
 * Respuesta: { video, miniatura, fotos } con URLs completas.
 *
 * IMPORTANTE: estas URLs son solo para que el cliente las use al
 * momento. Cuando se guarden con POST /propiedades, el
 * property-controller les quita el host y guarda solo la ruta
 * ("/uploads/videos/xxx.mp4"), así la base de datos no depende de
 * la IP del computador.
 *
 * Si la miniatura no se puede generar, la subida NO falla:
 * "miniatura" llega como null y el resto funciona igual.
 */
const subirArchivos = async (req, res) => {
  const host = hostDe(req);

  const videoFile = req.files['video'] ? req.files['video'][0] : null;
  const fotosFiles = req.files['fotos'] || [];

  const videoUrl = videoFile ? `${host}/uploads/videos/${videoFile.filename}` : null;
  const fotosUrls = fotosFiles.map((archivo) => `${host}/uploads/fotos/${archivo.filename}`);

  // ── Miniatura del video ──
  let miniaturaUrl = null;
  if (videoFile) {
    try {
      // uploads/videos/../miniaturas → uploads/miniaturas
      const carpetaMiniaturas = path.join(path.dirname(videoFile.path), '..', 'miniaturas');
      const nombreBase = path.parse(videoFile.filename).name;

      const archivoMiniatura = await generarMiniatura(
        videoFile.path,
        carpetaMiniaturas,
        nombreBase
      );

      miniaturaUrl = `${host}/uploads/miniaturas/${archivoMiniatura}`;
    } catch (error) {
      console.error('No se pudo generar la miniatura:', error.message);
    }
  }

  res.json({
    video: videoUrl,
    miniatura: miniaturaUrl,
    fotos: fotosUrls,
  });
};

module.exports = { subirArchivos };