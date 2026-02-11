import React, { useEffect, useState } from "react";
import { Spin, Alert } from "antd";
import EtfSingleChart from "../components/single";
import { useParams } from "umi";

export default function EtfDetail() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [chartData, setChartData] = useState<any>(null);
    const params = useParams();
    const month = params.month;
    const symbol = params.code;

    useEffect(() => {
        if (!month || !symbol) return;

        async function fetchData() {
            setLoading(true);
            setError(null);

            try {
                const res = await fetch(
                    `/api/etf/series-single?month=${month}&symbol=${symbol}`
                );

                const json = await res.json();

                if (!json.success) {
                    throw new Error(json.error || "Request failed");
                }

                setChartData(json);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [month, symbol]);

    if (loading) {
        return <Spin />;
    }

    if (error) {
        return <Alert type="error" message={error} />;
    }

    if (!chartData) {
        return null;
    }

    return (
        <div style={{ padding: 24, width: '100%' }}>
            <EtfSingleChart
                data={chartData.data}
                name={chartData.name}
                symbol={chartData.symbol}
            />
        </div>
    );
}
