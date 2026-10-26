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

// ── Límites y reglas (deben ser iguales a las de la pantalla de crear cuenta) ──
const LIMITES = {
  nombre:     { min: 2, max: 30 },
  correo:     { max: 60 },
  contrasena: { min: 8, max: 32 },
};

// Nombre: solo letras (con tildes, ñ y ü) y un solo espacio entre palabras
const LETRAS = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
const NOMBRE_REGEX = new RegExp(`^[${LETRAS}]+( [${LETRAS}]+)*$`);

// Correo: parte antes de la @ (letras y números separados por un solo . _ + o -)
const CORREO_LOCAL_REGEX = /^[A-Za-z0-9]+([._+-][A-Za-z0-9]+)*$/;
// Correo: parte después de la @ (dominio con punto y terminación de solo letras)
const CORREO_DOMINIO_REGEX = /^([A-Za-z0-9]+(-[A-Za-z0-9]+)*\.)+[A-Za-z]{2,}$/;

// Contraseña: solo caracteres visibles del teclado (sin espacios ni tildes)
const CONTRASENA_CARACTERES_REGEX = /^[\x21-\x7E]+$/;

// Devuelve true si el correo tiene un formato válido
const correoValido = (correo) => {
  const partes = correo.split('@');
  if (partes.length !== 2) return false;
  const [local, dominio] = partes;
  return CORREO_LOCAL_REGEX.test(local) && CORREO_DOMINIO_REGEX.test(dominio);
};

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

  // Quitar espacios sobrantes al inicio y al final; el correo se guarda en minúsculas
  const nombreLimpio = nombre.trim();
  const correoLimpio = correo.trim().toLowerCase();

  // ── Nombre ──
  if (nombreLimpio.length < LIMITES.nombre.min || nombreLimpio.length > LIMITES.nombre.max) {
    return res.status(400).json({
      error: `El nombre debe tener entre ${LIMITES.nombre.min} y ${LIMITES.nombre.max} caracteres`,
    });
  }
  if (!NOMBRE_REGEX.test(nombreLimpio)) {
    return res.status(400).json({
      error: 'El nombre solo puede tener letras y un espacio entre palabras',
    });
  }

  // ── Correo ──
  if (correoLimpio.length > LIMITES.correo.max || !correoValido(correoLimpio)) {
    return res.status(400).json({ error: 'El correo no tiene un formato válido' });
  }

  // ── Contraseña ──
  // (bcrypt solo usa los primeros 72 bytes; el máximo evita gastar CPU en vano)
  if (contrasena.length < LIMITES.contrasena.min || contrasena.length > LIMITES.contrasena.max) {
    return res.status(400).json({
      error: `La contraseña debe tener entre ${LIMITES.contrasena.min} y ${LIMITES.contrasena.max} caracteres`,
    });
  }
  if (!CONTRASENA_CARACTERES_REGEX.test(contrasena)) {
    return res.status(400).json({
      error: 'La contraseña solo puede tener letras, números y símbolos del teclado, sin espacios',
    });
  }
  if (!/[A-Z]/.test(contrasena) || !/[a-z]/.test(contrasena) || !/[0-9]/.test(contrasena)) {
    return res.status(400).json({
      error: 'La contraseña debe tener al menos una mayúscula, una minúscula y un número',
    });
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

  // Tope de largo: ningún usuario real tiene datos más largos que esto
  // (no se aplican las reglas nuevas aquí para no dejar fuera a usuarios ya registrados)
  if (correo.length > 250 || contrasena.length > 72) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
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

      // Usuarios sin contraseña guardada: bcrypt.compare fallaría,
      // así que respondemos igual que con una clave mala
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