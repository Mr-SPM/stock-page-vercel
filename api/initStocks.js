import pkg from 'pg';
const { Client } = pkg;

export default async function handler(req, res) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    const result = await client.query('SELECT * FROM stock_list');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    await client.end();
  }
}