import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { DatePicker } from "antd";
import dayjs from "dayjs";

const { MonthPicker } = DatePicker;

interface ETFSeriesItem {
  trade_date: string;
  cumulative_return: number;
  daily_return?: number;
}

interface ETFItem {
  symbol: string;
  name: string;
  series: ETFSeriesItem[];
}

export default function ETFDashboard() {
  // ✅ 默认当月
  const currentMonth = dayjs().format("YYYY-MM");

  const [month, setMonth] = useState<string>(currentMonth);
  const [data, setData] = useState<ETFItem[]>([]);
  const [selectedETF, setSelectedETF] = useState<ETFItem | null>(null);

  // =============================
  // 获取数据
  // =============================
  useEffect(() => {
    async function fetchData() {
      const res = await fetch(`/api/etf/series?month=${month}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    }
    fetchData();
  }, [month]);

  // =============================
  // 工具函数
  // =============================
  function getLatestCumulative(series: ETFSeriesItem[]) {
    if (!series?.length) return 0;
    return series[series.length - 1].cumulative_return;
  }

  function calculateConsecutiveUp(series: ETFSeriesItem[]) {
    let count = 0;
    for (let i = series.length - 1; i >= 0; i--) {
      if ((series[i].daily_return ?? 0) > 0) count++;
      else break;
    }
    return count;
  }

  function calculateMaxDrawdown(series: ETFSeriesItem[]) {
    let peak = -Infinity;
    let maxDrawdown = 0;

    for (const item of series) {
      if (item.cumulative_return > peak) {
        peak = item.cumulative_return;
      }
      const drawdown = peak - item.cumulative_return;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    return maxDrawdown;
  }

  function calculateVolatility(series: ETFSeriesItem[]) {
    const returns = series.map(s => s.daily_return ?? 0);
    const mean =
      returns.reduce((sum, r) => sum + r, 0) / (returns.length || 1);

    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      (returns.length || 1);

    return Math.sqrt(variance);
  }

  // =============================
  // 排行榜
  // =============================
  const top5 = useMemo(() => {
    return [...data]
      .sort(
        (a, b) =>
          getLatestCumulative(b.series) -
          getLatestCumulative(a.series)
      )
      .slice(0, 5);
  }, [data]);

  const consecutiveRank = useMemo(() => {
    return [...data]
      .sort(
        (a, b) =>
          calculateConsecutiveUp(b.series) -
          calculateConsecutiveUp(a.series)
      )
      .slice(0, 5);
  }, [data]);

  const drawdownRank = useMemo(() => {
    return [...data]
      .sort(
        (a, b) =>
          calculateMaxDrawdown(a.series) -
          calculateMaxDrawdown(b.series)
      )
      .slice(0, 5);
  }, [data]);

  const volatilityRank = useMemo(() => {
    return [...data]
      .sort(
        (a, b) =>
          calculateVolatility(b.series) -
          calculateVolatility(a.series)
      )
      .slice(0, 5);
  }, [data]);

  // =============================
  // 折线图
  // =============================
  const chartOption = useMemo(() => {
    if (!selectedETF) return {};

    const dates = selectedETF.series.map(s => s.trade_date);
    const cumulative = selectedETF.series.map(s => s.cumulative_return);
    const daily = selectedETF.series.map(s => s.daily_return ?? 0);

    return {
      tooltip: { trigger: "axis" },
      legend: { data: ["累计涨幅", "单日涨跌"] },
      xAxis: { type: "category", data: dates },
      yAxis: [
        { type: "value", name: "累计涨幅" },
        { type: "value", name: "单日涨跌" },
      ],
      series: [
        { name: "累计涨幅", type: "line", data: cumulative },
        { name: "单日涨跌", type: "line", yAxisIndex: 1, data: daily },
      ],
    };
  }, [selectedETF]);

  // =============================
  // UI
  // =============================
  return (
    <div style={{ padding: 24, background: "#f5f6f8" }}>
      <h1>ETF Dashboard</h1>

      {/* ✅ antd 月份选择器 */}
      <div style={{ marginBottom: 20 }}>
        <DatePicker
          picker="month"
          value={dayjs(month)}
          onChange={(date) => {
            if (date) {
              setMonth(date.format("YYYY-MM"));
              setSelectedETF(null); // 切换月份时清空选中
            }
          }}
        />
      </div>

      {/* 排行榜区 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
        }}
      >
        <RankCard
          title="累计涨幅 Top5"
          list={top5}
          valueFn={etf => getLatestCumulative(etf.series)}
          onSelect={setSelectedETF}
        />
        <RankCard
          title="连涨天数 Top5"
          list={consecutiveRank}
          valueFn={etf => calculateConsecutiveUp(etf.series)}
          onSelect={setSelectedETF}
        />
        <RankCard
          title="最大回撤 (最小优先)"
          list={drawdownRank}
          valueFn={etf => calculateMaxDrawdown(etf.series)}
          onSelect={setSelectedETF}
        />
        <RankCard
          title="波动率 Top5"
          list={volatilityRank}
          valueFn={etf => calculateVolatility(etf.series)}
          onSelect={setSelectedETF}
        />
      </div>

      {/* 折线图区域 */}
      <div
        style={{
          marginTop: 30,
          background: "#fff",
          padding: 20,
          borderRadius: 8,
        }}
      >
        {selectedETF ? (
          <>
            <h2>
              {selectedETF.name} ({selectedETF.symbol})
            </h2>
            <ReactECharts option={chartOption} style={{ height: 400 }} />
          </>
        ) : (
          <p>点击排行榜中的 ETF 查看详情</p>
        )}
      </div>
    </div>
  );
}

// =============================
// 6️⃣ 排行榜组件
// =============================
function RankCard({
  title,
  list,
  valueFn,
  onSelect,
}: {
  title: string;
  list: ETFItem[];
  valueFn: (etf: ETFItem) => number;
  onSelect: (etf: ETFItem) => void;
}) {
  return (
    <div
      style={{
        background: "#fff",
        padding: 16,
        borderRadius: 8,
        boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
      }}
    >
      <h3>{title}</h3>
      {list.map((etf, idx) => (
        <div
          key={etf.symbol}
          style={{
            padding: "6px 0",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
          }}
          onClick={() => onSelect(etf)}
        >
          <span>
            {idx + 1}. {etf.name}
          </span>
          <span>{valueFn(etf).toFixed(4)}</span>
        </div>
      ))}
    </div>
  );
}