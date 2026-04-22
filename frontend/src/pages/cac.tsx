import React, { useState, useEffect, useMemo } from "react";
import {
  Card, Button, Input, InputNumber, Space,
  Tag, Typography, Modal, Tooltip,
  Row, Col, Statistic, Divider, Table,
  Flex
} from "antd";
import ReactECharts from "echarts-for-react";

const { Title, Text } = Typography;
const STORAGE_KEY = "investment-pro";

// ===== 工具 =====
const normalize = (v) => {
  const n = Number(v);
  return isNaN(n) ? null : n;
};

function getDaySignalWithPosition(days, index) {
  const slice = days.slice(0, index + 1).map(Number).filter(v => !isNaN(v));

  let price = 100;
  let peak = 100;
  let position = 10000;
  let addCount = 0;

  for (let i = 0; i < slice.length; i++) {
    const r = slice[i];

    price *= (1 + r / 100);
    peak = Math.max(peak, price);

    const drawdown = (price - peak) / peak;
    const recent = slice.slice(Math.max(0, i - 2), i + 1)
      .reduce((a, b) => a + b, 0);

    let action = "HOLD";
    let changeAmount = 0;

    if (drawdown < -0.07) {
      action = "EXIT";
      changeAmount = -position;
      position = 0;
    } else if (drawdown < -0.04) {
      action = "STRONG_REDUCE";
      changeAmount = -position * 0.7;
      position *= 0.3;
    } else if (drawdown < -0.02) {
      action = "REDUCE";
      changeAmount = -position * 0.5;
      position *= 0.5;
    }

    if (r > 0 && drawdown > -0.02 && recent > 0 && addCount < 3) {
      action = "ADD";
      changeAmount = 10000;
      position += 10000;
      addCount++;
    }

    if (i === slice.length - 1) {
      return {
        action,
        drawdown: (drawdown * 100).toFixed(2),
        position: Math.round(position),
        changeAmount: Math.round(changeAmount),
        price: price.toFixed(2)
      };
    }
  }
}

// ===== 信号计算（含置信度）=====
function getActionDetail(days, today) {
  const clean = days.map(Number).filter(v => !isNaN(v));
  const full = [...clean, Number(today || 0)];

  let price = 100;
  let peak = 100;

  for (const r of full) {
    price *= (1 + r / 100);
    peak = Math.max(peak, price);
  }

  const totalReturn = (price - 100) / 100;
  const drawdown = (price - peak) / peak;

  let action = "HOLD";
  let score = 50;
  let reason = [];

  if (drawdown < -0.07) {
    action = "EXIT";
    score = 90;
    reason.push("回撤超过7%，趋势失败");
  } else if (drawdown < -0.04) {
    action = "STRONG_REDUCE";
    score = 75;
    reason.push("回撤超过4%，明显转弱");
  } else if (drawdown < -0.02) {
    action = "REDUCE";
    score = 65;
    reason.push("回撤超过2%，动能减弱");
  }

  if (today < -2) {
    score += 10;
    reason.push("今日跌幅较大");
  }

  if (today > 0 && drawdown > -0.02) {
    action = "ADD";
    score = 70;
    reason.push("趋势延续 + 今日确认");
  }

  return {
    action,
    score: Math.min(score, 95),
    totalReturn: (totalReturn * 100).toFixed(2),
    drawdown: (drawdown * 100).toFixed(2),
    reason
  };
}

