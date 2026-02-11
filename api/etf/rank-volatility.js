import { pool } from '../../lib/pool.js';

export default async (req, res) => {
  const { month, limit = 10 } = req.query;

  if (!month) {
    return res.status(400).json({ error: 'month required' });
  }

  const startDate = `${month}-01`;

  try {
    const client = await pool.connect();
    try {

      const { rows } = await client.query(
        `
        SELECT
          symbol,
          name,
          STDDEV(percent) AS volatility
        FROM etf_daily
        WHERE trade_date >= $1
        GROUP BY symbol, name
        ORDER BY volatility DESC
        LIMIT $2;
        `,
        [startDate, limit]
      );

      res.json({
        success: true,
        data: rows
      });

    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
