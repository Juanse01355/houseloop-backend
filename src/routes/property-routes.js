// ============================================================
//   HOUSELOOP BACKEND — Rutas de propiedades
//   Equivalente de @WebServlet en Java
// ============================================================

const express = require('express');
const router = express.Router();
const {
  obtenerPropiedades,
  guardarPropiedad,
  actualizarPropiedad,
  eliminarPropiedad
} = require('../controllers/property-controller');

// ── GET /propiedades — Consultar todas las propiedades ──
router.get('/', obtenerPropiedades);

// ── POST /propiedades — Crear una propiedad nueva ──
router.post('/', guardarPropiedad);

// ── PUT /propiedades/:id — Actualizar una propiedad ──
router.put('/:id', actualizarPropiedad);

// ── DELETE /propiedades/:id — Eliminar una propiedad ──
router.delete('/:id', eliminarPropiedad);

module.exports = router;