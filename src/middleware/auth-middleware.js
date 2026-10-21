// FUNCIÓN DE ESTE ARCHIVO:
// Es el "guardia de seguridad" que revisa el token JWT antes de dejar
// pasar una petición a una ruta protegida. Si el token es válido,
// guarda el id del usuario en req.usuario para que el controller lo use.

const jwt = require('jsonwebtoken');

// La clave secreta viene solo del entorno (.env): ya no hay clave de respaldo
const { JWT_SECRET } = require('../config/jwt');

const verificarToken = (req, res, next) => {
  try {
    // Leemos el header Authorization que debe venir como: Bearer <token>
    const authHeader = req.headers['authorization'];

    // Si no viene el header, o no empieza con "Bearer ", cortamos acá
    // y respondemos 401 (no autorizado) sin dejar pasar la petición
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ mensaje: 'Token no proporcionado' });
    }

    // Separamos la palabra "Bearer" y nos quedamos solo con el token
    const token = authHeader.split(' ')[1];

    // Verificamos que el token sea válido y no esté vencido,
    // usando la misma clave secreta (JWT_SECRET) con la que se firmó
    // en auth-controller.js al hacer login
    const decoded = jwt.verify(token, JWT_SECRET);

    // Si llegamos hasta acá, el token es válido.
    // Guardamos los datos del usuario (que venían "adentro" del token)
    // en req.usuario, para que el controller los pueda usar después
    req.usuario = {
      id: decoded.id,
      email: decoded.correo
    };

    // Dejamos pasar la petición a la siguiente función (el controller)
    next();
  } catch (error) {
    // Si jwt.verify falla (token vencido o inválido), caemos acá
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ mensaje: 'Token expirado' });
    }
    return res.status(401).json({ mensaje: 'Token inválido' });
  }
};

module.exports = verificarToken;