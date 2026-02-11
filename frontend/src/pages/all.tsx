import React, { useEffect, useState } from 'react';
import EtfSeriesChart from '../components/charts';
import Top5Ranking from "../components/ranking";
import { useParams } from 'umi';

function getTop5Etf(data) {
  if (!Array.isArray(data)) return [];

  const result = [];

  for (const item of data) {
    if (!Array.isArray(item.series) || item.series.length === 0) {
      continue;
    }

    // 取最后一个交易日的累计收益
    const last = item.series[item.series.length - 1];

    result.push({
      symbol: item.symbol,
      name: item.name,
      cumulative_return: last.cumulative_return
    });
  }

  return result
    .sort((a, b) => b.cumulative_return - a.cumulative_return)
    .slice(0, 5);
}

export default function Page() {
  const [seriesData, setSeriesData] = useState(null);
    const params = useParams()
  useEffect(() => {
    fetch(`/api/etf/series?month=${params.month}`)
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setSeriesData(res.data);
        }
      });
  }, []);

  const top5 = getTop5Etf(seriesData);

  return (
    <>
      <Top5Ranking data={top5} />
      {seriesData && (
        <EtfSeriesChart data={seriesData} />
      )}
    </>
  );
}
