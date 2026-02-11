import { getDb } from "./db.js";
import { fetchETF } from "./fetchETF.js";
import { isTradingDay } from "./request.js";

export async function runETFJob({ force = false } = {}) {

  if (!force) {
    const trading = await isTradingDay();
    if (!trading) {
      return { ok: true, skipped: true };
    }
  }

  const list = await fetchETF();

  if (!list.length) {
    throw new Error("no etf data");
  }

  const sql = getDb();

  for (const x of list) {
    await sql`
      INSERT INTO etf_daily (
        symbol,name,current,percent,volume,amount,
        market_capital,unit_nav,premium_rate,followers,
        ts,trade_date
      )
      VALUES (
        ${x.symbol},${x.name},${x.current},${x.percent},
        ${x.volume},${x.amount},${x.market_capital},
        ${x.unit_nav},${x.premium_rate},${x.followers},
        to_timestamp(${x.timestamp}/1000.0),
        CURRENT_DATE
      )
      ON CONFLICT (symbol, trade_date)
      DO UPDATE SET
        current = EXCLUDED.current,
        percent = EXCLUDED.percent,
        volume = EXCLUDED.volume,
        amount = EXCLUDED.amount;
    `;
  }

  return { ok: true, rows: list.length };
}
