// ============================================================
//   HOUSELOOP BACKEND
//   Framework seleccionado: Node.js + Express
//
//   Justificación:
//   Se eligió Node.js con Express por ser el framework más
//   adecuado para el proyecto HouseLoop por las siguientes razones:
//   1. Usa JavaScript — el mismo lenguaje del frontend en React Native,
//      lo que permite un solo lenguaje para toda la aplicación.
//   2. Express es liviano, flexible y ampliamente usado en la industria
//      para construir APIs REST que conectan apps móviles con bases de datos.
//   3. Compatible con MySQL mediante mysql2, que es el equivalente
//      de JDBC en Java para conectarse a la base de datos de XAMPP.
//   4. Alta demanda laboral — Node.js es el backend más usado
//      en el ecosistema JavaScript junto con React Native.
//
//   Tipo de proyecto: Móvil (React Native) + Web (prototipo HTML/CSS/JS)
//                     + Stand-alone (backend local con XAMPP)
//   Autor: Juan Sebastian Guzman Ramirez
//   ADSO — SENA — Ficha 3235894
// ============================================================
//   HOUSELOOP BACKEND — Servidor principal
//   Punto de entrada de la aplicación
// ============================================================

// Carga las variables de entorno del archivo .env
// Debe ser la primera línea del archivo para que todas
// las variables estén disponibles en el resto del código
require('dotenv').config();

const express = require('express');
const app = express();
const path = require('path');
const propertyRoutes = require('./src/routes/property-routes');

// Puerto del servidor — usa el valor del .env o 3000 por defecto
// Si en .env dice PORT=3000, usa ese. Si no existe el .env, usa 3000.
const PORT = process.env.PORT || 3000;

// Middleware para recibir JSON:Convierte automáticamente los datos enviados en formato JSON, en un objeto de JavaScript para poder acceder a ellos mediante req.body.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Archivos estáticos — Videos ──
// Permite que React Native acceda directamente a los videos
// almacenados en la carpeta /videos del backend a través de la red local.
// Ejemplo: http://192.168.1.X:3000/videos/prueba.mp4
// Sin esta línea, Express no sabría cómo entregar archivos multimedia,
// solo respondería con datos JSON. Con esta línea actúa como
// un servidor de archivos local para toda la app HouseLoop.
app.use('/videos', express.static('videos'));

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