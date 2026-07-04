// ============================================================
//   HOUSELOOP BACKEND — Servidor principal
//   Punto de entrada de la aplicación
// ============================================================

const express = require('express');
const app = express();
const path = require('path');
const propertyRoutes = require('./src/routes/property-routes');

// Puerto del servidor
const PORT = 3000;

// Middleware para recibir JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta de prueba
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Rutas de propiedades
app.use('/propiedades', propertyRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});