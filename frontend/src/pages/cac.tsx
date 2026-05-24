import React, { useState, useEffect, useMemo } from "react";
import {
  Card, Button, Input, InputNumber, Space,
  Tag, Typography, Modal, Tooltip,
  Row, Col, Statistic, Divider, Flex
} from "antd";
import ReactECharts from "echarts-for-react";

const { Title, Text } = Typography;
const STORAGE_KEY = "investment-pro";

// ========== 获取实时信号（使用模拟中的实际交易金额） ==========
function getRealtimeSignal(days, today, mode = "BASE") {
  const MAX_POSITION = 80000;

  const prev = simulateStrategy(days, mode);
  const next = simulateStrategy([...days, today], mode);

  // 直接使用策略记录的最后一次交易信息
  let action = next.lastTradeAction;
  let changeAmount = Math.abs(next.lastTradeAmount);

  // 若没有实际交易（HOLD）但仓位变化来自价格波动，则强制为 HOLD 且金额为 0
  if (action === "HOLD") {
    changeAmount = 0;
  }

  // 仓位百分比
  const positionAfter = Math.round(next.positionCurve[next.positionCurve.length - 1] || 0);
  const positionPct = Math.round((positionAfter / MAX_POSITION) * 100);

  // 风险等级（基于仓位比例和回撤）
  let risk = "低";
  if (positionPct > 70) risk = "高";
  else if (positionPct > 30) risk = "中";

  const dd = next.drawdownCurve[next.drawdownCurve.length - 1] || 0;
  if (dd < -5) risk = "高";
  else if (dd < -2) risk = "中";

  return {
    action,
    changeAmount,
    positionAfter,
    positionPct,
    risk,
    profit: Math.round(next.profit),
    finalAsset: Math.round(next.finalAsset)
  };
}

// ========== 核心策略引擎（统一，改进减仓逻辑 & 记录真实交易金额） ==========
function simulateStrategy(days, mode = "BASE") {
  let price = 100;
  let position = 10000;      // 持仓市值
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

  // 记录当日最后发生的实际交易（用于实时信号）
  let lastTradeAction = "HOLD";
  let lastTradeAmount = 0;

  for (let i = 0; i < days.length; i++) {
    const r = Number(days[i]);
    if (isNaN(r)) continue;

    // 价格演变
    price *= (1 + r / 100);
    peakPrice = Math.max(peakPrice, price);
    const drawdown = (price - peakPrice) / peakPrice;

    // 持仓市值自然波动
    position *= (1 + r / 100);

    let action = "HOLD";
    let changeAmount = 0;

    // ========== 改进后的减仓/清仓逻辑（更平缓，避免微小波动触发） ==========
    // 回撤阈值：-5% 开始减仓，-10% 清仓，中间线性过渡
    let reduceRatio = 0;
    if (drawdown < -0.06) {
      reduceRatio = 1.0;        // 清仓
    } else if (drawdown < -0.03) {
      reduceRatio = 0.6;        // 减60%
    } else if (drawdown < -0.02) {
      reduceRatio = 0.3;        // 减30%
    }

    if (reduceRatio > 0) {
      const reduceAmount = position * reduceRatio;
      if (reduceRatio >= 0.99) {
        // 清仓
        changeAmount = -position;
        cash += position;
        position = 0;
        action = "EXIT";
      } else {
        // 减仓
        changeAmount = -reduceAmount;
        position -= reduceAmount;
        cash += reduceAmount;
        action = "REDUCE";
      }
    }
    // ========== 加仓逻辑（保持不变，但必须无减仓时才执行） ==========
    else {
      const recent = days.slice(Math.max(0, i - 2), i + 1)
        .map(Number)
        .filter(v => !isNaN(v));
      const recentSum = recent.reduce((a, b) => a + b, 0);

      if (mode === "BASE") {
        // 原始趋势追涨
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
        // PRO 策略（回调后追涨）
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

    // 记录实际交易（用于外部信号）
    if (action !== "HOLD") {
      lastTradeAction = action;
      lastTradeAmount = changeAmount;   // 正=加仓，负=减仓/清仓
    }

    // 总资产 & 回撤
    const totalAsset = position + cash;
    peakAsset = Math.max(peakAsset, totalAsset);
    const dd = (totalAsset - peakAsset) / peakAsset;

    const benchmark = 10000 * (price / 100);

    // 曲线记录
    assetCurve.push(Math.round(totalAsset));
    positionCurve.push(Math.round(position));
    investedCurve.push(Math.round(totalInvested));
    profitCurve.push(Math.round(totalAsset - totalInvested));
    benchmarkCurve.push(Math.round(benchmark));
    drawdownCurve.push((dd * 100).toFixed(2));

    // 标记买卖点
    if (action === "ADD") {
      buyPoints.push({
        coord: [`Day ${i + 1}`, Math.round(totalAsset)],
        value: "加"
      });
    }
    if (action === "REDUCE" || action === "EXIT") {
      sellPoints.push({
        coord: [`Day ${i + 1}`, Math.round(totalAsset)],
        value: action === "EXIT" ? "清" : "减"
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
    sellPoints,

    // 新增：最后一次实际交易信息（用于实时信号）
    lastTradeAction,
    lastTradeAmount
  };
}

// ========== 图表配置 ==========
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

// ========== 主组件 ==========
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
            {/* 输入区 */}
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

            {/* 实时信号卡片 */}
            {g.today !== null && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                {[{ t: "BASE", d: baseSignal }, { t: "PRO", d: proSignal }].map(
                  (item, i) => (
                    <div key={i} className="border rounded-lg p-4 bg-gray-50">
                      <div className="font-medium mb-2">{item.t} 策略</div>
                      <div className="flex flex-col gap-1 text-sm">
                        <span
                          className={`font-semibold ${
                            item.d.action === "ADD"
                              ? "text-green-600"
                              : item.d.action === "REDUCE"
                              ? "text-orange-500"
                              : item.d.action === "EXIT"
                              ? "text-red-500"
                              : "text-gray-500"
                          }`}
                        >
                          {item.d.action === "ADD" && "加仓"}
                          {item.d.action === "REDUCE" && "减仓"}
                          {item.d.action === "EXIT" && "清仓"}
                          {item.d.action === "HOLD" && "持有"}
                        </span>
                        <span>操作金额：{item.d.changeAmount}</span>
                        <span>建议仓位：{item.d.positionPct}%</span>
                        <span
                          className={`${
                            item.d.risk === "高"
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

            {/* KPI 指标 */}
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

            {/* 日收益率输入 */}
            <div className="flex flex-wrap gap-2 mb-3">
              {g.days.map((d, i) => (
                <InputNumber
                  key={i}
                  value={d}
                  step={0.1}
                  style={{ width: 90 }}
                  onChange={(v) => updateDay(idx, i, v)}
                />
              ))}
            </div>
            <Button onClick={() => addDay(idx)}>+ 添加交易日</Button>

            {/* 双图表 */}
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