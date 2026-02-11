import React from "react";
import ReactECharts from "echarts-for-react";

export default function MonthlyEtfChart({ data }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div>No Data</div>;
  }

  // 1️⃣ 收集所有日期（X轴）
  const dateSet = new Set();

  data.forEach(item => {
    if (Array.isArray(item.series)) {
      item.series.forEach(d => {
        if (d?.trade_date) {
          dateSet.add(d.trade_date);
        }
      });
    }
  });

  const allDates = Array.from(dateSet).sort();

  // 2️⃣ 构建折线
  const series = data.map(item => {
    const dateMap = {};

    if (Array.isArray(item.series)) {
      item.series.forEach(d => {
        dateMap[d.trade_date] = d.cumulative_return;
      });
    }

    return {
      name: `${item.symbol} ${item.name}`,
      type: "line",
      smooth: true,
      showSymbol: false,
      connectNulls: false,
      data: allDates.map(date =>
        dateMap[date] !== undefined ? dateMap[date] : null
      )
    };
  });

  const option = {
    tooltip: {
      trigger: "axis",
      valueFormatter: value =>
        value != null ? (value * 100).toFixed(2) + "%" : "-"
    },
    legend: {
      type: "scroll"
    },
    grid: {
      left: 40,
      right: 20,
      bottom: 40,
      top: 60
    },
    xAxis: {
      type: "category",
      data: allDates
    },
    yAxis: {
      type: "value",
      name: "累计涨幅",
      axisLabel: {
        formatter: value => (value * 100).toFixed(0) + "%"
      }
    },
    series
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: "600px", width: "100%" }}
    />
  );
}
