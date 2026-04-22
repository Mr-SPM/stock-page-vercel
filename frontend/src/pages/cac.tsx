import React, { useState, useEffect, useMemo } from "react";
import {
  Card, Button, Input, InputNumber, Space,
  Tag, Typography, Modal, Tooltip,
  Row, Col, Statistic, Divider, Flex
} from "antd";
import ReactECharts from "echarts-for-react";

const { Title, Text } = Typography;
const STORAGE_KEY = "investment-pro";

function getRealtimeSignal(days, today, mode = "BASE") {
  const MAX_POSITION = 80000;

  const prev = simulateStrategy(days, mode);
  const next = simulateStrategy([...days, today], mode);

  const prevPosition =
    prev.positionCurve[prev.positionCurve.length - 1] || 0;

  const nextPosition =
    next.positionCurve[next.positionCurve.length - 1] || 0;

  const change = nextPosition - prevPosition;

  let action = "HOLD";

  if (change > 0) action = "ADD";
  else if (change < 0) action = "REDUCE";

  if (nextPosition === 0 && prevPosition > 0) {
    action = "EXIT";
  }

  // ===== 仓位百分比 =====
  const positionPct = Math.round((nextPosition / MAX_POSITION) * 100);

  // ===== 风险等级 =====
  let risk = "低";

  if (positionPct > 70) risk = "高";
  else if (positionPct > 30) risk = "中";

  // ===== drawdown（真实风险）=====
  const dd =
    next.drawdownCurve[next.drawdownCurve.length - 1] || 0;

  if (dd < -5) risk = "高";
  else if (dd < -2) risk = "中";

  return {
    action,
    changeAmount: Math.abs(Math.round(change)),
    positionAfter: Math.round(nextPosition),
    positionPct,
    risk,
    profit: Math.round(next.profit),
    finalAsset: Math.round(next.finalAsset)
  };
}

function getDualAxisOption(days, mode = "BASE") {
  const res = simulateStrategy(days, mode);

  const xData = res.assetCurve.map((_, i) => `Day ${i + 1}`);

  return {
    tooltip: { trigger: "axis" },
    legend: {
      data: ["总资产", "利润", "基准", "仓位", "投入", "回撤"]
    },
    xAxis: { type: "category", data: xData },
    yAxis: [
      { type: "value" },
      {
        type: "value",
        axisLabel: { formatter: "{value}%" }
      }
    ],
    series: [
      {
        name: "总资产",
        type: "line",
        data: res.assetCurve,
        markPoint: {
          data: [
            ...res.buyPoints.map(p => ({ ...p, itemStyle: { color: "green" } })),
            ...res.sellPoints.map(p => ({ ...p, itemStyle: { color: "red" } }))
          ]
        }
      },
      { name: "利润", type: "line", data: res.profitCurve },
      {
        name: "基准",
        type: "line",
        data: res.benchmarkCurve,
        lineStyle: { type: "dashed" }
      },
      { name: "仓位", type: "line", data: res.positionCurve },
      { name: "投入", type: "line", data: res.investedCurve },
      {
        name: "回撤",
        type: "line",
        data: res.drawdownCurve,
        yAxisIndex: 1,
        areaStyle: {}
      }
    ]
  };
}

/**
 * ============================
 * 核心策略引擎（统一）
 * ============================
 */
