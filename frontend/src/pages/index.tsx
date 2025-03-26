import { Button, Card, Col, Descriptions, DescriptionsProps, Input, message, Row, Select, Spin, Table } from 'antd'
import { getInfo, getList, getStockList } from '@/api';
import { useEffect, useState } from 'react';
import { ColumnType } from 'antd/es/table';
export default function HomePage() {
  const [info, setInfo] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const onGetInfo = async () => {
    if (!code) {
      message.error('编码必填')
    }
    setLoading(true)
    try {
      const res = await getInfo({ code })
      setInfo(res.data)
    } catch (err) {
      message.error('查询错误，请正确输入编码')
    } finally {
      setLoading(false)
    }
  }
  const [code, setCode] = useState('')
  const items: ColumnType[] = [{
    title: '股票',
    dataIndex: 'name',
  }, {
    title: '昨日值',
    dataIndex: 'yestclose',
  }, {
    title: '当前值',
    dataIndex: 'price',
    render: (t) => <span style={{ color: 'red' }}>{t}</span>
  }, {
    title: '涨幅',
    dataIndex: 'rate',
    render: (t, info) => <span style={{ color: info.price > info.yestclose ? 'red' : 'green' }}>{(info.price / info.yestclose - 1).toFixed(2)}</span>
  }, {
    title: '成交额(万)',
    dataIndex: 'amount',
  }, {
    title: '日期',
    dataIndex: 'date'
  }]


  const [list, setList] = useState<any[]>(JSON.parse(localStorage.getItem('list') || '[]'))
  useEffect(() => {
    if (!list?.length) {
      getStockList().then(res => {
        setList(res.data)
        localStorage.setItem('list', JSON.stringify(res.data))
      })
    }
  }, [list])
  return (
    <Card title="数据查询" style={{ width: 880 }}>
      <Row gutter={16} style={{marginBottom: 16}}>
        <Col span={16}>
          <Select placeholder='请输入编码' style={{ width: '100%' }} onChange={v => setCode(v)} showSearch fieldNames={{
            label: 'name',
            value: 'value'
          }} options={list} optionRender={item => `${item.label}(${item.value})`} allowClear />
        </Col>
        <Col span={8}>
          <Button type='primary' onClick={onGetInfo} disabled={!code} style={{ width: '100%' }}>查询</Button>
        </Col>
      </Row>
      <Spin  spinning={loading}>
        <Table columns={items} dataSource={info} />
      </Spin>
    </Card>
  );
}
