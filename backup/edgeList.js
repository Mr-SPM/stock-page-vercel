// 边缘计算版本
import { Pool } from "@neondatabase/serverless";
// import { getStockList } from "../lib/request.js";

const mapRes = (row) => ({
  ...row,
  todayAmount: (Number(row.temp_amount) / 10000).toFixed(2),
  yesterdayAmount: (Number(row.amount) / 10000).toFixed(2),
  amountIncrease:
    row.temp_yestclose && row.temp_yestclose !== 0
      ? (
          ((row.temp_price - row.temp_yestclose) / row.temp_yestclose) *
          100
        ).toFixed(2)
      : "0.00", // 避免除以 0 的错误
});

export default async (req, ctx) => {
  if (req.method !== "GET") {
    return new Response("Only GET requests are allowed", { headers,  status: 405 });
  }

    // 处理预检请求
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers, status: 204 });
    }

  // 设置 CORS 头
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const isOnline = new URL(req.url).searchParams.get('isOnline')

  try {

      const query = `
        WITH filtered AS (
          SELECT h.*, t.amount AS temp_amount, t.price AS temp_price, t.yestclose AS temp_yestclose
          FROM history h
          INNER JOIN temp t ON h.code = t.code
          WHERE t.amount > h.amount * 0.09
        )
        SELECT * FROM filtered
        ORDER BY temp_amount DESC
        LIMIT 100;
      `;

      const result = await pool.query(query);
      return new Response(JSON.stringify(result.rows.map(mapRes)), {
        headers: { ...headers, "content-type": "application/json" },
      });
    
  } catch (error) {
    console.error("Database error:", error);
    return new Response("Internal Server Error", { headers, status: 500 });
  } finally {
    // end the `Pool` inside the same request handler
    // (unlike `await`, `ctx.waitUntil` won't hold up the response)
    ctx.waitUntil(pool.end());
  }
};

export const config = {
  runtime: "edge",
  regions: ["iad1"], // specify the region nearest your Neon DB
};
