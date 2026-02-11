import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { DatePicker } from "antd";
import dayjs from "dayjs";

/* ===================== 类型定义 ===================== */

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

/* ===================== 主题 ===================== */

const theme = {
    bg: "#000",
    panel: "#0a0a0a",
    border: "#1f1f1f",
    text: "#ffffff",
    subText: "#888",
    up: "#ff0000",
    down: "#00ff00",
    accent: "#ffa500",
    font: "Consolas, monospace",
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
const latest = (series?: ETFSeriesItem[]) =>
    series?.length ? series[series.length - 1].cumulative_return : 0;

const toPercent = (v: number) => (v * 100).toFixed(2) + "%";

const color = (v: number) => ({
    color: v >= 0 ? theme.up : theme.down,
});
/* ===================== 主组件 ===================== */

export default function ETFTerminalPro() {
    const currentMonth = dayjs().format("YYYY-MM");

    const [month, setMonth] = useState(currentMonth);
    const [data, setData] = useState<ETFItem[]>([]);
    const [selected, setSelected] = useState<ETFItem | null>(null);

    /* ===================== 获取数据 ===================== */

    useEffect(() => {
        async function fetchData() {
            const res = await fetch(`/api/etf/series?month=${month}`);
            const json = await res.json();
            if (json.success) {
                const list = json.data || [];
                setData(list);

                // 默认选中收益最高
                if (list.length) {
                    const best = [...list].sort(
                        (a, b) =>
                            latest(b.series) - latest(a.series)
                    )[0];
                    setSelected(best);
                } else {
                    setSelected(null);
                }
            }
        }
        fetchData();
    }, [month]);

    /* ===================== 工具函数 ===================== */

    const latest = (series?: ETFSeriesItem[]) =>
        series?.length ? series[series.length - 1].cumulative_return : 0;



    const consecutiveUp = (series?: ETFSeriesItem[]) => {
        if (!series) return 0;
        let max = 0,
            current = 0;
        for (const s of series) {
            if ((s.daily_return ?? 0) > 0) {
                current++;
                max = Math.max(max, current);
            } else current = 0;
        }
        return max;
    };

    const maxDrawdown = (series?: ETFSeriesItem[]) => {
        if (!series) return 0;
        let peak = -Infinity;
        let dd = 0;
        for (const s of series) {
            peak = Math.max(peak, s.cumulative_return);
            dd = Math.max(dd, peak - s.cumulative_return);
        }
        return dd;
    };

    const volatility = (series?: ETFSeriesItem[]) => {
        if (!series?.length) return 0;
        const arr = series.map(s => s.daily_return ?? 0);
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance =
            arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
        return Math.sqrt(variance);
    };

    /* ===================== 排行榜 ===================== */

    const topReturn = useMemo(
        () =>
            [...data]
                .sort((a, b) => latest(b.series) - latest(a.series))
                .slice(0, 5),
        [data]
    );

    const topUp = useMemo(
        () =>
            [...data]
                .sort((a, b) => consecutiveUp(b.series) - consecutiveUp(a.series))
                .slice(0, 5),
        [data]
    );

    const topDrawdown = useMemo(
        () =>
            [...data]
                .sort((a, b) => maxDrawdown(a.series) - maxDrawdown(b.series))
                .slice(0, 5),
        [data]
    );

    const topVol = useMemo(
        () =>
            [...data]
                .sort((a, b) => volatility(b.series) - volatility(a.series))
                .slice(0, 5),
        [data]
    );

    /* ===================== 主图 ===================== */

    const chartOption = useMemo(() => {
        if (!selected?.series?.length) return {};

        const dates = selected.series.map(s => s.trade_date);
        const cumulative = selected.series.map(
            s => s.cumulative_return * 100
        );
        const daily = selected.series.map(
            s => (s.daily_return ?? 0) * 100
        );

        return {
            backgroundColor: theme.panel,
            tooltip: { trigger: "axis" },
            legend: { data: ["Cumulative", "Daily"], textStyle: { color: "#fff" } },
            xAxis: { type: "category", data: dates },
            yAxis: [
                { type: "value", axisLabel: { formatter: "{value}%" } },
                { type: "value", axisLabel: { formatter: "{value}%" } },
            ],
            series: [
                {
                    name: "Cumulative",
                    type: "line",
                    smooth: true,
                    showSymbol: false,
                    data: cumulative,
                },
                {
                    name: "Daily",
                    type: "bar",
                    yAxisIndex: 1,
                    data: daily,
                    itemStyle: {
                        color: (p: any) =>
                            p.value >= 0 ? theme.up : theme.down,
                    },
                },
            ],
        };
    }, [selected]);

    /* ===================== UI ===================== */

    return (
        <div
            style={{
                background: theme.bg,
                minHeight: "100vh",
                color: theme.text,
                fontFamily: theme.font,
                width: "100%",
            }}
        >
            {/* 顶部KPI条 */}
            <div
                style={{
                    padding: "8px 16px",
                    borderBottom: `1px solid ${theme.border}`,
                    display: "flex",
                    justifyContent: "space-between",
                }}
            >
                <div>ETF TERMINAL PRO</div>
                <div>
                    <DatePicker
                        picker="month"
                        value={dayjs(month)}
                        onChange={d => d && setMonth(d.format("YYYY-MM"))}
                    />
                </div>
            </div>

            {/* 主体 */}
            <div style={{ display: "grid", gridTemplateColumns: "320px 1fr" }}>
                {/* 左侧排行榜 */}
                <div
                    style={{
                        borderRight: `1px solid ${theme.border}`,
                        padding: 12,
                    }}
                >
                    <RankBlock title="RETURN TOP5" list={topReturn} metric={latest} />
                    <RankBlock title="UP STREAK" list={topUp} metric={consecutiveUp} />
                    <RankBlock
                        title="LOWEST DRAWDOWN"
                        list={topDrawdown}
                        metric={maxDrawdown}
                        invert
                    />
                    <RankBlock title="VOLATILITY" list={topVol} metric={volatility} />
                </div>

                {/* 右侧主图 */}
                <div style={{ padding: 16 }}>
                    <div style={{ marginBottom: 10 }}>
                        {selected
                            ? `${selected.name} (${selected.symbol})`
                            : "Select ETF"}
                    </div>
                    <ReactECharts option={chartOption} style={{ height: 420, width: '100%' }} />

                    {/* 底部分析模块 */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            gap: 12,
                            marginTop: 20,
                        }}
                    >
                        <RiskMatrix data={data} />
                        <ReturnDistribution data={data} />
                        <HeatBar data={data} />
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ===================== 排行榜组件 ===================== */

function RankBlock({
    title,
    list,
    metric,
    invert = false,
}: any) {
    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{ color: theme.accent, marginBottom: 6 }}>{title}</div>
            {list.map((etf: ETFItem) => {
                const value = metric(etf.series);
                return (
                    <div
                        key={etf.symbol}
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                        }}

                    >
                        <span>{etf.name}</span>
                        <span
                            style={{
                                color: invert
                                    ? theme.up
                                    : value >= 0
                                        ? theme.up
                                        : theme.down,
                            }}
                        >
                            {typeof value === "number"
                                ? (value * 100).toFixed(2)
                                : value}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

/* ===================== 风险矩阵 ===================== */

function RiskMatrix({ data }: { data: ETFItem[] }) {
    const option = {
        backgroundColor: theme.panel,
        xAxis: { name: "Volatility", type: "value" },
        yAxis: { name: "Return", type: "value" },
        series: [
            {
                type: "scatter",
                data: data.map(d => [
                    volatility(d.series),
                    latest(d.series),
                ]),
            },
        ],
    };

    return <ReactECharts option={option} style={{ height: 260 }} />;
}

/* ===================== 分布 ===================== */

function ReturnDistribution({ data }: { data: ETFItem[] }) {
    const returns = data.map(d => latest(d.series));
    return (
        <ReactECharts
            option={{
                backgroundColor: theme.panel,
                xAxis: { type: "category", data: returns.map((_, i) => i) },
                yAxis: { type: "value" },
                series: [{ type: "bar", data: returns }],
            }}
            style={{ height: 260 }}
        />
    );
}

/* ===================== 热力条 ===================== */

function HeatBar({ data }: { data: ETFItem[] }) {
    const sorted = [...data].sort(
        (a, b) => latest(b.series) - latest(a.series)
    );

    return (
        <div style={{ background: theme.panel, padding: 8, height: 260, overflowY: "auto" }}>
            {sorted.map(etf => {
                const value = latest(etf.series);
                return (
                    <div key={etf.symbol} style={{ fontSize: 11 }}>
                        {etf.name} <span
                            style={{
                                color: value
                                    ? theme.up
                                    : value >= 0
                                        ? theme.up
                                        : theme.down,
                            }}
                        >
                            {toPercent(value)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
