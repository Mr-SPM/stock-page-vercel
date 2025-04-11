import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const data = req.body;

  if (!Array.isArray(data)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }

  const today = data[0]?.date?.split('T')[0]; // 获取今天的日期
  if (!today) {
    return res.status(400).json({ error: 'Missing trading date' });
  }

  try {
    // Step 1: 插入 daily_data 表（记录所有数据）
    const insertValues = data.map(
      (item, i) =>
        `($${i * 13 + 1}, $${i * 13 + 2}, $${i * 13 + 3}, $${i * 13 + 4}, $${i * 13 + 5}, $${i * 13 + 6}, $${i * 13 + 7}, $${i * 13 + 8}, $${i * 13 + 9}, $${i * 13 + 10}, $${i * 13 + 11}, $${i * 13 + 12}, $${i * 13 + 13})`
    ).join(', ');

    const values = data.flatMap(item => [
      item.code,
      item.name,
      item.open,
      item.yestclose,
      item.price,
      item.low,
      item.high,
      item.volume,
      item.amount,
      item.date,
      item.time,
      item.temp_amount,
      item.temp_price
    ]);

    await sql.query(
      `
      INSERT INTO daily_data (code, name, open, yestclose, price, low, high, volume, amount, date, time, temp_amount, temp_price)
      VALUES ${insertValues}
      ON CONFLICT (code, date) DO NOTHING
      `,
      values
    );

    // Step 2: 更新 consecutive_stats 表

    // 2.1 获取昨日的 code 集合
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yestStr = yesterday.toISOString().split('T')[0];

    const yesterdayCodesResult = await sql.query(
      `SELECT code FROM daily_data WHERE date = $1`,
      [yestStr]
    );
    const yesterdayCodes = new Set(yesterdayCodesResult.rows.map(row => row.code));

    // 2.2 获取今天的 code 集合
    const todayCodes = new Set(data.map(item => item.code));

    // 2.3 更新逻辑
    for (const item of data) {
      const code = item.code;

      if (yesterdayCodes.has(code)) {
        // 已连续
        await sql.query(
          `INSERT INTO consecutive_stats (code, consecutive_count, first_appearance, last_appearance)
           VALUES ($1, 1, $2, $2)
           ON CONFLICT (code) DO UPDATE SET
             consecutive_count = consecutive_stats.consecutive_count + 1,
             last_appearance = $2,
             last_update = NOW()`,
          [code, today]
        );
      } else {
        // 新记录或重新出现
        await sql.query(
          `INSERT INTO consecutive_stats (code, consecutive_count, first_appearance, last_appearance, last_update)
           VALUES ($1, 1, $2, $2, NOW())
           ON CONFLICT (code) DO UPDATE SET
             consecutive_count = 1,
             first_appearance = $2,
             last_appearance = $2,
             last_update = NOW()`,
          [code, today]
        );
      }
    }

    // 2.4 删除今天不存在但昨天存在的 code（视需求决定是否保留）
    const todayCodeList = Array.from(todayCodes);
    await sql.query(
      `DELETE FROM consecutive_stats WHERE code NOT IN (${todayCodeList.map((_, i) => `$${i + 1}`).join(', ')})`,
      todayCodeList
    );

    res.status(200).json({ message: 'Data stored and stats updated' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
