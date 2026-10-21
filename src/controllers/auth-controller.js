// ============================================================
//   HOUSELOOP BACKEND — Controlador de autenticación
//   Maneja el registro e inicio de sesión de usuarios.
//   Usa bcrypt para encriptar contraseñas y JWT para sesiones.
//   Arquitectura: MVC — Capa de Control. (Recibe las solicitudes del cliente, valida la información, llama al modelo y devuelve una respuesta.)
// ============================================================

const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const connection = require('../db/connection');


const { JWT_SECRET } = require('../config/jwt');

/**
 * registrarUsuario
 * Crea un nuevo usuario en la base de datos.
 * Método HTTP: POST
 * Ruta: /auth/registro
 * Recibe: nombre, correo, contraseña — desde el cuerpo de la petición.
 * Proceso: encripta la contraseña con bcrypt antes de guardarla.
 * Respuesta: mensaje de confirmación con el ID del nuevo usuario.
 */
const registrarUsuario = async (req, res) => {
  const { nombre, correo, contrasena } = req.body;

  try {
    // Verificar si el correo ya está registrado
    connection.query(
      'SELECT id_usuario FROM usuario WHERE correo = ?',
      [correo],
      async (error, results) => {
        if (error) {
          return res.status(500).json({ error: 'Error verificando el correo' });
        }

        if (results.length > 0) {
          return res.status(400).json({ error: 'El correo ya está registrado' });
        }

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

        connection.query(query, [id_usuario, nombre, correo, hash], (error, results) => {
          if (error) {
            return res.status(500).json({ error: 'Error creando el usuario', detalle: error.message });
          }

          res.json({ mensaje: '✅ Usuario registrado correctamente', id: id_usuario });
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor', detalle: error.message });
  }
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
const iniciarSesion = async (req, res) => {
  const { correo, contrasena } = req.body;

  try {
    // Buscar el usuario por correo
    connection.query(
      'SELECT * FROM usuario WHERE correo = ?',
      [correo],
      async (error, results) => {
        if (error) {
          return res.status(500).json({ error: 'Error buscando el usuario' });
        }

        if (results.length === 0) {
          return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }

        const usuario = results[0];

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
          }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor', detalle: error.message });
  }
};
module.exports = { registrarUsuario, iniciarSesion,};