// ============================================================
//   HOUSELOOP BACKEND — Controlador de subida de archivos
//   Arquitectura: MVC — Capa de Control
//
//   Guarda este archivo en: src/controllers/upload-controller.js
//
//   Requiere: src/config/cloudinary.js
// ============================================================

const fs = require('fs');
const cloudinary = require('../config/cloudinary');

// Borra de la carpeta temporal los archivos que multer recibió
const borrarTemporales = (files) => {
  Object.values(files || {})
    .flat()
    .forEach((archivo) => fs.unlink(archivo.path, () => {}));
};

/**
 * subirArchivos
 * Multer dejó los archivos en la carpeta temporal antes de que esta
 * función se ejecute. Aquí se suben a Cloudinary y se arman las URLs
 * https que el cliente usará.
 *
 * Método HTTP: POST
 * Ruta: /upload
 * Recibe: multipart/form-data con los campos "video" (un archivo)
 *         y "fotos" (varios archivos).
 * Respuesta: { video, miniatura, fotos } con URLs completas de Cloudinary.
 *
 * La miniatura no es un archivo aparte: es la misma dirección del video
 * pidiendo un fotograma en .jpg (segundo 1, 480 px de ancho). Cloudinary
 * la genera la primera vez que alguien la pide.
 *
 * Si algo falla a mitad, se intenta borrar de Cloudinary lo que ya se
 * subió, para no dejar archivos huérfanos ocupando espacio.
 */
const subirArchivos = async (req, res) => {
  const videoFile = req.files['video'] ? req.files['video'][0] : null;
  const fotosFiles = req.files['fotos'] || [];

  // Lo que ya quedó en Cloudinary (para poder deshacerlo si algo falla)
  const subidos = [];

  try {
    let videoUrl = null;
    let miniaturaUrl = null;

    // ── Video ──
    if (videoFile) {
      const resultado = await cloudinary.uploader.upload(videoFile.path, {
        resource_type: 'video',
        folder: 'houseloop/videos',
        timeout: 120000, // 2 minutos: los videos tardan más que las fotos
      });
      subidos.push({ public_id: resultado.public_id, resource_type: 'video' });
      videoUrl = resultado.secure_url;

      // Miniatura: fotograma del segundo 1, como .jpg de 480 px de ancho
      miniaturaUrl = cloudinary.url(resultado.public_id, {
        resource_type: 'video',
        type: 'upload',
        secure: true,
        format: 'jpg',
        transformation: [{ start_offset: '1', width: 480, crop: 'limit' }],
      });
    }

    // ── Fotos (todas a la vez) ──
    const resultadosFotos = await Promise.allSettled(
      fotosFiles.map((archivo) =>
        cloudinary.uploader.upload(archivo.path, {
          resource_type: 'image',
          folder: 'houseloop/fotos',
          // Reduce la foto a un máximo de 1600 px por lado antes de guardarla
          transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
          timeout: 60000,
        })
      )
    );

    // Se anotan las que sí subieron (aunque otra haya fallado)
    resultadosFotos.forEach((r) => {
      if (r.status === 'fulfilled') {
        subidos.push({ public_id: r.value.public_id, resource_type: 'image' });
      }
    });

    // Si alguna falló, se cancela todo
    const fallida = resultadosFotos.find((r) => r.status === 'rejected');
    if (fallida) throw fallida.reason;

    const fotosUrls = resultadosFotos.map((r) => r.value.secure_url);

    res.json({
      video: videoUrl,
      miniatura: miniaturaUrl,
      fotos: fotosUrls,
    });
  } catch (error) {
    console.error('Error subiendo archivos a Cloudinary:', error.message);

    // Deshacer: borrar de Cloudinary lo que ya se había subido
    await Promise.allSettled(
      subidos.map((archivo) =>
        cloudinary.uploader.destroy(archivo.public_id, { resource_type: archivo.resource_type })
      )
    );

    res.status(502).json({ error: 'No se pudieron subir los archivos. Intenta de nuevo.' });
  } finally {
    // Se borran los archivos temporales, haya salido bien o mal
    borrarTemporales(req.files);
  }
};

module.exports = { subirArchivos };