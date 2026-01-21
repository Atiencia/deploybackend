import pg, { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Verificar que las variables de entorno estén configuradas
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no está configurada en las variables de entorno');
  throw new Error('DATABASE_URL no configurada');
}

console.log('🔗 Configurando conexión a PostgreSQL...');
console.log('🔗 DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')); // Ocultar password

const pool: Pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10, // Aumentado para desarrollo local
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000, // Aumentado a 30 segundos
  allowExitOnIdle: false,
});

// Manejar errores del pool
pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de PostgreSQL:', err);
});

pool.on('connect', () => {
  console.log('✅ Nueva conexión establecida con PostgreSQL');
});

pool.on('remove', () => {
  console.log('🔌 Conexión removida del pool');
});

// Probar la conexión
(async () => {
  try {
    console.log('🧪 Probando conexión a PostgreSQL...');
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Conectado a PostgreSQL - Fecha/Hora actual:', res.rows[0]);
  } catch (err: any) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
    console.error('Código de error:', err.code);
    console.error('Stack completo:', err.stack);
  }
})();


export default pool;
