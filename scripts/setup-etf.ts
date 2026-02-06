// scripts/setup-database.ts
import { neon } from '@neondatabase/serverless';
import 'dotenv/config'; // 支持本地 .env 文件

const sql = neon(process.env.DATABASE_URL);

async function setupDatabase() {
  try {
    console.log('Setting up database...');

    await sql`
     CREATE TABLE etf_daily_record (
    id BIGSERIAL PRIMARY KEY,
    trade_date DATE NOT NULL,
    etf_code VARCHAR(20) NOT NULL,
    etf_name VARCHAR(100),
    change_percent NUMERIC(6,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT etf_daily_unique UNIQUE (trade_date, etf_code)
);
    `;

    await sql`
      CREATE INDEX idx_etf_trade_date 
ON etf_daily_record(trade_date);
    `;

    await sql`
    CREATE INDEX idx_etf_code 
ON etf_daily_record(etf_code);
    `


    console.log('✅ etf Database setup completed successfully.');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
  } finally {
    process.exit(0);
  }
}

setupDatabase();
