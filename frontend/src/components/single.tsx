import React from "react";
import ReactECharts from "echarts-for-react";

export default function EtfSingleChart({ data, name, symbol }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div>No Data</div>;
  }

  const dates = data.map(d => d.trade_date);
  const daily = data.map(d => d.daily_change);
  const cumulative = data.map(d => d.cumulative_return);

  const option = {
    title: {
      text: `${symbol} ${name || ""}`
    },
    tooltip: {
      trigger: "axis",
      formatter: params => {
        const date = params[0].axisValue;
        let html = `<b>${date}</b><br/>`;

        params.forEach(p => {
          if (p.seriesName === "单日涨跌幅") {
            html += `${p.seriesName}: ${p.value.toFixed(2)}%<br/>`;
          } else {
            html += `${p.seriesName}: ${(p.value * 100).toFixed(2)}%<br/>`;
          }
        });

        return html;
      }
    },
    legend: {
      data: ["单日涨跌幅", "累计涨幅"]
    },
    grid: {
      left: 40,
      right: 20,
      bottom: 40,
      top: 60
    },
    xAxis: {
      type: "category",
      data: dates
    },
    yAxis: [
      {
        type: "value",
        name: "单日涨跌幅(%)"
      },
      {
        type: "value",
        name: "累计涨幅",
        axisLabel: {
          formatter: value => (value * 100).toFixed(0) + "%"
        }
      }
    ],
    series: [
      {
        name: "单日涨跌幅",
        type: "line",
        smooth: true,
        yAxisIndex: 0,
        data: daily
      },
      {
        name: "累计涨幅",
        type: "line",
        smooth: true,
        yAxisIndex: 1,
        data: cumulative
      }
    ]
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: "500px", width: "100%" }}
    />
  );
}
