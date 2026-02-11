import { pool } from '../../lib/pool.js';

export default async (req, res) => {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { trade_date, etf_code } = req.body;

  if (!trade_date || !etf_code) {
    return res.status(400).json({
      error: 'trade_date and etf_code required'
    });
  }

  try {
    const client = await pool.connect();
    try {
      const { rowCount } = await client.query(
        `
        DELETE FROM etf_daily_record
        WHERE trade_date = $1
          AND etf_code = $2;
        `,
        [trade_date, etf_code]
      );

      res.status(200).json({
        success: true,
        deleted: rowCount
      });

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete ETF error:', err);
    res.status(500).json({
      error: 'Database error',
      details: err.message
    });
  }
};