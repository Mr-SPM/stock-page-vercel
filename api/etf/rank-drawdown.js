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
        WITH cumulative AS (
          SELECT
            symbol,
            name,
            trade_date,
            EXP(
              SUM(LN(1 + percent / 100.0))
              OVER (PARTITION BY symbol ORDER BY trade_date)
            ) - 1 AS cum_return
          FROM etf_daily
          WHERE trade_date >= $1
        ),
        peak AS (
          SELECT
            symbol,
            name,
            trade_date,
            cum_return,
            MAX(cum_return)
              OVER (PARTITION BY symbol ORDER BY trade_date) AS running_max
          FROM cumulative
        )
        SELECT
          symbol,
          name,
          MIN((cum_return - running_max) / NULLIF(running_max,0)) AS max_drawdown
        FROM peak
        GROUP BY symbol, name
        ORDER BY max_drawdown ASC
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
