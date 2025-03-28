import { Pool } from '@neondatabase/serverless';
import { getStockList, isTradingDay } from '../lib/request.js';

// Serverless 优化配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,  // 适应 Serverless 瞬时特性
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 3_000
});

// 表名白名单验证
const ALLOWED_TABLES = new Set(['history', 'temp']);

export default async (req, res) => {
  const { isTemp, force } = req.query;
  const tableName = isTemp ? 'temp' : 'history';
  
  // 验证表名安全性
  if (!ALLOWED_TABLES.has(tableName)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  try {
    const client = await pool.connect();
    try {
      // 交易日判断优化
      const shouldExecute = force === 'true' || (await isTradingDay());
      if (!shouldExecute) {
        return res.status(200).send('非交易日，不执行任务');
      }

      // 获取股票基础数据
      const { rows: stockList } = await client.query('SELECT * FROM stock_list');
      const marketData = await getStockList(stockList);
      
      if (!Array.isArray(marketData)) {
        return res.status(400).json({ error: "Invalid data format" });
      }

      await client.query('BEGIN');

      // 使用原子表替换方案
      const tempTable = `${tableName}_new`;
      const backupTable = `${tableName}_old`;

      // 1. 创建新表（带索引）
      await client.query(`
        CREATE TABLE ${tempTable} (
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
          time TIMESTAMPTZ NOT NULL
        );
      `);

      // 2. 批量插入优化（使用 UNNEST）
      await client.query(`
        INSERT INTO ${tempTable} (
          code, name, open, yestclose, price, 
          low, high, volume, amount, date, time
        )
        SELECT * FROM UNNEST(
          $1::text[], $2::text[], $3::numeric[], 
          $4::numeric[], $5::numeric[], $6::numeric[],
          $7::numeric[], $8::numeric[], $9::numeric[],
          $10::date[], $11::timestamptz[]
        )
      `, [
        marketData.map(x => x.code),
        marketData.map(x => x.name),
        marketData.map(x => x.open),
        marketData.map(x => x.yestclose),
        marketData.map(x => x.price),
        marketData.map(x => x.low),
        marketData.map(x => x.high),
        marketData.map(x => x.volume),
        marketData.map(x => x.amount),
        marketData.map(x => x.date),
        marketData.map(x => x.time)
      ]);

      // 3. 原子切换表
      await client.query(`
        DROP TABLE IF EXISTS ${backupTable};
        ALTER TABLE IF EXISTS ${tableName} RENAME TO ${backupTable};
        ALTER TABLE ${tempTable} RENAME TO ${tableName};
      `);

      await client.query('COMMIT');

      res.status(200).json({ 
        success: true,
        updated: marketData.length,
        backup: backupTable
      });

    } catch (err) {
      await client.query('ROLLBACK');
      // 清理临时表
      await client.query(`DROP TABLE IF EXISTS ${tempTable}`);
      console.error('Transaction error:', err);
      res.status(500).json({ 
        error: 'Operation failed',
        details: err.message 
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('System error:', err);
    res.status(500).json({ 
      error: 'System error',
      details: err.message 
    });
  }
};