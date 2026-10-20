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
const cors = require('cors');

// ── Importación de rutas ──
const propertyRoutes = require('./src/routes/property-routes');
const authRoutes = require('./src/routes/auth-routes');       // Registro e inicio de sesión
const uploadRoutes = require('./src/routes/upload-routes');   // Subida de video + fotos
const usuarioRoutes = require('./src/routes/usuario-routes'); // Módulo de perfil

// Puerto del servidor — usa el valor del .env o 3300 por defecto
const PORT = process.env.PORT || 3300;

// Habilita CORS para aceptar peticiones desde cualquier origen.
// Necesario para que el navegador (localhost:8081) y el celular
// puedan conectarse al backend. En producción conviene limitarlo
// al dominio real del frontend.
app.use(cors());

// Middleware para recibir JSON: convierte automáticamente los datos
// enviados en formato JSON en un objeto de JavaScript (req.body).
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Archivos estáticos — Videos ──
// Permite acceder a los videos de la carpeta /videos a través de la red.
// Ejemplo: http://TU_IP:3300/videos/prueba.mp4
app.use('/videos', express.static('videos'));

// ── Archivos estáticos — Uploads (video + fotos de publicaciones) ──
// Multer guarda los archivos en uploads/videos y uploads/fotos.
// Esta línea los hace accesibles por HTTP.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Ruta de prueba ──
// Sirve para comprobar rápido (desde el PC o el celular) que la API responde.
app.get('/', (req, res) => {
  res.json({ mensaje: 'HouseLoop API funcionando' });
});

// ── Rutas de la API ──
app.use('/propiedades', propertyRoutes);
app.use('/auth', authRoutes);
app.use('/upload', uploadRoutes);
app.use('/api/perfil', usuarioRoutes);

// ── Manejo de rutas no encontradas (404) ──
// Si ninguna ruta anterior coincidió, la API responde siempre en JSON.
app.use((req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

// ── Iniciar servidor ──
// "0.0.0.0" hace que escuche en todas las interfaces de red,
// así el celular puede conectarse, no solo el propio PC.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor HouseLoop escuchando en el puerto ${PORT}`);
});