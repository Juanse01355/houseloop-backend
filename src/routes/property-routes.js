// ============================================================
//   HOUSELOOP BACKEND — Rutas de propiedades
//   Equivalente de @WebServlet en Java
// ============================================================

const express = require('express');
const router = express.Router();

// Middleware que verifica el JWT antes de dejar pasar a las rutas protegidas
const verificarToken = require('../middleware/auth-middleware');

const {
  obtenerPropiedades,
  guardarPropiedad,
  actualizarPropiedad,
  eliminarPropiedad,
  obtenerFeed,
  obtenerPropiedadesPorUsuario,
  registrarReproduccion,
  obtenerPropiedadPorId,
  cambiarEstadoPropiedad,
} = require('../controllers/property-controller');

// ── GET /propiedades — Consultar todas las propiedades ──
router.get('/', obtenerPropiedades);

// ── GET /propiedades/feed — Consultar el feed de propiedades ──
router.get('/feed', obtenerFeed);

// ── GET /propiedades/usuario/:id — Consultar las propiedades de un usuario ──
router.get('/usuario/:id', obtenerPropiedadesPorUsuario);

// ── GET /propiedades/:id — Consultar una propiedad completa (detalle) ──
// IMPORTANTE: debe ir DESPUÉS de /feed y /usuario/:id; si va antes,
// Express tomaría la palabra "feed" como si fuera un id.
router.get('/:id', obtenerPropiedadPorId);

// ── POST /propiedades — Crear una propiedad nueva (requiere token) ──
// El dueño sale del token (req.usuario.id), no del cuerpo de la petición.
router.post('/', verificarToken, guardarPropiedad);

// ── POST /propiedades/:id/reproduccion — Sumar una reproducción al video ──
router.post('/:id/reproduccion', registrarReproduccion);

// ── PUT /propiedades/:id/estado — Cambiar el estado (solo el dueño) ──
router.put('/:id/estado', verificarToken, cambiarEstadoPropiedad);

// ── PUT /propiedades/:id — Actualizar una propiedad (solo el dueño) ──
router.put('/:id', verificarToken, actualizarPropiedad);

// ── DELETE /propiedades/:id — Eliminar una propiedad (solo el dueño) ──
router.delete('/:id', verificarToken, eliminarPropiedad);

module.exports = router;