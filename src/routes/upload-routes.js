// ============================================================
//   HOUSELOOP BACKEND — Rutas de subida de archivos
//
//   Guarda este archivo en: src/routes/upload-routes.js
// ============================================================

const fs = require('fs');
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload-middleware');
const verificarToken = require('../middleware/auth-middleware');
const { subirArchivos } = require('../controllers/upload-controller');

const { MAX_FOTO_MB, MAX_VIDEO_MB } = upload;

// upload.fields([...]) le dice a multer qué nombres de campo esperar
// y cuántos archivos como máximo aceptar en cada uno.
const recibirArchivos = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'fotos', maxCount: 10 },
]);

// Borra de la carpeta temporal los archivos que multer ya recibió
const borrarTemporales = (files) => {
  Object.values(files || {})
    .flat()
    .forEach((archivo) => fs.unlink(archivo.path, () => {}));
};

// Envuelve a multer para convertir sus errores en respuestas 400 claras
// (sin esto, un archivo muy grande o de un tipo no permitido saldría
// como un error 500 genérico).
const manejarSubida = (req, res, next) => {
  recibirArchivos(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: `Un archivo supera el tamaño máximo permitido (video ${MAX_VIDEO_MB} MB, fotos ${MAX_FOTO_MB} MB)`,
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Cantidad o campo de archivos no permitido (máximo 1 video y 10 fotos)' });
      }
      if (err.message === 'TIPO_NO_PERMITIDO') {
        return res.status(400).json({ error: 'Tipo de archivo no permitido (video: mp4/mov/webm; fotos: jpg/png/webp)' });
      }
      console.error('Error en la subida:', err.message);
      return res.status(500).json({ error: 'Error al subir los archivos' });
    }

    // Si no llegó ningún archivo, respondemos 400 en vez de dejar
    // que el controlador falle más adelante
    if (!req.files || (!req.files.video && !req.files.fotos)) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    // Las fotos tienen un límite menor que el video: se revisa aquí
    const fotoGrande = (req.files.fotos || []).find(
      (foto) => foto.size > MAX_FOTO_MB * 1024 * 1024
    );
    if (fotoGrande) {
      borrarTemporales(req.files);
      return res.status(400).json({ error: `Una foto supera el tamaño máximo permitido (${MAX_FOTO_MB} MB)` });
    }

    next();
  });
};

// ── POST /upload — Sube video (1) y fotos (varias) ──
// Orden importante: primero se verifica el token y SOLO después
// se reciben los archivos.
router.post('/', verificarToken, manejarSubida, subirArchivos);

module.exports = router;