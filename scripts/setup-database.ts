// scripts/setup-database.ts
import { neon } from '@neondatabase/serverless';
import 'dotenv/config'; // 支持本地 .env 文件

const sql = neon(process.env.DATABASE_URL);

async function setupDatabase() {
  try {
    console.log('Setting up database...');

    await sql`
      CREATE TABLE IF NOT EXISTS daily_data (
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        open NUMERIC,
        yestclose NUMERIC,
        price NUMERIC,
        low NUMERIC,
        high NUMERIC,
        volume NUMERIC,
        amount NUMERIC,
        date DATE NOT NULL,
        time TIMESTAMP NOT NULL,
        temp_amount NUMERIC,
        temp_price NUMERIC,
        PRIMARY KEY (code, date)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS consecutive_stats (
        code TEXT PRIMARY KEY,
        consecutive_count INT NOT NULL DEFAULT 1,
        first_appearance DATE NOT NULL,
        last_appearance DATE NOT NULL,
        last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_daily_data_code_date ON daily_data(code, date);
    `;

    console.log('✅ Database setup completed successfully.');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
  } finally {
    process.exit(0);
  }
}

setupDatabase();
