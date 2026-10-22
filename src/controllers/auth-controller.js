// ============================================================
//   HOUSELOOP BACKEND — Controlador de autenticación
//   Maneja el registro e inicio de sesión de usuarios.
//   Usa bcrypt para encriptar contraseñas y JWT para sesiones.
//   Arquitectura: MVC — Capa de Control. (Recibe las solicitudes del cliente, valida la información, llama al modelo y devuelve una respuesta.)
// ============================================================

const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const connection = require('../db/connection');

// La clave secreta viene solo del entorno (.env): no hay clave de respaldo
const { JWT_SECRET } = require('../config/jwt');

// Formato básico de un correo (algo@dominio.ext)
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * registrarUsuario
 * Crea un nuevo usuario en la base de datos.
 * Método HTTP: POST
 * Ruta: /auth/registro
 * Recibe: nombre, correo, contrasena — desde el cuerpo de la petición.
 * Proceso: valida los datos y encripta la contraseña con bcrypt
 *          antes de guardarla.
 * Respuesta: mensaje de confirmación con el ID del nuevo usuario.
 */
const registrarUsuario = (req, res) => {
  const { nombre, correo, contrasena } = req.body;

  // Los tres deben ser texto no vacío (si llega un objeto o un número, bcrypt falla)
  const sonTexto = [nombre, correo, contrasena].every(
    (v) => typeof v === 'string' && v.trim() !== ''
  );
  if (!sonTexto) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
  }

  // Quitar espacios sobrantes al inicio y al final
  const nombreLimpio = nombre.trim();
  const correoLimpio = correo.trim();

  if (!CORREO_REGEX.test(correoLimpio)) {
    return res.status(400).json({ error: 'El correo no tiene un formato válido' });
  }

  // bcrypt solo usa los primeros 72 bytes; el máximo evita gastar CPU en vano
  if (contrasena.length < 8 || contrasena.length > 72) {
    return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 72 caracteres' });
  }

  // Verificar si el correo ya está registrado
  connection.query(
    'SELECT id_usuario FROM usuario WHERE correo = ?',
    [correoLimpio],
    async (error, results) => {
      if (error) {
        console.error('Error verificando el correo:', error.message);
        return res.status(500).json({ error: 'Error verificando el correo' });
      }

      if (results.length > 0) {
        return res.status(400).json({ error: 'El correo ya está registrado' });
      }

      // El try/catch va DENTRO del callback: es donde se ejecuta bcrypt,
      // y un error aquí no lo atrapa un try/catch que esté afuera.
      try {
        // Encriptar la contraseña con bcrypt (10 rondas de encriptación)
        const hash = await bcrypt.hash(contrasena, 10);

        // Generar ID único para el usuario
        const id_usuario = `USR${Date.now()}`;

        // Guardar el usuario en MySQL
        // (sin tipo_usuario: en este proyecto cualquier usuario puede
        //  comprar y publicar propiedades libremente)
        const query = `
          INSERT INTO usuario (id_usuario, nombre, correo, contrasena_hash, proveedor_auth, estado_cuenta)
          VALUES (?, ?, ?, ?, 'EMAIL', 'ACTIVA')
        `;

        connection.query(query, [id_usuario, nombreLimpio, correoLimpio, hash], (errInsert) => {
          if (errInsert) {
            // Dos registros casi simultáneos con el mismo correo
            if (errInsert.code === 'ER_DUP_ENTRY') {
              return res.status(400).json({ error: 'El correo ya está registrado' });
            }
            console.error('Error creando el usuario:', errInsert.message);
            return res.status(500).json({ error: 'Error creando el usuario' });
          }

          res.json({ mensaje: '✅ Usuario registrado correctamente', id: id_usuario });
        });
      } catch (err) {
        console.error('Error en el registro:', err.message);
        res.status(500).json({ error: 'Error en el servidor' });
      }
    }
  );
};

/**
 * iniciarSesion
 * Verifica las credenciales del usuario y genera un token JWT.
 * Método HTTP: POST
 * Ruta: /auth/login
 * Recibe: correo, contrasena — desde el cuerpo de la petición.
 * Proceso: busca el usuario, verifica la contraseña con bcrypt,
 *          genera y devuelve un token JWT válido por 24 horas.
 * Respuesta: token JWT + datos básicos del usuario.
 */
const iniciarSesion = (req, res) => {
  const { correo, contrasena } = req.body;

  // Ambos deben ser texto no vacío
  if (
    typeof correo !== 'string' || typeof contrasena !== 'string' ||
    !correo.trim() || !contrasena
  ) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }

  // Buscar el usuario por correo
  connection.query(
    'SELECT * FROM usuario WHERE correo = ?',
    [correo.trim()],
    async (error, results) => {
      if (error) {
        console.error('Error buscando el usuario:', error.message);
        return res.status(500).json({ error: 'Error buscando el usuario' });
      }

      if (results.length === 0) {
        return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
      }

      const usuario = results[0];

      // Usuarios sin contraseña (por ejemplo, registrados con Google):
      // bcrypt.compare fallaría, así que respondemos igual que con una clave mala
      if (!usuario.contrasena_hash) {
        return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
      }

      try {
        // Verificar la contraseña con bcrypt
        const passwordOk = await bcrypt.compare(contrasena, usuario.contrasena_hash);

        if (!passwordOk) {
          return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }

        // Generar token JWT válido por 24 horas
        const token = jwt.sign(
          { id: usuario.id_usuario, correo: usuario.correo },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({
          mensaje: '✅ Sesión iniciada correctamente',
          token,
          usuario: {
            id:     usuario.id_usuario,
            nombre: usuario.nombre,
            correo: usuario.correo,
            foto:   usuario.foto_perfil_url,
          },
        });
      } catch (err) {
        console.error('Error en el inicio de sesión:', err.message);
        res.status(500).json({ error: 'Error en el servidor' });
      }
    }
  );
};

module.exports = { registrarUsuario, iniciarSesion };