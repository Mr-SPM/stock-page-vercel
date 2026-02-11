import { pool } from '../../lib/pool.js';

function nextMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1);
  return d.toISOString().slice(0, 10);
}

export default async (req, res) => {
  const { month, symbol } = req.query;

  if (!month || !symbol) {
    return res.status(400).json({
      error: 'month and symbol are required (YYYY-MM)'
    });
  }

  const startDate = `${month}-01`;
  const endDate = nextMonth(month);

  try {
    const client = await pool.connect();
    try {

      const { rows } = await client.query(
        `
        SELECT
          trade_date::text,
          symbol,
          name,
          percent,
          EXP(
            SUM(LN(1 + percent / 100.0))
            OVER (
              ORDER BY trade_date
            )
          ) - 1 AS cumulative_return
        FROM etf_daily
        WHERE trade_date >= $1
          AND trade_date < $2
          AND symbol = $3
        ORDER BY trade_date ASC;
        `,
        [startDate, endDate, symbol]
      );

      res.status(200).json({
        success: true,
        month,
        symbol,
        name: rows.length ? rows[0].name : null,
        data: rows.map(r => ({
          trade_date: r.trade_date,
          daily_change: Number(r.percent),
          cumulative_return: Number(r.cumulative_return)
        }))
      });

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('ETF single series error:', err);
    res.status(500).json({
      error: 'Database error',
      details: err.message
    });
  }
};
