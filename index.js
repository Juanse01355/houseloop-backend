// ============================================================
//   HOUSELOOP BACKEND — Servidor principal (Node.js + Express)
//   Autor: Juan Sebastian Guzman Ramirez — ADSO SENA Ficha 3235894
// ============================================================

// Carga las variables de entorno del .env (debe ir primero)
require('dotenv').config();

const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./src/db/connection');

// ── Importación de rutas ──
const propertyRoutes = require('./src/routes/property-routes');
const authRoutes = require('./src/routes/auth-routes');
const uploadRoutes = require('./src/routes/upload-routes');
const usuarioRoutes = require('./src/routes/usuario-routes');

// Puerto: en la nube lo asigna la plataforma; en local usa 3300
const PORT = process.env.PORT || 3300;

// Detrás del proxy de la plataforma, para que el límite de intentos
// use la IP real de cada usuario y no la del proxy
app.set('trust proxy', 1);

// Cabeceras de seguridad. "cross-origin" permite que el frontend,
// que está en otro dominio, cargue los videos y fotos.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS: en producción solo los dominios de ALLOWED_ORIGINS (separados por coma).
// Si la variable está vacía (desarrollo local), queda abierto.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Archivos estáticos ──
app.use('/videos', express.static('videos'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Ruta de prueba ──
app.get('/', (req, res) => {
  res.json({ mensaje: 'HouseLoop API funcionando' });
});

// ── Salud del servidor y de la base de datos ──
// La plataforma de despliegue la usa para saber si el servicio está vivo
app.get('/health', (req, res) => {
  db.query('SELECT 1', (error) => {
    if (error) return res.status(500).json({ estado: 'error' });
    res.json({ estado: 'ok' });
  });
});

// ── Límite de intentos en login y registro ──
// Máximo 20 cada 15 minutos por IP (frena el ataque de fuerza bruta)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { mensaje: 'Demasiados intentos, intenta de nuevo en unos minutos' },
});

// ── Rutas de la API ──
app.use('/propiedades', propertyRoutes);
app.use('/auth', authLimiter, authRoutes);
app.use('/upload', uploadRoutes);
app.use('/api/perfil', usuarioRoutes);

// ── 404: ninguna ruta coincidió ──
app.use((req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

// ── Errores no controlados: no se filtran detalles internos al cliente ──
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ mensaje: 'Error interno del servidor' });
});

// ── Iniciar servidor ──
// "0.0.0.0" escucha en todas las interfaces (celular y nube)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor HouseLoop escuchando en el puerto ${PORT}`);
});