import { Modal, Form, Input, DatePicker, InputNumber, message } from 'antd';
import dayjs from 'dayjs';
import { addETF } from '../api'
import { useEffect } from 'react';

export default function EtfRecordModal({
  open,
  onClose,
  initialValues
}) {
  const [form] = Form.useForm();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        trade_date: values.trade_date.format('YYYY-MM-DD'),
        etf_code: values.etf_code.trim(),
        etf_name: values.etf_name?.trim() || null,
        change_percent: values.change_percent
      };

      await addETF(payload)

      message.success('ETF 记录已保存');
      form.resetFields();
      onClose(true);

    } catch (err) {
      if (err?.errorFields) return;
      message.error('保存失败');
      console.error(err);
    }
  };

  useEffect(() => {
    if (open) {
      form.setFieldsValue(initialValues)
    }
  }, [open,initialValues])

  return (
    <Modal
      title="新增 / 编辑 ETF 日记录"
      open={open}
      onOk={handleOk}
      onCancel={() => {
        form.resetFields();
        onClose(false);
      }}
      destroyOnHidden
      okText="保存"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          trade_date: initialValues?.trade_date
            ? dayjs(initialValues.trade_date)
            : dayjs(),
          etf_code: initialValues?.etf_code,
          etf_name: initialValues?.etf_name,
          change_percent: initialValues?.change_percent
        }}
      >
        <Form.Item
          label="日期"
          name="trade_date"
          rules={[{ required: true, message: '请选择日期' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="ETF 代码"
          name="etf_code"
          rules={[
            { required: true, message: '请输入 ETF 代码' },
            { pattern: /^\d{3,6}$/, message: 'ETF 代码格式不正确' }
          ]}
        >
          <Input placeholder="如：510300" />
        </Form.Item>

        <Form.Item
          label="ETF 名称"
          name="etf_name"
        >
          <Input placeholder="如：沪深300ETF（可选）" />
        </Form.Item>

        <Form.Item
          label="今日涨跌幅 (%)"
          name="change_percent"
          rules={[{ required: true, message: '请输入涨跌幅' }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={-99.99}
            max={99.99}
            precision={2}
            placeholder="如：1.41 或 -2.52"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