function simulateStrategy(days, mode = "BASE") {
  let price = 100;

  let position = 10000;
  let cash = 0;
  let totalInvested = 10000;

  const MAX_POSITION = 80000;

  let peakPrice = 100;
  let peakAsset = 10000;

  const assetCurve = [];
  const positionCurve = [];
  const investedCurve = [];
  const profitCurve = [];
  const benchmarkCurve = [];
  const drawdownCurve = [];

  const buyPoints = [];
  const sellPoints = [];

  for (let i = 0; i < days.length; i++) {
    const r = Number(days[i]);
    if (isNaN(r)) continue;

    // ===== 价格 =====
    price *= (1 + r / 100);
    peakPrice = Math.max(peakPrice, price);

    const drawdown = (price - peakPrice) / peakPrice;

    // ===== 持仓变化 =====
    position *= (1 + r / 100);

    let action = "HOLD";
    let changeAmount = 0;

    // =====================
    // 减仓（优先）
    // =====================
    if (drawdown < -0.06) {
      changeAmount = -position;
      cash += position;
      position = 0;
      action = "EXIT";
    } else if (drawdown < -0.03) {
      changeAmount = -position * 0.5;
      position *= 0.5;
      cash += -changeAmount;
      action = "REDUCE";
    }

    // =====================
    // 加仓（必须 else，避免同一天反复横跳）
    // =====================
    else {
      const recent = days.slice(Math.max(0, i - 2), i + 1)
        .map(Number)
        .filter(v => !isNaN(v));

      const recentSum = recent.reduce((a, b) => a + b, 0);

      if (mode === "BASE") {
        // ===== 原始策略（趋势追涨）
        if (r > 0 && drawdown > -0.02 && position < MAX_POSITION) {
          const add = Math.min(
            10000 * (1 - position / MAX_POSITION),
            MAX_POSITION - position
          );
          if (add > 1000) {
            position += add;
            totalInvested += add;
            changeAmount = add;
            action = "ADD";
          }
        }
      } else {
        // ===== PRO策略（更稳健）
        const hasPullback = recent.some(v => v < 0);

        if (
          recentSum > 1 &&
          hasPullback &&
          r > 0 &&
          drawdown > -0.03 &&
          position < MAX_POSITION
        ) {
          const add = Math.min(
            8000 * (1 - position / MAX_POSITION),
            MAX_POSITION - position
          );
          if (add > 1000) {
            position += add;
            totalInvested += add;
            changeAmount = add;
            action = "ADD";
          }
        }
      }
    }

    const totalAsset = position + cash;

    // ===== 回撤 =====
    peakAsset = Math.max(peakAsset, totalAsset);
    const dd = (totalAsset - peakAsset) / peakAsset;

    const benchmark = 10000 * (price / 100);

    // ===== 曲线 =====
    assetCurve.push(Math.round(totalAsset));
    positionCurve.push(Math.round(position));
    investedCurve.push(Math.round(totalInvested));
    profitCurve.push(Math.round(totalAsset - totalInvested));
    benchmarkCurve.push(Math.round(benchmark));
    drawdownCurve.push((dd * 100).toFixed(2));

    // ===== 标记点 =====
    if (action === "ADD") {
      buyPoints.push({
        coord: [`Day ${i + 1}`, Math.round(totalAsset)],
        value: "加"
      });
    }

    if (["REDUCE", "EXIT"].includes(action)) {
      sellPoints.push({
        coord: [`Day ${i + 1}`, Math.round(totalAsset)],
        value: "减"
      });
    }
  }

  const finalAsset = position + cash;

  return {
    totalInvested,
    finalAsset,
    profit: finalAsset - totalInvested,
    returnRate: ((finalAsset - totalInvested) / totalInvested * 100).toFixed(2),

    assetCurve,
    positionCurve,
    investedCurve,
    profitCurve,
    benchmarkCurve,
    drawdownCurve,
    buyPoints,
    sellPoints
  };
}

/**
 * ============================
 * 图表
 * ============================
 */
function getOption(days, mode) {
  const data = simulateStrategy(days, mode);
  const x = data.assetCurve.map((_, i) => `Day ${i + 1}`);

  return {
    tooltip: { trigger: "axis" },
    legend: {
      data: ["总资产", "利润", "基准", "仓位", "投入", "回撤"]
    },
    xAxis: { type: "category", data: x },
    yAxis: [
      { type: "value", name: "资金" },
      { type: "value", name: "%", axisLabel: { formatter: "{value}%" } }
    ],
    series: [
      {
        name: "总资产",
        type: "line",
        data: data.assetCurve,
        markPoint: {
          data: [
            ...data.buyPoints.map(p => ({ ...p, itemStyle: { color: "green" } })),
            ...data.sellPoints.map(p => ({ ...p, itemStyle: { color: "red" } }))
          ]
        }
      },
      { name: "利润", type: "line", data: data.profitCurve },
      { name: "基准", type: "line", data: data.benchmarkCurve, lineStyle: { type: "dashed" } },
      { name: "仓位", type: "line", data: data.positionCurve },
      { name: "投入", type: "line", data: data.investedCurve },
      {
        name: "回撤",
        type: "line",
        data: data.drawdownCurve,
        yAxisIndex: 1,
        areaStyle: { opacity: 0.15 }
      }
    ]
  };
}

/**
 * ============================
 * 主组件
 * ============================
 */
