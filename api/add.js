import pkg from 'pg';
import { getStockList } from '../lib/request.js'
import utils from '../lib/utils.js'

const { isTradingDay } = utils

const { Pool } = pkg
// Neon PostgreSQL 连接信息

const pool = new Pool({

    connectionString: process.env.DATABASE_URL, // 在Vercel环境变量中配置 DATABASE_URL 

    ssl: { rejectUnauthorized: false }, // Neon 需要 SSL 

});


export default async (req, res) => {
    const { isTemp, force } = req.query
    const client = await pool.connect();
    const tableName = isTemp ? 'temp' : 'history'
    let flag = force
    if (!force) {
        flag = await isTradingDay()
    }
    if (flag) {
        try {
            await client.query("BEGIN");

            const result = await client.query('SELECT * FROM stock_list');
            const data = await getStockList(result.rows)
            if (!Array.isArray(data)) {
                return res.status(400).json({ error: "Expected an array" });
            }
            // 创建表（如果不存在） 
            await client.query(`CREATE TABLE IF NOT EXISTS ${tableName} (
          code TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          open NUMERIC(10, 2),
          yestclose NUMERIC(10, 2),
          price NUMERIC(10, 2),
          low NUMERIC(10, 2),
          high NUMERIC(10, 2),
          volume NUMERIC(15, 2),
          amount NUMERIC(20, 2),
          date DATE NOT NULL,
          time TIMESTAMP NOT NULL
      );`);
            // 清空表数据 
            await client.query(`TRUNCATE TABLE ${tableName}`);
            // 批量插入数据 
            const insertQuery = ` 

      INSERT INTO ${tableName} (code, name, open, yestclose, price, low, high, volume, amount, date, time) 

      VALUES ${data

                    .map(

                        (_, i) =>

                            `($${i * 11 + 1}, $${i * 11 + 2}, $${i * 11 + 3}, $${i * 11 + 4}, $${i * 11 + 5}, $${i * 11 + 6}, $${i * 11 + 7}, $${i * 11 + 8}, $${i * 11 + 9}, $${i * 11 + 10}, $${i * 11 + 11})`

                    )

                    .join(",")} 

    `;
            const values = data.reduce((acc, item) => {
                acc.push(
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
                    item.time
                );
                return acc;
            }, []);
            await client.query(insertQuery, values);
            await client.query("COMMIT");

            res.status(200).json({ success: true, message: "Data inserted successfully" });

        } catch (error) {

            await client.query("ROLLBACK");

            res.status(500).json({ error: "Database error", details: error.message });

        } finally {

            client.release();

        }
    } else {
        res.status(200).send('非交易日,不执行任务')
    }


}; 