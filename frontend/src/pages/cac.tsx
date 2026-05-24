import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Card, Button, Input, InputNumber, Space,
  Tag, Typography, Modal, Tooltip,
  Row, Col, Statistic, Divider, Flex, ConfigProvider, Checkbox
} from "antd";
import ReactECharts from "echarts-for-react";
import getStockData from "../services/stock";

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

// ========== 计算各操作点位的具体金额（用于 hover 提示） ==========
function calculateActionAmounts(days, mode = "BASE") {
  const MAX_POSITION = 80000;
  const current = simulateStrategy(days, mode);

  // 当前仓位
  const currentPosition = current.positionCurve.length > 0
    ? current.positionCurve[current.positionCurve.length - 1]
    : 10000;

  // 当前价格（用于计算回撤影响）
  const lastDD = current.drawdownCurve.length > 0
    ? parseFloat(current.drawdownCurve[current.drawdownCurve.length - 1]) / 100
    : 0;

  // 计算加仓金额：区分策略类型
  // BASE策略: 10000 * (1 - position / MAX_POSITION)
  // PRO策略: 8000 * (1 - position / MAX_POSITION)
  const baseAddAmount = 10000;
  const proAddAmount = 8000;
  const addBase = mode === "BASE" ? baseAddAmount : proAddAmount;
  const addAmount = Math.round(Math.min(
    addBase * (1 - currentPosition / MAX_POSITION),
    MAX_POSITION - currentPosition
  ));

  // 计算减仓金额：基于当前仓位的30%和60%
  const reduce30Amount = Math.round(currentPosition * 0.3);
  const reduce60Amount = Math.round(currentPosition * 0.6);

  // 清仓金额：全部仓位
  const exitAmount = Math.round(currentPosition);

  // 计算触发点位
  // 当前虚拟价格 = 100 * (1 + 累计收益)
  const totalReturn = (current.finalAsset - current.totalInvested) / current.totalInvested;
  const currentPrice = 100 * (1 + totalReturn);
  const peakPrice = currentPrice / (1 + lastDD);

  // 计算各触发点位的涨跌值
  const addTriggerPrice = peakPrice * (1 - 0.02);  // 回撤 > -2%
  const reduce30TriggerPrice = peakPrice * (1 - 0.02);  // 回撤 -2%
  const reduce60TriggerPrice = peakPrice * (1 - 0.03);  // 回撤 -3%
  const exitTriggerPrice = peakPrice * (1 - 0.06);  // 回撤 -6%

  const addTriggerPct = ((addTriggerPrice - currentPrice) / currentPrice * 100).toFixed(2);
  const reduce30TriggerPct = ((reduce30TriggerPrice - currentPrice) / currentPrice * 100).toFixed(2);
  const reduce60TriggerPct = ((reduce60TriggerPrice - currentPrice) / currentPrice * 100).toFixed(2);
  const exitTriggerPct = ((exitTriggerPrice - currentPrice) / currentPrice * 100).toFixed(2);

  return {
    currentPosition: Math.round(currentPosition),
    currentPositionPct: Math.round((currentPosition / MAX_POSITION) * 100),
    add: {
      trigger: `涨 > 0% 且回撤 > -2%`,
      triggerPct: addTriggerPct,
      amount: addAmount
    },
    reduce30: {
      trigger: `回撤 -2% ~ -3%`,
      triggerPct: reduce30TriggerPct,
      amount: reduce30Amount
    },
    reduce60: {
      trigger: `回撤 -3% ~ -6%`,
      triggerPct: reduce60TriggerPct,
      amount: reduce60Amount
    },
    exit: {
      trigger: `回撤 < -6%`,
      triggerPct: exitTriggerPct,
      amount: exitAmount
    }
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

// ========== ETF 子组件（使用 useMemo 缓存计算结果） ==========
function ETFItem({ g, idx, list, setList, updateDay, addDay, onAutoUpdateChange, onEtfCodeChange }) {
  const base = useMemo(() => simulateStrategy(g.days, "BASE"), [g.days]);
  const pro = useMemo(() => simulateStrategy(g.days, "PRO"), [g.days]);

  // 缓存操作金额计算结果，避免重复计算
  const baseActionAmounts = useMemo(() => calculateActionAmounts(g.days, "BASE"), [g.days]);
  const proActionAmounts = useMemo(() => calculateActionAmounts(g.days, "PRO"), [g.days]);

  const baseSignal = useMemo(() =>
    g.today !== null ? getRealtimeSignal(g.days, g.today, "BASE") : null,
    [g.days, g.today]
  );

  const proSignal = useMemo(() =>
    g.today !== null ? getRealtimeSignal(g.days, g.today, "PRO") : null,
    [g.days, g.today]
  );

  const holdProfit = useMemo(() =>
    base.benchmarkCurve.length > 0 ? base.benchmarkCurve.slice(-1)[0] - 10000 : 0,
    [base.benchmarkCurve]
  );

  return (
    <div
      key={idx}
      className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm"
    >
      {/* 输入区 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Checkbox
          checked={g.isAutoUpdate}
          onChange={(e) => onAutoUpdateChange(idx, e.target.checked)}
        />
        <Tooltip
          title={
            <div className=" p-4 space-y-3 w-[320px] rounded-lg shadow-lg">
              <div className="font-semibold text-sm mb-2 text-gray-800">📊 今日操作建议</div>
              <div className="text-xs text-gray-500 mb-1">当前仓位: {baseActionAmounts.currentPositionPct}% ({baseActionAmounts.currentPosition.toLocaleString()}元)</div>

              {/* BASE 策略 */}
              <div className="border-b border-gray-200 pb-2">
                <div className="text-xs font-medium text-blue-600 mb-2">🎯 BASE 策略</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 rounded p-2">
                    <div className="text-xs text-green-700">📈 加仓</div>
                    <div className="text-xs text-green-600">
                      &gt;0%
                    </div>
                    <div className="text-xs font-semibold text-green-600">+{baseActionAmounts.add.amount.toLocaleString()}</div>
                  </div>
                  <div className="bg-orange-50 rounded p-2">
                    <div className="text-xs text-orange-700">📉 减仓</div>
                    <div className="text-xs text-orange-600">{baseActionAmounts.reduce30.triggerPct}%</div>
                    <div className="text-xs font-semibold text-orange-600">-{baseActionAmounts.reduce30.amount.toLocaleString()}</div>
                  </div>
                  <div className="bg-orange-100 rounded p-2">
                    <div className="text-xs text-orange-800">⚠️ 深减</div>
                    <div className="text-xs text-orange-700">{baseActionAmounts.reduce60.triggerPct}%</div>
                    <div className="text-xs font-semibold text-orange-700">-{baseActionAmounts.reduce60.amount.toLocaleString()}</div>
                  </div>
                  <div className="bg-red-50 rounded p-2">
                    <div className="text-xs text-red-700">🛑 清仓</div>
                    <div className="text-xs text-red-600">&lt;{baseActionAmounts.exit.triggerPct}%</div>
                    <div className="text-xs font-semibold text-red-600">-{baseActionAmounts.exit.amount.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* PRO 策略 */}
              <div>
                <div className="text-xs font-medium text-purple-600 mb-2">🚀 PRO 策略</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 rounded p-2">
                    <div className="text-xs text-green-700">📈 加仓</div>
                    <div className="text-xs text-green-600">
                      &gt;0%
                    </div>
                    <div className="text-xs font-semibold text-green-600">+{proActionAmounts.add.amount.toLocaleString()}</div>
                  </div>
                  <div className="bg-orange-50 rounded p-2">
                    <div className="text-xs text-orange-700">📉 减仓</div>
                    <div className="text-xs text-orange-600">{proActionAmounts.reduce30.triggerPct}%</div>
                    <div className="text-xs font-semibold text-orange-600">-{proActionAmounts.reduce30.amount.toLocaleString()}</div>
                  </div>
                  <div className="bg-orange-100 rounded p-2">
                    <div className="text-xs text-orange-800">⚠️ 深减</div>
                    <div className="text-xs text-orange-700">{proActionAmounts.reduce60.triggerPct}%</div>
                    <div className="text-xs font-semibold text-orange-700">-{proActionAmounts.reduce60.amount.toLocaleString()}</div>
                  </div>
                  <div className="bg-red-50 rounded p-2">
                    <div className="text-xs text-red-700">🛑 清仓</div>
                    <div className="text-xs text-red-600">&lt;{proActionAmounts.exit.triggerPct}%</div>
                    <div className="text-xs font-semibold text-red-600">-{proActionAmounts.exit.amount.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>
          }
          placement="bottom"
          overlayStyle={{ borderRadius: '8px' }}
        >
          <Input
            placeholder="ETF名称"
            value={g.name}
            onChange={(e) => {
              const arr = [...list];
              arr[idx].name = e.target.value;
              setList(arr);
            }}
          />
        </Tooltip>
        {g.isAutoUpdate && (
          <Input
            placeholder="ETF代码 (如 SZ159178)"
            value={g.etfCode}
            onChange={(e) => onEtfCodeChange(idx, e.target.value)}
          />
        )}
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
      {g.today != null && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[{ t: "BASE", d: baseSignal }, { t: "PRO", d: proSignal }].map(
            (item, i) => (
              <div key={i} className="border rounded-lg p-4 bg-gray-50">
                <div className="font-medium mb-2">{item.t} 策略</div>
                <div className="flex flex-col gap-1 text-sm">
                  <span
                    className={`font-semibold ${item.d.action === "ADD"
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
}

// ========== 主组件 ==========
export default function InvestmentPro() {
  const [list, setList] = useState(() => {
    const cache = localStorage.getItem(STORAGE_KEY);
    return cache
      ? JSON.parse(cache)
      : [{ name: "", today: null, days: [], etfCode: "", isAutoUpdate: false }];
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
    arr[g].days.push(0);
    setList(arr);
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      const codesToUpdate = list
        .filter(item => item.isAutoUpdate && item.etfCode)
        .map(item => item.etfCode);

      if (codesToUpdate.length > 0) {
        try {
          // 假设 stock.ts 返回 { code, change, price } 格式
          const data = await getStockData(codesToUpdate);
          const newList = [...list];
          data.forEach(item => {
            const idx = newList.findIndex(i => i.etfCode === item.code);
            if (idx !== -1) {
              newList[idx].today = item.change;
            }
          });
          setList(newList);
        } catch (e) {
          console.error('Failed to fetch stock data:', e);
        }
      }
    }, 5000); // 每5秒轮询一次

    return () => clearInterval(interval);
  }, [list]);

  const onAutoUpdateChange = (idx, value) => {
    const arr = [...list];
    arr[idx].isAutoUpdate = value;
    setList(arr);
  };

  const onEtfCodeChange = (idx, value) => {
    const arr = [...list];
    arr[idx].etfCode = value;
    setList(arr);
  };

  return (
    <ConfigProvider
      theme={{
        components: {
          Tooltip: {
            maxWidth: 600,
          }
        }
      }}
    >
      <div className="max-w-[1400px] mx-auto p-6 bg-gray-50 min-h-screen">
        <h1 className="text-2xl font-semibold mb-6">
          ETF 策略终端（双策略量化）
        </h1>

        {list.map((g, idx) => (
          <ETFItem
            key={idx}
            g={g}
            idx={idx}
            updateDay={updateDay}
            addDay={addDay}
            list={list}
            setList={setList}
            onAutoUpdateChange={onAutoUpdateChange}
            onEtfCodeChange={onEtfCodeChange}
          />
        ))}
      </div>
    </ConfigProvider>
  );
}