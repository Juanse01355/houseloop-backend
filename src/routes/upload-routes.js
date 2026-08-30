// ============================================================
//   HOUSELOOP BACKEND — Rutas de subida de archivos
//
//   Guarda este archivo en: src/routes/upload-routes.js
// ============================================================

const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload-middleware');
const { subirArchivos } = require('../controllers/upload-controller');

// ── POST /upload — Sube video (1) y fotos (varias) ──
// upload.fields([...]) le dice a multer qué nombres de campo esperar
// y cuántos archivos como máximo aceptar en cada uno.
router.post(
  '/',
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'fotos', maxCount: 10 },
  ]),
  subirArchivos
);

module.exports = router;