import pg, { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool: Pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1, // Optimizado para Vercel serverless
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Probar la conexión
(async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Conectado a PostgreSQL - Fecha/Hora actual:', res.rows[0]);
  } catch (err: any) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
    console.log(err)
  }
})();


export default pool;
