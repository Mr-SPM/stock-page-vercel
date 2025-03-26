import pkg from 'pg';
import { getStockList } from '../lib/request.js'

const { Client } = pkg

export default async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET requests are allowed" });
  }

  const { isOnline } = req.query

  // 连接 PostgreSQL 数据库
  const client = new Client({
    connectionString: process.env.DATABASE_URL, // 在 Vercel 环境变量中配置
    ssl: { rejectUnauthorized: false }, // Neon 需要 SSL 连接
  });

  try {
    await client.connect();
    if (isOnline === '1') {
      const stockList = await client.query('SELECT * FROM stock_list');
      const newData = await getStockList(stockList.rows)
      if (!Array.isArray(newData)) {
        return res.status(400).json({ error: "Expected an array" });
      }

      // 构建 SQL VALUES 部分
      const valuesPart = newData
        .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
        .join(", ");

      // 构建参数数组
      const values = newData.flatMap(item => [item.code, parseFloat(item.amount)]);
      

      // 构建 SQL 语句
      const query = `
      WITH new_data (code, amount) AS (
        VALUES ${valuesPart}
      )
      SELECT h.*
      FROM history h
      INNER JOIN new_data nd ON h.code = nd.code
      WHERE CAST(h.amount AS NUMERIC) * 0.09 < CAST(nd.amount AS NUMERIC)
      ORDER BY nd.amount DESC
      LIMIT 100;
    `;

      const result = await client.query(query, values);
      await client.end();

      return res.status(200).json(result.rows);
    } else {
      // 查询 temp 表中符合条件的记录
      const query = `
      SELECT temp.*
      FROM temp
      INNER JOIN history ON temp.code = history.code
      WHERE temp.amount > history.amount * 0.09
      ORDER BY temp.amount DESC
      LIMIT 100;
    `;

      const result = await client.query(query);

      await client.end();

      return res.status(200).json(result.rows);
    }
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
