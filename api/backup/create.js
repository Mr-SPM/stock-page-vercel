import { pool } from '../../lib/pool.js';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    trade_date,
    etf_code,
    etf_name,
    change_percent
  } = req.body;

  if (!trade_date || !etf_code || change_percent === undefined) {
    return res.status(400).json({
      error: 'trade_date, etf_code, change_percent are required'
    });
  }

  try {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `
        INSERT INTO etf_daily_record
          (trade_date, etf_code, etf_name, change_percent)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (trade_date, etf_code)
        DO UPDATE SET
          etf_name = EXCLUDED.etf_name,
          change_percent = EXCLUDED.change_percent
        RETURNING *;
        `,
        [trade_date, etf_code, etf_name ?? null, change_percent]
      );

      res.status(200).json({
        success: true,
        data: rows[0]
      });

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create ETF error:', err);
    res.status(500).json({
      error: 'Database error',
      details: err.message
    });
  }
};
