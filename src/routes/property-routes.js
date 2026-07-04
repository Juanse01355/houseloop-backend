// ============================================================
//   HOUSELOOP BACKEND — Rutas de propiedades
//   Equivalente de @WebServlet en Java
// ============================================================

const express = require('express');
const router = express.Router();
const connection = require('../db/connection');

// ── GET /propiedades — Consultar todas las propiedades ──
router.get('/', (req, res) => {
  connection.query('SELECT * FROM propiedad', (error, results) => {
    if (error) {
      res.status(500).json({ error: 'Error consultando propiedades' });
      return;
    }
    res.json(results);
  });
});

// ── POST /propiedades — Crear una propiedad nueva ──
router.post('/', (req, res) => {
  const {
    titulo, descripcion, precio, area_m2,
    habitaciones, banos, tipo_operacion,
    tipo_inmueble, estado, id_usuario,
    id_ubicacion, video, fotos
  } = req.body;

  const query = `
    INSERT INTO propiedad (
      titulo, descripcion, precio, area_m2,
      habitaciones, banos, tipo_operacion,
      tipo_inmueble, estado, id_usuario,
      id_ubicacion, video, fotos
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const valores = [
    titulo, descripcion, precio, area_m2,
    habitaciones, banos, tipo_operacion,
    tipo_inmueble, estado, id_usuario,
    id_ubicacion, video, fotos
  ];

  connection.query(query, valores, (error, results) => {
    if (error) {
      res.status(500).json({ error: 'Error guardando propiedad', detalle: error.message });
      return;
    }
    res.json({ mensaje: '✅ Propiedad guardada correctamente', id: results.insertId });
  });
});

module.exports = router;