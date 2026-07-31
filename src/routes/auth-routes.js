// ============================================================
//   HOUSELOOP BACKEND — Rutas de autenticación
//   Define los endpoints para registro e inicio de sesión.
//   Arquitectura: MVC — Capa de Rutas
// ============================================================

const express = require('express');
const router  = express.Router();

// Importa los métodos del controlador de autenticación que gestionan
// el registro de usuarios y la validación de credenciales para el inicio de sesión. 
//los metodos son los que se declararon en el archivo auth-controller.js y son registrarUsuario, iniciarSesion. 
const { registrarUsuario, iniciarSesion,} = require('../controllers/auth-controller');

// POST /auth/registro
// Crea un nuevo usuario (nombre, correo, contrasena en el body)
// Define la ruta para registrar un nuevo usuario. ejemplo de una ruta completa: POST http://localhost:3000/registro
router.post('/registro', registrarUsuario);

// Asocia la ruta POST /login con la función iniciarSesion,
// la cual recibe las credenciales del usuario, verifica su
// existencia en la base de datos, valida la contraseña y,
// si son correctas, genera un token de autenticación (JWT).
// POST /auth/login
// Verifica credenciales y devuelve un token JWT (JSON Web Token.)
router.post('/login', iniciarSesion);

module.exports = router;