const mysql = require('mysql2');

// Pool de conexiones: reutiliza conexiones y se recupera solo si MySQL
// cierra alguna por inactividad (lo que pasa en la nube).
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'houseloop',
  waitForConnections: true,
  // Máximo de conexiones abiertas a la vez. El plan gratis de Aiven limita las
  // conexiones, así que se usa un número pequeño (5 alcanza para poco tráfico).
  connectionLimit: 5,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Las bases en la nube (Aiven, etc.) exigen SSL: DB_SSL=true en sus variables
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

// Verifica la conexión al iniciar
pool.getConnection((error, conn) => {
  if (error) {
    console.error('❌ Error conectando a MySQL:', error.message);
    return;
  }
  console.log('✅ Conectado a MySQL correctamente');
  conn.release();
});

module.exports = pool;