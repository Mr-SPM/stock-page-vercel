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
    <div style={{ maxWidth: 1200, margin: "auto", padding: 20 }}>
      <Title level={3}>ETF 策略终端（双策略对比）</Title>

      {list.map((g, idx) => {
        const base = simulateStrategy(g.days, "BASE");
        const pro = simulateStrategy(g.days, "PRO");

        return (
          <Card key={idx} style={{ marginBottom: 20 }}>
            <Input
              placeholder="名称"
              value={g.name}
              onChange={(e) => {
                const arr = [...list];
                arr[idx].name = e.target.value;
                setList(arr);
              }}
            />
            <InputNumber
              style={{ width: "100%", marginTop: 10 }}
              placeholder="今日涨跌%"
              value={g.today}
              onChange={(v) => {
                const arr = [...list];
                arr[idx].today = v;
                setList(arr);
              }}
            />

            {g.today !== null && (

              () => {
                const baseSignal = getRealtimeSignal(g.days, g.today, "BASE");
                const proSignal = getRealtimeSignal(g.days, g.today, "PRO");

                const riskColor = {
                  低: "green",
                  中: "orange",
                  高: "red"
                };

                return <Card style={{ marginTop: 12 }}>
                  <Row gutter={16}>
                    {/* ===== BASE ===== */}
                    <Col span={12}>
                      <Card size="small" title="BASE 实时决策">
                        <Space direction="vertical">

                          <Tag color={baseSignal.action === "ADD" ? "green" : baseSignal.action === "REDUCE" ? "orange" : "red"}>
                            {baseSignal.action}
                          </Tag>

                          <Text>
                            操作金额：{baseSignal.changeAmount}
                          </Text>

                          <Text>
                            建议仓位：{baseSignal.positionPct}%
                          </Text>

                          <Tag color={riskColor[baseSignal.risk]}>
                            风险：{baseSignal.risk}
                          </Tag>

                        </Space>
                      </Card>
                    </Col>

                    {/* ===== PRO ===== */}
                    <Col span={12}>
                      <Card size="small" title="PRO 实时决策">
                        <Space direction="vertical">

                          <Tag color={proSignal.action === "ADD" ? "green" : proSignal.action === "REDUCE" ? "orange" : "red"}>
                            {proSignal.action}
                          </Tag>

                          <Text>
                            操作金额：{proSignal.changeAmount}
                          </Text>

                          <Text>
                            建议仓位：{proSignal.positionPct}%
                          </Text>

                          <Tag color={riskColor[proSignal.risk]}>
                            风险：{proSignal.risk}
                          </Tag>

                        </Space>
                      </Card>
                    </Col>
                  </Row>
                </Card>
              })()}



            <Space wrap style={{ marginTop: 10 }}>
              {g.days.map((d, i) => {
                const slice = g.days.slice(0, i + 1);

                const base = simulateStrategy(slice, "BASE");
                const prev = simulateStrategy(slice.slice(0, -1), "BASE");

                const change = base.totalInvested - (prev.totalInvested || 10000);

                let action = "HOLD";
                if (change > 0) action = "ADD";
                if (change < 0) action = "REDUCE";

                const colorMap = {
                  ADD: "green",
                  HOLD: "orange",
                  REDUCE: "red"
                };

                return (
                  <Space key={i} direction="vertical" align="center">
                    <InputNumber
                      value={d}
                      onChange={(v) => updateDay(idx, i, v)}
                    />

                    <Tooltip
                      title={
                        <div>
                          <div>操作：{action}</div>
                          <div>金额：{change > 0 ? "+" : ""}{Math.round(change)}</div>
                          <div>总资产：{Math.round(base.finalAsset)}</div>
                          <div>收益：{Math.round(base.profit)}</div>
                        </div>
                      }
                    >
                      <Tag color={colorMap[action]}>
                        {action}
                      </Tag>
                    </Tooltip>
                  </Space>
                );
              })}
            </Space>

            <div style={{ marginTop: 10 }}>
              <Button onClick={() => addDay(idx)}>+ 天</Button>
            </div>

            <Divider />

            {(() => {
              const benchmark = simulateStrategy(g.days, "BASE"); // 用价格曲线
              const hold = 10000 * (benchmark.benchmarkCurve.slice(-1)[0] / 10000);

              return (
                <>
                  <Text>
                    BASE：{Math.round(base.profit)}（{base.returnRate}%）
                  </Text>
                  <br />

                  <Text>
                    PRO：{Math.round(pro.profit)}（{pro.returnRate}%）
                  </Text>
                  <br />

                  <Text>
                    持有：{Math.round(hold - 10000)}
                  </Text>
                  <br />

                  <Text style={{ color: "green" }}>
                    BASE超额：{Math.round(base.profit - (hold - 10000))}
                  </Text>
                  <br />

                  <Text style={{ color: "purple" }}>
                    PRO超额：{Math.round(pro.profit - (hold - 10000))}
                  </Text>
                </>
              );
            })()}

            <Divider />

            <Flex>
              <ReactECharts style={{ flex: 1 }} option={getOption(g.days, "BASE")} />
              <ReactECharts style={{ flex: 1 }} option={getOption(g.days, "PRO")} />
            </Flex>
          </Card>
        );
      })}
    </div>
  );
}