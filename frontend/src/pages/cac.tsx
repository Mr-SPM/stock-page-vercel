import React, { useState, useEffect, useMemo } from "react";
import {
  Card, Button, Input, InputNumber, Space,
  Tag, Typography, Modal, Tooltip,
  Row, Col, Statistic, Divider, Table
} from "antd";
import ReactECharts from "echarts-for-react";

const { Title, Text } = Typography;
const STORAGE_KEY = "investment-pro";

// ===== 工具 =====
const normalize = (v) => {
  const n = Number(v);
  return isNaN(n) ? null : n;
};

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
    <div style={{ maxWidth: 1200, margin: "auto", padding: 20 }}>
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
              {g.days.map((d, i) => (
                <InputNumber
                  key={i}
                  value={d}
                  onChange={(v) => updateDay(idx, i, v)}
                />
              ))}
            </Space>

            <div style={{ marginTop: 10 }}>
              <Text>收益：{detail.totalReturn}%</Text>
              <br />
              <Text>回撤：{detail.drawdown}%</Text>
            </div>

            <div style={{ marginTop: 10 }}>
              <Button onClick={() => addDay(idx)}>+ 天</Button>
              <Button danger onClick={() => setDeleteIndex(idx)}>
                删除
              </Button>
            </div>
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