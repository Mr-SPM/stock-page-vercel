import { Button, Card, Dropdown, List, message, Space, Spin, Statistic, Table } from 'antd'
import { getList, goLog, initStockList, addLog } from '@/api';
import { useEffect, useState } from 'react';
import { ColumnType } from 'antd/es/table';
import dayjs from 'dayjs';
export default function HomePage() {
    const [info, setInfo] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // 判断窗口宽度是否小于 768px（常见移动端断点）
        const checkIfMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        // 初始化检查
        checkIfMobile();

        // 监听窗口变化
        window.addEventListener("resize", checkIfMobile);

        // 组件卸载时移除监听
        return () => window.removeEventListener("resize", checkIfMobile);
    }, []);

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

    const onGetList = async (isOnline: 0 | 1) => {
        try {
            setLoading(true)
            const res = await getList({ isOnline })
            console.log(res)
            setInfo(res.data)
        } catch (e) {
            console.error(e)
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

    const onAddLog = async () => {
        await addLog()
        message.success('操作成功')
    }


    const onInitStockList = async () => {
        await initStockList()
        message.success('操作成功')
    }

    const menuProp = {
        items: [{
            label: '记录temp',
            key: 'temp'
        }, {
            label: '记录当天',
            key: 'log'
        }, {
            label: '更新列表',
            key: 'init'
        }],
        onClick: (e: any) => {
            switch (e.key) {
                case 'temp': return onLog()
                case 'log': return onAddLog()
                case 'init': return onInitStockList()
            }
        }
    }

    return (
        <Card className='my-card' title="量化实时" extra={<div style={{color: '#fff'}}>{dayjs(info[0]?.date).format('YYYY/MM/DD')}</div>}>
            <div style={{ marginBottom: 16 }}>
                <Space align='center' style={{ width: '100%' }} wrap>
                    <Button type='primary' onClick={() => onGetList(0)} style={{ width: '100%' }}>日志查询</Button>
                    <Button type='primary' onClick={() => onGetList(1)} style={{ width: '100%' }}>实时查询</Button>
                    <Dropdown.Button menu={menuProp} trigger={["click"]} danger>
                        更多
                    </Dropdown.Button>
                </Space>
            </div>
            <Spin spinning={loading}>
                {isMobile ? <List dataSource={info} pagination={{
                    pageSize: 10
                }} renderItem={(item) => (
                    <List.Item >
                        <List.Item.Meta
                            title={`${item.name}(${item.code})`}
                            description={<div><span>成交额：<b>{item.todayAmount}</b></span>&nbsp;&nbsp;&nbsp;<span>昨日：<b>{item.yesterdayAmount}</b></span></div>}
                        />
                    </List.Item>
                )}></List> : <Table columns={items} dataSource={info} pagination={{ defaultPageSize: 10 }} scroll={{ x: true, y: 500 }} />
                }
            </Spin>
        </Card>
    );
}
