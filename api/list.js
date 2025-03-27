import pkg from 'pg';
import { getStockList } from '../lib/request.js'

const { Client } = pkg

const mapRes = row => ({
  ...row,
  todayAmount: (row.temp_amount / 10000).toFixed(2),
  yesterdayAmount: (row.amount / 10000).toFixed(2),
  amountIncrease: (((row.temp_price - row.temp_yestclose) / row.temp_yestclose) * 100).toFixed(2)
})

export default async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET requests are allowed" });
  }

  // 允许 Cloudflare Pages 访问
  res.setHeader("Access-Control-Allow-Origin", "*"); // 允许所有域（不安全）
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); // 允许的方法
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const { isOnline } = req.query

  // 连接 PostgreSQL 数据库
  const client = new Client({
    connectionString: process.env.DATABASE_URL, // 在 Vercel 环境变量中配置
    ssl: { rejectUnauthorized: false }, // Neon 需要 SSL 连接
  });

  try {
    await client.connect();
    if (isOnline === '1') {
      console.log('在线查询')
      const stockList = await client.query('SELECT * FROM stock_list');
      const newData = await getStockList(stockList.rows)
      if (!Array.isArray(newData)) {
        return res.status(400).json({ error: "Expected an array" });
      }

      // 构建 SQL VALUES 部分
      const valuesPart = newData
        .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
        .join(", ");

      // 构建参数数组
      const values = newData.flatMap(item => [item.code, parseFloat(item.amount), item.price, item.yestclose]);

      // 构建 SQL 语句
      const query = `
  WITH new_data (code, amount, price, yestclose) AS (
    VALUES ${valuesPart}
  )
  SELECT h.*, nd.amount AS temp_amount, nd.price AS temp_price, nd.yestclose AS temp_yestclose
  FROM history h
  INNER JOIN new_data nd ON h.code = nd.code
  WHERE h.amount * 0.09 < CAST(nd.amount AS NUMERIC)
  ORDER BY nd.amount DESC
  LIMIT 100;
`;


      const result = await client.query(query, values);
      await client.end();

      return res.status(200).json(result.rows.map(mapRes));
    } else {
      // 查询 temp 表中符合条件的记录
      const query = `
      SELECT h.*, t.amount AS temp_amount, t.price AS temp_price, t.yestclose AS temp_yestclose
      FROM history h
      INNER JOIN temp t ON h.code = t.code
      WHERE t.amount::NUMERIC > h.amount::NUMERIC * 0.09
      ORDER BY h.amount DESC
      LIMIT 100;
    `;

      const result = await client.query(query);

      await client.end();

      return res.status(200).json(result.rows.map(mapRes));
    }
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
