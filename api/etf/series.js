import { pool } from '../../lib/pool.js';

function getMonthRange(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const end = new Date(y, m, 1).toISOString().slice(0, 10);
  return { start, end };
}

export default async (req, res) => {
  const { date, etf_code } = req.query;

  if (!date || !etf_code) {
    return res.status(400).json({
      error: 'date and etf_code are required'
    });
  }

  const { start, end } = getMonthRange(date);

  try {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `
        SELECT
          trade_date::text AS trade_date,
          change_percent
        FROM etf_daily_record
        WHERE etf_code = $1
          AND trade_date >= $2
          AND trade_date < $3
        ORDER BY trade_date ASC;
        `,
        [etf_code, start, end]
      );

      res.status(200).json({
        success: true,
        etf_code,
        range: { start, end },
        data: rows
      });

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('ETF series error:', err);
    res.status(500).json({
      error: 'Database error',
      details: err.message
    });
  }
};
