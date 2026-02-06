import { pool } from '../../lib/pool.js';

function nextMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1);
  return d.toISOString().slice(0, 10);
}

export default async (req, res) => {
  const { month } = req.query;

  if (!month) {
    return res.status(400).json({ error: 'month is required (YYYY-MM)' });
  }

  const startDate = `${month}-01`;
  const endDate = nextMonth(month);

  try {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `
        SELECT
          trade_date::text AS trade_date,
          etf_code,
          etf_name,
          change_percent
        FROM etf_daily_record
        WHERE trade_date >= $1
          AND trade_date < $2
        ORDER BY trade_date ASC;
        `,
        [startDate, endDate]
      );

      const grouped = {};
      for (const row of rows) {
        const dateKey = row.trade_date; // 已是 YYYY-MM-DD
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(row);
      }

      res.status(200).json({
        success: true,
        month,
        data: grouped
      });

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Query ETF month error:', err);
    res.status(500).json({
      error: 'Database error',
      details: err.message
    });
  }
};
