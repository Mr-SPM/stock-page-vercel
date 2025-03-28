import { Pool } from '@neondatabase/serverless';
import { getStockList } from '../lib/request.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const mapRes = row => ({
  ...row,
  todayAmount: (Number(row.temp_amount) / 10000).toFixed(2),
  yesterdayAmount: (Number(row.amount) / 10000).toFixed(2),
  amountIncrease: row.temp_yestclose && row.temp_yestclose !== 0
    ? (((row.temp_price - row.temp_yestclose) / row.temp_yestclose) * 100).toFixed(2)
    : '0.00', // 避免除以 0 的错误
});

export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET requests are allowed' });
  }

  // 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { isOnline } = req.query;

  try {
    if (isOnline === '1') {
      console.log('在线查询');
      const stockListResult = await pool.query('SELECT * FROM stock_list');
      const stockList = stockListResult.rows;
      const newData = await getStockList(stockList);

      if (!Array.isArray(newData) || newData.length === 0) {
        return res.status(400).json({ error: 'Expected a non-empty array' });
      }

      const insertValues = newData.flatMap(item => [item.code, parseFloat(item.amount), item.price, item.yestclose]);

      // 使用 CTE 代替临时表
      const query = `
        WITH temp_new_data AS (
          SELECT * FROM UNNEST(
            $1::TEXT[], $2::NUMERIC[], $3::NUMERIC[], $4::NUMERIC[]
          ) AS t(code, amount, price, yestclose)
        )
        SELECT h.*, 
               t.amount AS temp_amount, 
               t.price AS temp_price, 
               t.yestclose AS temp_yestclose
        FROM history h
        INNER JOIN temp_new_data t ON h.code = t.code
        WHERE h.amount * 0.09 < t.amount
        ORDER BY t.amount DESC
        LIMIT 100;
      `;

      const values = [
        newData.map(item => item.code),
        newData.map(item => parseFloat(item.amount)),
        newData.map(item => item.price),
        newData.map(item => item.yestclose),
      ];

      const result = await pool.query(query, values);
      return res.status(200).json(result.rows.map(mapRes));
    } else {
      const query = `
        WITH filtered AS (
          SELECT h.*, t.amount AS temp_amount, t.price AS temp_price, t.yestclose AS temp_yestclose
          FROM history h
          INNER JOIN temp t ON h.code = t.code
          WHERE t.amount > h.amount * 0.09
        )
        SELECT * FROM filtered
        ORDER BY temp_amount DESC
        LIMIT 100;
      `;

      const result = await pool.query(query);
      return res.status(200).json(result.rows.map(mapRes));
    }
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
