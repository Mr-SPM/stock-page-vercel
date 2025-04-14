import dayjs from 'dayjs';

export async function saveDailyAndUpdateStats(client, rows) {

  const today = dayjs().format('YYYY-MM-DD'); // 获取今天的

  if (!rows?.length || !dayjs().isSame(rows[0].date, 'D')) {
    console.log('非今日数据， 不执行更新');
    return
  }
  // 1. 保存 daily_data
  const insertDailyQuery = `
      INSERT INTO daily_data (code, name, open, yestclose, price, low, high, volume, amount, temp_amount, temp_price, date, time)
      VALUES ${rows.map(
    (_, i) =>
      `($${i * 13 + 1}, $${i * 13 + 2}, $${i * 13 + 3}, $${i * 13 + 4}, $${i * 13 + 5}, $${i * 13 + 6}, $${i * 13 + 7}, $${i * 13 + 8}, $${i * 13 + 9}, $${i * 13 + 10}, $${i * 13 + 11}, $${i * 13 + 12}, $${i * 13 + 13})`
  ).join(',')}
      ON CONFLICT (code, date) DO NOTHING
    `;

  // 组装 daily_data 插入值，注意这个顺序：code, name, open, yestclose, price, low, high, volume, amount, temp_amount, temp_price, date, time
  const dailyValues = rows.flatMap(row => [
    row.code,
    row.name || '',
    row.open,
    row.yestclose,
    row.price,
    row.low,
    row.high,
    row.volume,
    row.amount,
    row.temp_amount,
    row.temp_price,
    dayjs(row.date).format('YYYY-MM-DD'),  // 提取并格式化日期部分
    dayjs(row.time).format('YYYY-MM-DD HH:mm:ss') // 提取并格式化时间部分
  ]);

  await client.query(insertDailyQuery, dailyValues);

  // 2. 更新 consecutive_stats
  for (const row of rows) {
    const { code } = row;

    // 查找是否已有统计
    const statRes = await client.query('SELECT * FROM consecutive_stats WHERE code = $1', [code]);

    if (statRes.rowCount > 0) {
      const stat = statRes.rows[0];

      if (stat.last_appearance !== today) {
        await client.query(
          `UPDATE consecutive_stats 
             SET consecutive_count = consecutive_count + 1,
                 last_appearance = $1,
                 last_update = NOW()
             WHERE code = $2`,
          [today, code]
        );
      }
    } else {
      await client.query(
        `INSERT INTO consecutive_stats (code, consecutive_count, first_appearance, last_appearance)
           VALUES ($1, 1, $2, $2)`,
        [code, today]
      );
    }
  }
}
