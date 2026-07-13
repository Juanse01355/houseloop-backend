// ============================================================
//   HOUSELOOP BACKEND — Conexión a MySQL
//   Usa las variables de entorno del archivo .env
//   para conectarse a la base de datos de XAMPP.
//   Equivalente de JDBC en Java.
// ============================================================

const mysql = require('mysql2');

// Configuración de la conexión usando variables de entorno
// Si el .env no tiene el valor, usa el valor por defecto
const connection = mysql.createConnection({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'houseloop',
});

// Verificar conexión al iniciar el servidor
connection.connect((error) => {
  if (error) {
    console.error('❌ Error conectando a MySQL:', error);
    return;
  }
  console.log('✅ Conectado a MySQL correctamente');
});

module.exports = connection;