function getBenchmarkResult(days) {
  let price = 100;

  for (const r of days) {
    const n = Number(r);
    if (isNaN(n)) continue;
    price *= (1 + n / 100);
  }

  const finalAsset = 10000 * (price / 100);

  return {
    totalInvested: 10000,
    finalAsset,
    profit: finalAsset - 10000,
    returnRate: ((finalAsset - 10000) / 10000 * 100).toFixed(2)
  };
}
function getStrategyResult(days) {
  let price = 100;

  let position = 10000;      // 当前持仓市值
  let totalInvested = 10000; // 总投入
  let cash = 0;

  let peak = 100;
  let addCount = 0;

  for (const r0 of days) {
    const r = Number(r0);
    if (isNaN(r)) continue;

    // 价格变化
    price *= (1 + r / 100);
    peak = Math.max(peak, price);

    const drawdown = (price - peak) / peak;

    // 持仓随价格变化
    position *= (1 + r / 100);

    // ===== 减仓逻辑 =====
    if (drawdown < -0.07) {
      cash += position;
      position = 0;
    } else if (drawdown < -0.04) {
      const sell = position * 0.7;
      position -= sell;
      cash += sell;
    } else if (drawdown < -0.02) {
      const sell = position * 0.5;
      position -= sell;
      cash += sell;
    }

    // ===== 加仓逻辑 =====
    if (r > 0 && drawdown > -0.02 && addCount < 3) {
      position += 10000;
      totalInvested += 10000;
      addCount++;
    }
  }

  const finalAsset = position + cash;

  return {
    totalInvested,
    finalAsset,
    profit: finalAsset - totalInvested,
    returnRate: ((finalAsset - totalInvested) / totalInvested * 100)
      .toFixed(2)
  };
}

