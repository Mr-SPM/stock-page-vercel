import pkg from 'pg';
import { getOnlineStockList } from '../lib/request.js'
const { Pool } = pkg
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // 使用环境变量存储数据库连接
    ssl: { rejectUnauthorized: false } // 适用于 Neon 或其他需要 SSL 的 PostgreSQL 服务
});

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const sh = await getOnlineStockList('SH')
    const sz = await getOnlineStockList('SZ')
    const stockData = sh.concat(sz)
    console.log(stockData.length)
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // **1. 创建表（如果不存在）**
        await client.query(`
        CREATE TABLE IF NOT EXISTS stock_list (
          value TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL
        );
      `);

        // **2. 清空表数据**
        await client.query(`TRUNCATE TABLE stock_list;`);

        // **3. 批量插入数据**
        const insertQuery = `
        INSERT INTO stock_list (name, value, type) 
        VALUES ${stockData.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(", ")}
      `;
        const values = stockData.flatMap(item => [item.name, item.value, item.type]);

        await client.query(insertQuery, values);

        await client.query('COMMIT');

        res.status(200).json({ message: 'Stock list updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Database error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    } finally {
        client.release();
    }
}