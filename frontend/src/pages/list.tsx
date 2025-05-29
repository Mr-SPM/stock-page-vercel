import { Button, Card, message, Space, Spin, Statistic, Table } from 'antd'
import { getList, goLog, initStockList } from '@/api';
import { useState } from 'react';
import { ColumnType } from 'antd/es/table';
import dayjs from 'dayjs';
export default function HomePage() {
    const [info, setInfo] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    const items: ColumnType[] = [{
        title: '股票',
        dataIndex: 'name',
        width: 100,
        render: (v, row) => <Button type="link" href={`https://finance.sina.com.cn/realstock/company/${row.code}/nc.shtml`} target='_blank'>{v}</Button>
    }, {
        title: '成交额（亿）',
        dataIndex: 'todayAmount',
        align: 'right',
        sorter: (a, b) => a.todayAmount - b.todayAmount,
        defaultSortOrder: 'descend',
        render: (t) => <span style={{ color: 'red' }}>{t}</span>,
        width: 140,
    }, {
        title: '昨日成交额（亿）',
        align: 'right',
        dataIndex: 'yesterdayAmount',
        width: 180,
    }, {
        title: '涨幅',
        dataIndex: 'amountIncrease',
        sorter: (a, b) => a.amountIncrease - b.amountIncrease,
        render: (t) => <span style={{ color: 'red' }}>{t}</span>,
        width: 80,
    }, {
        title: '连榜次数',
        dataIndex: 'consecutive_count',
    }]

    const onGetList = async (isOnline = 0 as any) => {
        setLoading(true)
        try {
            const res = await getList({ isOnline })
            console.log(res)
            setInfo(res.data)
        } finally {
            setLoading(false)
        }
    }

    const onLog = async () => {
        try {
            const res = await goLog()
            message.success('操作成功')
        } catch (e) {
            message.error('记录日志失败')
        }
    }

    const onInitStockList = async () => {
        await initStockList()
        message.success('操作成功')
    }

    return (
        <Card style={{width: '100%'}} title="量化实时" extra={<Statistic title="交易日" value={dayjs(info[0]?.date).format('YYYY/MM/DD')} />}>
            <div style={{ marginBottom: 16 }}>
                <Space align='center' style={{ width: '100%' }}>

                    <Button type='primary' onClick={() => onGetList()} style={{ width: '100%' }}>日志查询</Button>
                    <Button type='primary' onClick={() => onGetList(1)} style={{ width: '100%' }}>实时查询</Button>
                    <Button type='primary' onClick={onLog} style={{ width: '100%' }}>记录日志</Button>
                    <Button danger type='primary' onClick={onInitStockList} style={{ width: '100%' }}>更新列表</Button>
                </Space>
            </div>
            <Spin spinning={loading}>
                <Table columns={items} dataSource={info} pagination={{ defaultPageSize: 10 }} scroll={{x: true, y: 500}}/>
            </Spin>
        </Card>
    );
}
