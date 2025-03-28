import { Pool } from '@neondatabase/serverless';
import { getOnlineStockList } from '../lib/request.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 10_000
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const [sh, sz] = await Promise.all([
      getOnlineStockList('SH'),
      getOnlineStockList('SZ')
    ]);
    const stockData = [...sh, ...sz];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. 创建普通临时表
      await client.query(`
        CREATE TABLE temp_stock_list (
          value TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL
        );
      `);

      // 2. 插入数据（去重）
      await client.query(`
        INSERT INTO temp_stock_list (value, name, type)
        SELECT DISTINCT ON (value) 
          val AS value, 
          nm AS name, 
          tp AS type
        FROM UNNEST($1::text[], $2::text[], $3::text[]) AS t(val, nm, tp)
        ON CONFLICT (value) DO NOTHING;
      `, [
        stockData.map(x => x.value),
        stockData.map(x => x.name),
        stockData.map(x => x.type)
      ]);

      // 3. 原子替换
      await client.query('DROP TABLE IF EXISTS stock_list');
      await client.query('ALTER TABLE temp_stock_list RENAME TO stock_list');
      await client.query('COMMIT');

      res.status(200).json({
        message: `Updated ${stockData.length} records`
      });
    } catch (err) {
      await client.query('ROLLBACK');
      await client.query('DROP TABLE IF EXISTS temp_stock_list');  // 清理
      console.error('Transaction error:', err);
      res.status(500).json({ error: 'Database Operation Failed' });
    } finally {
      client.release();
      await client.query('DROP TABLE IF EXISTS temp_stock_list');  // 二次清理
    }
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: 'Data Fetch Failed' });
  }
}