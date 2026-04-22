import EtfRecordModal from '@/components/modal';
import { Button, Calendar, ConfigProvider } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { useEffect, useState } from 'react';
import { queryETf } from '../api'
import zhCN from 'antd/locale/zh_CN';
import { useNavigate } from 'umi';
export default function ETFPage() {
    const [open, setOpen] = useState(false);
    const [date, setDate] = useState(dayjs());

    const [data, setData] = useState<Record<string, any[]>>({});
    const [month, setMonth] = useState(dayjs().format('YYYY-MM'))

    useEffect(() => {
        queryETf(month).then((res) => {
            setData(res.data?.data)
        })
    }, [month])

    const navigate = useNavigate()


    const goXueqiu = (symbol: string) => {
        window.open(`https://xueqiu.com/S/${symbol}`)
    }

    const dateCellRender = (value: Dayjs) => {
        const dateStr = value.format('YYYY-MM-DD')
        if (data[dateStr]) {
            return <ul className='my-date-list' onClick={(e) => e.stopPropagation()}>
                {data[dateStr].map(item => <li onClick={() => goXueqiu(item.symbol)} title={item.symbol} >{item.name}&nbsp;<span style={{ color: item.percent > 0 ? '#ff4d4f' : '#73d13d' }}>{item.percent}</span></li>)}
            </ul>
        }
    }
    return <ConfigProvider locale={zhCN}><div className='my-etf'>
        <Button danger style={{ marginBottom: 16 }} onClick={() => navigate('/all/' + month)}>榜单</Button>
        <Calendar dateCellRender={dateCellRender} style={{ borderRadius: 8 }} onSelect={(value) => {
            setMonth(value.format('YYYY-MM'))
            setDate(value);
        }} />
        <EtfRecordModal
            open={open}
            onClose={() => setOpen(false)}
            initialValues={{
                trade_date: date
            }}
        /></div>
    </ConfigProvider>
}
