// ============================================================
//   HOUSELOOP BACKEND — Conexión a MySQL
//   Equivalente de JDBC en Java
// ============================================================

const mysql = require('mysql2');

// Configuración de la conexión a MySQL de XAMPP
const connection = mysql.createConnection({
  host:     'localhost',
  user:     'root',
  password: '',        // XAMPP por defecto no tiene contraseña
  database: 'houseloop'
});

// Verificar conexión
connection.connect((error) => {
  if (error) {
    console.error('Error conectando a MySQL:', error);
    return;
  }
  console.log('✅ Conectado a MySQL correctamente');
});

module.exports = connection;