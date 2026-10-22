// Este archivo define los endpoints (URL + método HTTP) del módulo de perfil.
// No tiene lógica de negocio: solo conecta cada endpoint con su función
// correspondiente en usuario-controller.js.

const express = require('express');
const router = express.Router();

// Middleware que verifica el JWT antes de dejar pasar a las rutas protegidas
const verificarToken = require('../middleware/auth-middleware');

// Middleware de multer para la foto de perfil
const uploadPerfil = require('../middleware/upload-perfil-middleware');

// Funciones que tienen la lógica real, definidas en el controller
const { obtenerPerfil, actualizarPerfil, subirFotoPerfil } = require('../controllers/usuario-controller');

// GET /api/perfil  -> devuelve los datos del usuario logueado
router.get('/', verificarToken, obtenerPerfil);

// PUT /api/perfil  -> actualiza nombre y correo del usuario logueado
router.put('/', verificarToken, actualizarPerfil);

// POST /api/perfil/foto_perfil -> sube/actualiza la foto de perfil del usuario logueado
router.post(
  '/foto_perfil',
  verificarToken,
  (req, res, next) => {
    uploadPerfil.single('foto_perfil')(req, res, (err) => {
      if (err) {
        // Imagen demasiado pesada (límite de 5 MB en upload-perfil-middleware.js)
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ mensaje: 'La imagen supera el tamaño máximo (5 MB)' });
        }
        return res.status(400).json({ mensaje: 'Solo se permiten imágenes (JPG, PNG o WEBP)' });
      }
      next();
    });
  },
  subirFotoPerfil
);

module.exports = router;