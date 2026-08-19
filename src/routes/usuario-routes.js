// Este archivo define los endpoints (URL + método HTTP) del módulo de perfil.
// No tiene lógica de negocio: solo conecta cada endpoint con su función
// correspondiente en usuario-controller.js.

const express = require('express');
const router = express.Router();

// Middleware que verifica el JWT antes de dejar pasar a las rutas protegidas
const verificarToken = require('../middleware/auth-middleware');

// Funciones que tienen la lógica real, definidas en el controller
const { obtenerPerfil, actualizarPerfil } = require('../controllers/usuario-controller');

// GET /api/perfil  -> devuelve los datos del usuario logueado
// Primero pasa por verificarToken (chequea el JWT),
// y si es válido, recién ahí ejecuta obtenerPerfil
router.get('/', verificarToken, obtenerPerfil);

// PUT /api/perfil
// Actualiza el nombre y correo del usuario logueado (nombre, correo en el body)
// Cuando cambias el nombre y correo desde editar perfil
// Requiere estar autenticado — pasa primero por verificarToken,
// que identifica de qué usuario se trata mediante el JWT.
router.put('/', verificarToken, actualizarPerfil);

module.exports = router;