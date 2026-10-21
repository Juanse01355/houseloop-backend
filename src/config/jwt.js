// Clave secreta de los tokens JWT: solo viene del entorno (.env o panel del servidor).
// Si falta, el servidor se detiene al arrancar en vez de usar una clave pública.
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('Falta JWT_SECRET en el entorno (mínimo 32 caracteres)');
}

module.exports = { JWT_SECRET };