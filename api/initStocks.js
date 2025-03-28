import { Pool } from '@neondatabase/serverless';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 10_000
});

export default async function handler(req, res) {
  try {
    // 使用 pool.query() 直接查询数据库
    const result = await pool.query('SELECT * FROM stock_list');
    
    // 返回查询结果
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