export default function InvestmentPro() {
  const [list, setList] = useState(() => {
    const cache = localStorage.getItem(STORAGE_KEY);
    return cache
      ? JSON.parse(cache)
      : [{ name: "", today: null, days: [null, null] }];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }, [list]);

  const updateDay = (g, d, val) => {
    const arr = [...list];
    arr[g].days[d] = val;
    setList(arr);
  };

  const addDay = (g) => {
    const arr = [...list];
    arr[g].days.push(null);
    setList(arr);
  };

  return (
    <div className="max-w-[1400px] mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-semibold mb-6">
        ETF 策略终端（双策略量化）
      </h1>

      {list.map((g, idx) => {
        const base = simulateStrategy(g.days, "BASE");
        const pro = simulateStrategy(g.days, "PRO");

        const baseSignal =
          g.today !== null
            ? getRealtimeSignal(g.days, g.today, "BASE")
            : null;

        const proSignal =
          g.today !== null
            ? getRealtimeSignal(g.days, g.today, "PRO")
            : null;

        const holdProfit =
          base.benchmarkCurve.length > 0
            ? base.benchmarkCurve.slice(-1)[0] - 10000
            : 0;

        return (
          <div
            key={idx}
            className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm"
          >
            {/* ===== 输入区 ===== */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input
                placeholder="ETF名称"
                value={g.name}
                onChange={(e) => {
                  const arr = [...list];
                  arr[idx].name = e.target.value;
                  setList(arr);
                }}
              />

              <InputNumber
                className="w-full"
                placeholder="今日涨跌 %"
                value={g.today}
                onChange={(v) => {
                  const arr = [...list];
                  arr[idx].today = v;
                  setList(arr);
                }}
              />
            </div>

            {/* ===== 实时决策 ===== */}
            {g.today !== null && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                {[{ t: "BASE", d: baseSignal }, { t: "PRO", d: proSignal }].map(
                  (item, i) => (
                    <div
                      key={i}
                      className="border rounded-lg p-4 bg-gray-50"
                    >
                      <div className="font-medium mb-2">
                        {item.t} 策略
                      </div>

                      <div className="flex flex-col gap-1 text-sm">
                        <span
                          className={`font-semibold ${item.d.action === "ADD"
                              ? "text-green-600"
                              : item.d.action === "REDUCE"
                                ? "text-orange-500"
                                : "text-red-500"
                            }`}
                        >
                          {item.d.action}
                        </span>

                        <span>操作金额：{item.d.changeAmount}</span>
                        <span>建议仓位：{item.d.positionPct}%</span>

                        <span
                          className={`${item.d.risk === "高"
                              ? "text-red-500"
                              : item.d.risk === "中"
                                ? "text-yellow-500"
                                : "text-green-600"
                            }`}
                        >
                          风险：{item.d.risk}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            {/* ===== KPI ===== */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500">BASE收益</div>
                <div className="text-green-600 font-semibold">
                  {Math.round(base.profit)}
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500">PRO收益</div>
                <div className="text-blue-600 font-semibold">
                  {Math.round(pro.profit)}
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500">持有收益</div>
                <div className="text-gray-700 font-semibold">
                  {Math.round(holdProfit)}
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500">PRO超额</div>
                <div className="text-purple-600 font-semibold">
                  {Math.round(pro.profit - holdProfit)}
                </div>
              </div>
            </div>

            {/* ===== 日轨迹 ===== */}
            <div className="flex flex-wrap gap-2 mb-3">
              {g.days.map((d, i) => {
                const slice = g.days.slice(0, i + 1);

                const cur = simulateStrategy(slice, "BASE");
                const prev = simulateStrategy(slice.slice(0, -1), "BASE");

                const change =
                  cur.positionCurve.slice(-1)[0] -
                  (prev.positionCurve.slice(-1)[0] || 0);

                let color = "bg-gray-200";

                if (change > 0) color = "bg-green-400";
                if (change < 0) color = "bg-red-400";

                return (
                  <div
                    key={i}
                    className={`px-2 py-1 rounded text-xs text-white ${color}`}
                  >
                    {d}%
                  </div>
                );
              })}
            </div>

            <Button onClick={() => addDay(idx)}>+ 天</Button>

            {/* ===== 图表 ===== */}
            <div className="flex gap-4 mt-5">
              <div className="flex-1">
                <ReactECharts option={getOption(g.days, "BASE")} />
              </div>
              <div className="flex-1">
                <ReactECharts option={getOption(g.days, "PRO")} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}