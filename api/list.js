import { Pool } from '@neondatabase/serverless';
import { getStockList, isTradingDay } from '../lib/request.js';
import { saveDailyAndUpdateStats } from '../lib/count.js';

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



  const { isOnline, count } = req.query;
  const needCount = count === '1';

  if (needCount) {
    // 交易日判断优化
    const shouldExecute = force === 'true' || (await isTradingDay());
    if (!shouldExecute) {
      return res.status(200).send([]);
    }
  }

  try {
    let newData = [];

    // 只有当 isOnline === '1' 时才从接口获取数据
    if (isOnline === '1') {
      console.log('在线查询');
      const stockListResult = await pool.query('SELECT * FROM stock_list');
      const stockList = stockListResult.rows;
      newData = await getStockList(stockList);

      if (!Array.isArray(newData) || newData.length === 0) {
        return res.status(400).json({ error: 'Expected a non-empty array' });
      }
    }

    // 查询历史数据并包含计数信息
    let query, values;

    if (isOnline === '1') {
      query = `
        WITH temp_new_data AS (
          SELECT * FROM UNNEST(
            $1::TEXT[], $2::NUMERIC[], $3::NUMERIC[], $4::NUMERIC[]
          ) AS t(code, amount, price, yestclose)
        )
        SELECT h.*, 
               t.amount AS temp_amount, 
               t.price AS temp_price, 
               t.yestclose AS temp_yestclose,
               cs.consecutive_count
        FROM history h
        INNER JOIN temp_new_data t ON h.code = t.code
        LEFT JOIN consecutive_stats cs ON h.code = cs.code
        WHERE h.amount * 0.09 < t.amount
        ORDER BY t.amount DESC
        LIMIT 100;
      `;
      values = [
        newData.map(item => item.code),
        newData.map(item => parseFloat(item.amount)),
        newData.map(item => item.price),
        newData.map(item => item.yestclose),
      ];
    } else {
      // 否则使用 history 数据
      query = `
        WITH filtered AS (
          SELECT h.*, t.amount AS temp_amount, t.price AS temp_price, t.yestclose AS temp_yestclose
          FROM history h
          INNER JOIN temp t ON h.code = t.code
          WHERE t.amount > h.amount * 0.09
        )
        SELECT f.*, cs.consecutive_count
        FROM filtered f
        LEFT JOIN consecutive_stats cs ON f.code = cs.code
        ORDER BY f.temp_amount DESC
        LIMIT 100;
      `;
      values = [];
    }

    const result = await pool.query(query, values);

    // 将查询结果进行映射处理，添加计数
    const final = result.rows.map(row => ({
      ...mapRes(row),
      consecutive_count: row.consecutive_count || 0, // 如果没有找到计数，则默认为 0
    }));

    console.log(final);

    // 需要更新计数时调用 saveDailyAndUpdateStats
    if (needCount) {
      await saveDailyAndUpdateStats(pool, final);
    }

    return res.status(200).json(final);

  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