function generateCapitalCurves(days) {
  let price = 100;

  let position = 10000;
  let cash = 0;
  let totalInvested = 10000;

  let addCount = 0;

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

    // ===== 价格变化 =====
    price *= (1 + r / 100);
    peakPrice = Math.max(peakPrice, price);

    const drawdownPrice = (price - peakPrice) / peakPrice;

    // ===== 持仓变化 =====
    position *= (1 + r / 100);

    let action = "HOLD";

    // ===== 减仓逻辑 =====
    if (drawdownPrice < -0.07) {
      cash += position;
      position = 0;
      action = "EXIT";
    } else if (drawdownPrice < -0.04) {
      const sell = position * 0.7;
      position -= sell;
      cash += sell;
      action = "STRONG_REDUCE";
    } else if (drawdownPrice < -0.02) {
      const sell = position * 0.5;
      position -= sell;
      cash += sell;
      action = "REDUCE";
    }

    // ===== 加仓逻辑 =====
    if (r > 0 && drawdownPrice > -0.02 && addCount < 3) {
      position += 10000;
      totalInvested += 10000;
      addCount++;
      action = "ADD";
    }

    const totalAsset = position + cash;

    // ===== 回撤（基于资产）=====
    peakAsset = Math.max(peakAsset, totalAsset);
    const drawdownAsset = (totalAsset - peakAsset) / peakAsset;

    // ===== 基准 =====
    const benchmark = 10000 * (price / 100);

    // ===== 记录曲线 =====
    assetCurve.push(Math.round(totalAsset));
    positionCurve.push(Math.round(position));
    investedCurve.push(totalInvested);
    profitCurve.push(Math.round(totalAsset - totalInvested));
    benchmarkCurve.push(Math.round(benchmark));
    drawdownCurve.push((drawdownAsset * 100).toFixed(2));

    // ===== 标记点 =====
    if (action === "ADD") {
      buyPoints.push({
        coord: [`Day ${i + 1}`, Math.round(totalAsset)],
        value: "加"
      });
    }

    if (["REDUCE", "STRONG_REDUCE", "EXIT"].includes(action)) {
      sellPoints.push({
        coord: [`Day ${i + 1}`, Math.round(totalAsset)],
        value: "减"
      });
    }
  }

  return {
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

function generateCapitalCurvesPro(days) {
  let price = 100;

  let position = 10000;
  let cash = 0;
  let totalInvested = 10000;

  let peakPrice = 100;
  let peakAsset = 10000;

  let addCount = 0;

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

    const drawdownPrice = (price - peakPrice) / peakPrice;

    // ===== 持仓变化 =====
    position *= (1 + r / 100);

    // ===== 趋势判断 =====
    const recent = days.slice(Math.max(0, i - 2), i + 1)
      .map(Number)
      .filter(v => !isNaN(v));

    const recentSum = recent.reduce((a, b) => a + b, 0);
    const hasPullback = recent.some(v => v < 0);

    const last2 = recent.slice(-2);
    const twoDown = last2.length === 2 && last2.every(v => v < 0);

    let action = "HOLD";

    // ===== 风控优先 =====
    if (twoDown && position > 0) {
      const sell = position * 0.3;
      position -= sell;
      cash += sell;
      action = "REDUCE";
    }

    if (drawdownPrice < -0.03 && position > 0) {
      const sell = position * 0.5;
      position -= sell;
      cash += sell;
      action = "STRONG_REDUCE";
    }

    if (drawdownPrice < -0.06 && position > 0) {
      cash += position;
      position = 0;
      action = "EXIT";
    }

    // ===== 加仓（优化后）=====
    const trendOK = recentSum > 1;

    if (
      trendOK &&
      hasPullback &&
      r > 0 &&
      drawdownPrice > -0.03 &&
      addCount < 2
    ) {
      position += 10000;
      totalInvested += 10000;
      addCount++;
      action = "ADD";
    }

    const totalAsset = position + cash;

    // ===== 回撤 =====
    peakAsset = Math.max(peakAsset, totalAsset);
    const drawdown = (totalAsset - peakAsset) / peakAsset;

    const benchmark = 10000 * (price / 100);

    // ===== 曲线记录 =====
    assetCurve.push(Math.round(totalAsset));
    positionCurve.push(Math.round(position));
    investedCurve.push(totalInvested);
    profitCurve.push(Math.round(totalAsset - totalInvested));
    benchmarkCurve.push(Math.round(benchmark));
    drawdownCurve.push((drawdown * 100).toFixed(2));

    // ===== 标记 =====
    if (action === "ADD") {
      buyPoints.push({
        coord: [`Day ${i + 1}`, totalAsset],
        value: "加"
      });
    }

    if (["REDUCE", "STRONG_REDUCE", "EXIT"].includes(action)) {
      sellPoints.push({
        coord: [`Day ${i + 1}`, totalAsset],
        value: "减"
      });
    }
  }

  return {
    assetCurve,
    positionCurve,     // ✅ 回来了
    investedCurve,     // ✅ 回来了
    profitCurve,
    benchmarkCurve,
    drawdownCurve,
    buyPoints,
    sellPoints
  };
}
function getDualAxisOption(days, isPro = false) {
  const {
    assetCurve,
    positionCurve,
    investedCurve,
    profitCurve,
    benchmarkCurve,
    drawdownCurve,
    buyPoints,
    sellPoints
  } = isPro ? generateCapitalCurvesPro(days) : generateCapitalCurves(days);

  const xData = assetCurve.map((_, i) => `Day ${i + 1}`);

  return {
    tooltip: {
      trigger: "axis"
    },

    legend: {
      data: [
        "总资产",
        "利润",
        "持有基准",
        "持仓占用",
        "累计投入",
        "回撤"
      ]
    },

    xAxis: {
      type: "category",
      data: xData
    },

    yAxis: [
      {
        type: "value",
        name: "资产 / 利润"
      },
      {
        type: "value",
        name: "回撤 %",
        axisLabel: {
          formatter: "{value}%"
        }
      }
    ],

    series: [
      // ===== 总资产 =====
      {
        name: "总资产",
        type: "line",
        data: assetCurve,
        smooth: true,

        markPoint: {
          data: [
            ...buyPoints.map(p => ({
              ...p,
              itemStyle: { color: "green" }
            })),
            ...sellPoints.map(p => ({
              ...p,
              itemStyle: { color: "red" }
            }))
          ]
        }
      },

      // ===== 利润（核心）=====
      {
        name: "利润",
        type: "line",
        data: profitCurve,
        smooth: true
      },

      // ===== 基准 =====
      {
        name: "持有基准",
        type: "line",
        data: benchmarkCurve,
        smooth: true,
        lineStyle: {
          type: "dashed"
        }
      },

      // ===== 持仓占用 =====
      {
        name: "持仓占用",
        type: "line",
        data: positionCurve,
        smooth: true
      },

      // ===== 累计投入 =====
      {
        name: "累计投入",
        type: "line",
        data: investedCurve,
        lineStyle: {
          type: "dotted"
        }
      },

      // ===== 回撤（阴影）=====
      {
        name: "回撤",
        type: "line",
        data: drawdownCurve,
        yAxisIndex: 1,
        smooth: true,
        areaStyle: {
          opacity: 0.15
        }
      }
    ]
  };
}
// ===== 主组件 =====
export default function InvestmentPro() {
  const [list, setList] = useState(() => {
    const cache = localStorage.getItem(STORAGE_KEY);
    return cache
      ? JSON.parse(cache)
      : [{ name: "", today: null, days: [null, null] }];
  });

  const [deleteIndex, setDeleteIndex] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }, [list]);

  const update = (g, key, val) => {
    const newList = [...list];
    newList[g][key] = val;
    setList(newList);
  };

  const updateDay = (g, d, val) => {
    const newList = [...list];
    newList[g].days[d] = val;
    setList(newList);
  };

  const addGroup = () =>
    setList([...list, { name: "", today: null, days: [null, null] }]);

  const addDay = (g) => {
    const newList = [...list];
    newList[g].days.push(null);
    setList(newList);
  };

  const removeGroup = () => {
    setList(list.filter((_, i) => i !== deleteIndex));
    setDeleteIndex(null);
  };

  // ===== 信号统计 =====
  const signals = useMemo(() => {
    return list.map(g => getActionDetail(g.days, g.today));
  }, [list]);

  const stats = useMemo(() => {
    const s = { ADD: 0, HOLD: 0, REDUCE: 0, STRONG_REDUCE: 0, EXIT: 0 };
    signals.forEach(i => s[i.action]++);
    return s;
  }, [signals]);

  const portfolioSignal =
    stats.ADD > list.length / 2 ? "偏强" :
      (stats.EXIT + stats.REDUCE + stats.STRONG_REDUCE) > list.length / 2
        ? "风险上升"
        : "观望";

  // ===== 图表 =====
  const baseCurve = list.flatMap(g =>
    g.days.map((r, i) => 10000 * (1 + (Number(r) || 0) / 100))
  );

  const chartOption = {
    xAxis: { type: "category", data: baseCurve.map((_, i) => i) },
    yAxis: { type: "value" },
    series: [{ type: "line", data: baseCurve }]
  };

  // ===== 删除预估 =====
  const preview = deleteIndex !== null
    ? getActionDetail(list[deleteIndex].days, list[deleteIndex].today)
    : null;

  return (
    <div style={{ maxWidth: 1200, margin: "auto", padding: 20, overflowY: 'auto' }}>
      <Title level={3}>策略终端 Pro</Title>

      {/* KPI */}
      <Row gutter={16}>
        <Col span={6}><Card><Statistic title="投资项" value={list.length} /></Card></Col>
        <Col span={6}><Card><Statistic title="ADD" value={stats.ADD} /></Card></Col>
        <Col span={6}><Card><Statistic title="REDUCE" value={stats.REDUCE + stats.STRONG_REDUCE} /></Card></Col>
        <Col span={6}><Card><Statistic title="组合信号" value={portfolioSignal} /></Card></Col>
      </Row>

      <Divider />

      {/* 投资项 */}
      {list.map((g, idx) => {
        const detail = signals[idx];
        const strategy = getStrategyResult(g.days);
        const benchmark = getBenchmarkResult(g.days);
        const normalized = (strategy.profit / 10000 * 100).toFixed(2);
        const excess = (
          strategy.returnRate - benchmark.returnRate
        ).toFixed(2);
        const colorMap = {
          ADD: "green",
          HOLD: "orange",
          REDUCE: "gold",
          STRONG_REDUCE: "volcano",
          EXIT: "red"
        };

        return (
          <Card
            key={idx}
            style={{ marginBottom: 16 }}
            title={g.name || `#${idx + 1}`}
            extra={
              <Tooltip title={detail.reason.join(" / ")}>
                <Tag color={colorMap[detail.action]}>
                  {detail.action} ({detail.score})
                </Tag>
              </Tooltip>
            }
          >
            <Input
              placeholder="名称"
              value={g.name}
              onChange={(e) => update(idx, "name", e.target.value)}
            />

            <InputNumber
              style={{ width: "100%", marginTop: 10 }}
              placeholder="今日涨跌%"
              value={g.today}
              onChange={(v) => update(idx, "today", v)}
            />

            <Space wrap style={{ marginTop: 10 }}>
              {g.days.map((d, i) => {
                const detail = getDaySignalWithPosition(g.days, i);
                const colorMap = {
                  ADD: "green",
                  HOLD: "orange",
                  REDUCE: "gold",
                  STRONG_REDUCE: "volcano",
                  EXIT: "red"
                };

                return (
                  <Space vertical key={i} align="center">
                    <InputNumber
                      value={d}
                      onChange={(v) => updateDay(idx, i, v)}
                    />



                    <Tooltip
                      title={
                        <div>
                          <div>操作：{detail.action}</div>
                          <div>操作金额：{detail.changeAmount > 0 ? "+" : ""}{detail.changeAmount}</div>
                          <div>当前仓位：{detail.position}</div>
                          <div>当前收益指数：{detail.price}</div>
                          <div>回撤：{detail.drawdown}%</div>
                        </div>
                      }
                    >
                      <Tag color={colorMap[detail.action]}>
                        {detail.action}
                      </Tag>
                    </Tooltip>
                  </Space>
                );
              })}
            </Space>

            <div style={{ marginTop: 10 }}>
              <Space direction="vertical" style={{ marginTop: 10 }}>
                <Text>
                  总投入：{strategy.totalInvested}
                </Text>

                <Text>
                  最终资产：{Math.round(strategy.finalAsset)}
                </Text>

                <Text style={{ color: "#cf1322" }}>
                  策略收益：{strategy.returnRate}%（+{Math.round(strategy.profit)}）
                </Text>

                <Text style={{ color: "#1677ff" }}>
                  持有收益：{benchmark.returnRate}%（+{Math.round(benchmark.profit)}）
                </Text>

                <Text
                  style={{
                    color: excess >= 0 ? "green" : "red"
                  }}
                >
                  超额收益：{Math.round(strategy.profit - benchmark.profit)}
                </Text>
                资金效率（标准化）：
                <span style={{ color: "green", marginLeft: 4 }}>
                  {normalized}%
                </span>
              </Space>
            </div>

            <div style={{ marginTop: 10 }}>
              <Button onClick={() => addDay(idx)}>+ 天</Button>
              <Button danger onClick={() => setDeleteIndex(idx)}>
                删除
              </Button>
            </div>
            <Card title="资金 & 仓位曲线（双轴）">
              <Flex>
                <ReactECharts style={{flex: 1}} option={getDualAxisOption(g.days)} />
                <ReactECharts style={{flex: 1}} option={getDualAxisOption(g.days, true)} />
              </Flex>
            </Card>
          </Card>
        );
      })}

      <Button type="primary" onClick={addGroup}>+ 投资项</Button>

      <Divider />

      <Card title="资金曲线">
        <ReactECharts option={chartOption} />
      </Card>

      {/* 删除弹窗 */}
      <Modal
        open={deleteIndex !== null}
        onCancel={() => setDeleteIndex(null)}
        onOk={removeGroup}
        title="确认删除"
      >
        {preview && (
          <>
            <p>当前收益：{preview.totalReturn}%</p>
            <p>当前回撤：{preview.drawdown}%</p>
            <p>建议：{preview.action}</p>
            <p>⚠️ 删除可能影响组合收益</p>
          </>
        )}
      </Modal>
    </div>
  );
}