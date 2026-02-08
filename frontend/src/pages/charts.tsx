import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useParams } from 'umi'
import { queryETFSeries } from '@/api';
function calcCumulative(series: any) {
    let netValue = 1;

    return series.map((item: any) => {
        netValue *= 1 + item.change_percent / 100;
        return Number(((netValue - 1) * 100).toFixed(2));
    });
}


export default function EtfMonthChart() {
    const [data, setData] = useState<any[]>([]);
    const params = useParams()
    const date = params.date
    const etfCode = params.code
    const name = params.name
    useEffect(() => {
        if (!date || !etfCode) return;

        queryETFSeries({
            date,
            etf_code: etfCode
        }
        )
            .then(res => {
                setData(res.data.data || []);
            });
    }, [date, etfCode]);

    const dailyChange = data.map(d => d.change_percent);
    const dates = data.map(d => d.trade_date);
    const cumulativeChange = calcCumulative(data);

    const option = {
        title: {
            text: `${etfCode} ${name} 当月走势（波动 & 累计）`
        },
        tooltip: {
            trigger: 'axis',
            formatter: (params) => {
                const date = params[0].axisValue;
                const daily = params.find(p => p.seriesName === '日涨跌幅')?.value;
                const cumulative = params.find(p => p.seriesName === '累计涨跌幅')?.value;

                return `
        <strong>${date}</strong><br/>
        日涨跌幅：${daily}%<br/>
        累计涨跌幅：${cumulative}%
      `;
            }
        },
        legend: {
            data: ['日涨跌幅', '累计涨跌幅']
        },
        grid: {
            left: 60,
            right: 20,
            top: 60,
            bottom: 50
        },
        xAxis: {
            type: 'category',
            data: dates,
            axisLabel: {
                rotate: 45
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                formatter: '{value}%'
            }
        },
        series: [
            {
                name: '日涨跌幅',
                type: 'bar',
                data: dailyChange.map(v => ({
                    value: v,
                    itemStyle: {
                        color: v >= 0 ? '#f5222d' : '#52c41a',
                    },
                })),
            },
            {
                name: '累计涨跌幅',
                type: 'line',
                data: cumulativeChange,
                smooth: false,
                symbol: 'none',
                lineStyle: {
                    width: 2,
                    color: '#f5222d'
                }
            }
        ]
    };


    return <div style={{ height: 400, width: '80%', padding: 16, background: '#fff1f0' }}> <ReactECharts option={option} style={{ height: 400, width: '100%' }} /></div>;
}
