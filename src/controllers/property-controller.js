// ============================================================
//   HOUSELOOP BACKEND — Controlador de propiedades
//   Métodos con verbo siguiendo estándares de codificación
// ============================================================

const connection = require('../db/connection');

// ── READ — Consultar todas las propiedades ──
const obtenerPropiedades = (req, res) => {
  connection.query('SELECT * FROM propiedad', (error, results) => {
    if (error) {
      res.status(500).json({ error: 'Error consultando propiedades' });
      return;
    }
    res.json(results);
  });
};

// ── CREATE — Guardar una propiedad nueva ──
const guardarPropiedad = (req, res) => {
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
};

// ── UPDATE — Actualizar una propiedad existente ──
const actualizarPropiedad = (req, res) => {
  const { id } = req.params;
  const { titulo, precio, estado } = req.body;

  const query = `
    UPDATE propiedad 
    SET titulo = ?, precio = ?, estado = ?
    WHERE id_propiedad = ?
  `;

  connection.query(query, [titulo, precio, estado, id], (error, results) => {
    if (error) {
      res.status(500).json({ error: 'Error actualizando propiedad', detalle: error.message });
      return;
    }
    res.json({ mensaje: '✅ Propiedad actualizada correctamente' });
  });
};

// ── DELETE — Eliminar una propiedad ──
const eliminarPropiedad = (req, res) => {
  const { id } = req.params;

  const query = `DELETE FROM propiedad WHERE id_propiedad = ?`;

  connection.query(query, [id], (error, results) => {
    if (error) {
      res.status(500).json({ error: 'Error eliminando propiedad', detalle: error.message });
      return;
    }
    res.json({ mensaje: '✅ Propiedad eliminada correctamente' });
  });
};

module.exports = {
  obtenerPropiedades,
  guardarPropiedad,
  actualizarPropiedad,
  eliminarPropiedad
};