const API =
  "https://stock.xueqiu.com/v5/stock/screener/fund/list.json?page=1&size=100&order=desc&order_by=percent&type=18&parent_type=1";

export async function fetchETF() {
  const res = await fetch(API, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://xueqiu.com/",
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "Cookie": process.env.XQ_COOKIE,
    }
  });

  if (!res.ok) {
    throw new Error("xueqiu fetch failed " + res.status);
  }

  const json = await res.json();
  return json?.data?.list ?? [];
}
