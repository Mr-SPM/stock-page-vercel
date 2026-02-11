import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import {
    DatePicker,
    Card,
    Row,
    Col,
    Typography,
    Table,
    Skeleton,
} from "antd";
import dayjs from "dayjs";

const { Title } = Typography;

/* ================= 类型定义 ================= */

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

/* ================= 主组件 ================= */

export default function ETFDashboardPro() {
    const currentMonth = dayjs().format("YYYY-MM");

    const [month, setMonth] = useState(currentMonth);
    const [data, setData] = useState<ETFItem[]>([]);
    const [selected, setSelected] = useState<ETFItem | null>(null);
    const [loading, setLoading] = useState(true);

    /* ================= 获取数据 ================= */

    useEffect(() => {
        setLoading(true);

        fetch(`/api/etf/series?month=${month}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.success) {
                    const list = json.data || [];
                    setData(list);

                    // 自动选中冠军
                    if (list.length) {
                        const champion = [...list].sort(
                            (a, b) => latestReturn(b) - latestReturn(a)
                        )[0];
                        setSelected(champion);
                    } else {
                        setSelected(null);
                    }
                }
            })
            .finally(() => setLoading(false));
    }, [month]);

    /* ================= 工具函数 ================= */

    const toPercent = (v: number) =>
        (v * 100).toFixed(2) + "%";

    const colorize = (v: number) => ({
        color: v >= 0 ? "#ff4d4f" : "#52c41a",
        fontWeight: 600,
    });

    const latestReturn = (etf: ETFItem) =>
        etf?.series?.length
            ? etf.series[etf.series.length - 1].cumulative_return
            : 0;

    const maxDrawdown = (series: ETFSeriesItem[]) => {
        let peak = -Infinity;
        let maxDD = 0;
        for (const s of series) {
            peak = Math.max(peak, s.cumulative_return);
            maxDD = Math.max(maxDD, peak - s.cumulative_return);
        }
        return maxDD;
    };

    /* ================= KPI ================= */

    const avgReturn = useMemo(() => {
        if (!data.length) return 0;
        return (
            data.reduce((sum, d) => sum + latestReturn(d), 0) /
            data.length
        );
    }, [data]);

    const bestETF = useMemo(() => {
        if (!data.length) return null;
        return [...data].sort(
            (a, b) => latestReturn(b) - latestReturn(a)
        )[0];
    }, [data]);

    const worstDrawdown = useMemo(() => {
        if (!data.length) return null;
        return [...data].sort(
            (a, b) =>
                maxDrawdown(b.series) -
                maxDrawdown(a.series)
        )[0];
    }, [data]);

    /* ================= 排行榜 ================= */

    const topRank = [...data]
        .sort((a, b) => latestReturn(b) - latestReturn(a))
        .slice(0, 5);

    /* ================= 图表 ================= */

    const chartOption = useMemo(() => {
        if (!selected || !selected.series?.length) {
            return {
                title: {
                    text: "暂无数据",
                    left: "center",
                    textStyle: { color: "#999" },
                },
            };
        }

        const dates = selected.series.map((s) => s.trade_date);
        const cumulative = selected.series.map(
            (s) => s.cumulative_return * 100
        );
        const daily = selected.series.map(
            (s) => (s.daily_return ?? 0) * 100
        );

        return {
            backgroundColor: "#0f172a",
            tooltip: { trigger: "axis" },
            legend: {
                data: ["累计涨幅", "单日涨跌"],
                textStyle: { color: "#fff" },
            },
            grid: { left: 50, right: 50, top: 50, bottom: 50 },
            xAxis: {
                type: "category",
                data: dates,
                axisLine: { lineStyle: { color: "#888" } },
                axisLabel: { color: "#ccc" },
            },
            yAxis: [
                {
                    type: "value",
                    axisLabel: { formatter: "{value}%" },
                    axisLine: { lineStyle: { color: "#888" } },
                },
                {
                    type: "value",
                    axisLabel: { formatter: "{value}%" },
                    axisLine: { lineStyle: { color: "#888" } },
                },
            ],
            animationDuration: 500,
            series: [
                {
                    name: "累计涨幅",
                    type: "line",
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { width: 2 },
                    data: cumulative,
                },
                {
                    name: "单日涨跌",
                    type: "bar",
                    yAxisIndex: 1,
                    data: daily,
                    itemStyle: {
                        color: (params: any) =>
                            params.value >= 0
                                ? "#ff4d4f"
                                : "#52c41a",
                    },
                },
            ],
        };
    }, [selected]);

    const maxConsecutiveUp = (series) => {
        let max = 0;
        let current = 0;

        for (const s of series) {
            if ((s.daily_return ?? 0) > 0) {
                current++;
                max = Math.max(max, current);
            } else {
                current = 0;
            }
        }

        return max;
    };

    const volatility = (series) => {
        const arr = series.map(s => s.daily_return ?? 0);
        const mean =
            arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

        const variance =
            arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
            (arr.length || 1);

        return Math.sqrt(variance);
    };


    const upRank = [...data]
        .map(d => ({
            ...d,
            value: maxConsecutiveUp(d.series)
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    const drawdownRank = [...data]
        .map(d => ({
            ...d,
            value: maxDrawdown(d.series)
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    const volatilityRank = [...data]
        .map(d => ({
            ...d,
            value: volatility(d.series)
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);


    /* ================= UI ================= */

    return (
        <div
            style={{
                padding: 24,
                background: "#0f172a",
                minHeight: "100vh",
            }}
        >
            <Title level={2} style={{ color: "#fff", marginBottom: 16 }}>
                ETF Financial Dashboard
            </Title>


            <DatePicker
                picker="month"
                value={dayjs(month)}
                onChange={(d) => d && setMonth(d.format("YYYY-MM"))}
                style={{
                    marginBottom: 20,
                    background: "#1e293b",
                    borderColor: "#334155",
                    color: "#fff"
                }}
            />

            {loading ? (
                <Skeleton active />
            ) : (
                <>
                    {/* KPI */}
                    <Row gutter={16} style={{ marginBottom: 20 }}>
                        <Col span={6}>
                            <Card>
                                平均涨幅
                                <div style={colorize(avgReturn)}>
                                    {toPercent(avgReturn)}
                                </div>
                            </Card>
                        </Col>

                        <Col span={6}>
                            <Card>
                                本月冠军
                                <div>
                                    {bestETF?.name || "-"}
                                    {bestETF && (
                                        <div style={colorize(latestReturn(bestETF))}>
                                            {toPercent(latestReturn(bestETF))}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </Col>

                        <Col span={6}>
                            <Card>
                                最大回撤ETF
                                <div>
                                    {worstDrawdown?.name || "-"}
                                    {worstDrawdown && (
                                        <div>
                                            {toPercent(
                                                -maxDrawdown(
                                                    worstDrawdown.series
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </Col>

                        <Col span={6}>
                            <Card>
                                ETF数量
                                <div>{data.length}</div>
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={16} style={{ marginBottom: 20 }}>
                        <Col span={6}>
                            <Card title="累计涨幅 TOP5">
                                <Table
                                    size="small"
                                    pagination={false}
                                    rowKey="symbol"
                                    dataSource={topRank}
                                    columns={[
                                        {
                                            title: "ETF",
                                            render: (_, r) =>
                                                `${r.name} (${r.symbol})`,
                                        },
                                        {
                                            title: "涨幅",
                                            render: (_, r) => (
                                                <span
                                                    style={colorize(
                                                        latestReturn(r)
                                                    )}
                                                >
                                                    {toPercent(
                                                        latestReturn(r)
                                                    )}
                                                </span>
                                            ),
                                        },
                                    ]}
                                    onRow={(record) => ({
                                        onClick: () => setSelected(record),
                                    })}
                                />
                            </Card>

                        </Col>
                        {/* 连涨天数 */}
                        <Col span={6}>
                            <Card title="连涨天数 TOP5">
                                <Table
                                    size="small"
                                    pagination={false}
                                    rowKey="symbol"
                                    dataSource={upRank}
                                    columns={[
                                        {
                                            title: "ETF",
                                            render: (_, r) =>
                                                `${r.name} (${r.symbol})`,
                                        },
                                        {
                                            title: "连涨天数",
                                            render: (_, r) => (
                                                <span style={{ color: "#ff4d4f" }}>
                                                    {r.value} 天
                                                </span>
                                            ),
                                        },
                                    ]}
                                />
                            </Card>
                        </Col>

                        {/* 最大回撤 */}
                        <Col span={6}>
                            <Card title="最大回撤 TOP5">
                                <Table
                                    size="small"
                                    pagination={false}
                                    rowKey="symbol"
                                    dataSource={drawdownRank}
                                    columns={[
                                        {
                                            title: "ETF",
                                            render: (_, r) =>
                                                `${r.name} (${r.symbol})`,
                                        },
                                        {
                                            title: "回撤",
                                            render: (_, r) => (
                                                <span style={{ color: "#52c41a" }}>
                                                    {(r.value * 100).toFixed(2)}%
                                                </span>
                                            ),
                                        },
                                    ]}
                                />
                            </Card>
                        </Col>

                        {/* 波动率 */}
                        <Col span={6}>
                            <Card title="波动率 TOP5">
                                <Table
                                    size="small"
                                    pagination={false}
                                    rowKey="symbol"
                                    dataSource={volatilityRank}
                                    columns={[
                                        {
                                            title: "ETF",
                                            render: (_, r) =>
                                                `${r.name} (${r.symbol})`,
                                        },
                                        {
                                            title: "波动率",
                                            render: (_, r) => (
                                                <span>
                                                    {(r.value * 100).toFixed(2)}%
                                                </span>
                                            ),
                                        },
                                    ]}
                                />
                            </Card>
                        </Col>


                    </Row>
                    {/* 图表 */}
                    <Card
                        title={
                            selected
                                ? `${selected.name} (${selected.symbol})`
                                : "走势"
                        }
                    >
                        <ReactECharts
                            option={chartOption}
                            style={{ height: 420 }}
                        />
                    </Card>
                </>
            )}
        </div>
    );
}
