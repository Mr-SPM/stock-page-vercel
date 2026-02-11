import { pool } from '../../lib/pool.js';

export default async (req, res) => {
  const { limit = 10 } = req.query;

  try {
    const client = await pool.connect();
    try {

      const { rows } = await client.query(
        `
        WITH ordered AS (
          SELECT
            symbol,
            name,
            trade_date,
            percent,
            ROW_NUMBER() OVER (
              PARTITION BY symbol
              ORDER BY trade_date DESC
            ) AS rn
          FROM etf_daily
        ),
        break_point AS (
          SELECT
            symbol,
            MIN(rn) AS stop_rn
          FROM ordered
          WHERE percent <= 0
          GROUP BY symbol
        )
        SELECT
          o.symbol,
          o.name,
          COALESCE(bp.stop_rn - 1, COUNT(o.*)) AS streak_days
        FROM ordered o
        LEFT JOIN break_point bp
          ON o.symbol = bp.symbol
        WHERE o.rn <= COALESCE(bp.stop_rn - 1, 9999)
        GROUP BY o.symbol, o.name, bp.stop_rn
        ORDER BY streak_days DESC
        LIMIT $1;
        `,
        [limit]
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
