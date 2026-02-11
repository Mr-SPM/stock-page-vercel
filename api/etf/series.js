import { pool } from '../../lib/pool.js';

function nextMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1);
  return d.toISOString().slice(0, 10);
}

export default async (req, res) => {
  const { month, symbol } = req.query;

  if (!month) {
    return res.status(400).json({ error: 'month is required (YYYY-MM)' });
  }

  const startDate = `${month}-01`;
  const endDate = nextMonth(month);

  try {
    const client = await pool.connect();

    try {

      let query = `
        SELECT
          trade_date::text AS trade_date,
          symbol,
          name,
          EXP(
            SUM(LN(1 + percent / 100.0))
            OVER (
              PARTITION BY symbol
              ORDER BY trade_date
            )
          ) - 1 AS cumulative_return
        FROM etf_daily
        WHERE trade_date >= $1
          AND trade_date < $2
      `;

      const params = [startDate, endDate];

      if (symbol) {
        query += ` AND symbol = $3 `;
        params.push(symbol);
      }

      query += ` ORDER BY symbol, trade_date;`;

      const { rows } = await client.query(query, params);

      // ==========================
      // 按 symbol 分组
      // ==========================
      const grouped = {};

      for (const row of rows) {
        if (!grouped[row.symbol]) {
          grouped[row.symbol] = {
            symbol: row.symbol,
            name: row.name,
            series: []
          };
        }

        grouped[row.symbol].series.push({
          trade_date: row.trade_date,
          cumulative_return: Number(row.cumulative_return)
        });
      }

      res.status(200).json({
        success: true,
        month,
        symbol: symbol || null,
        data: Object.values(grouped)
      });

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Query ETF series error:', err);

    res.status(500).json({
      error: 'Database error',
      details: err.message
    });
  }
};
