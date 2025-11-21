'use client';

import React, { useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';

interface SubmitForApprovalModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (comment?: string) => Promise<void>;
  quoteNumber: string;
}

export default function SubmitForApprovalModal({
  open,
  onCancel,
  onSubmit,
  quoteNumber,
}: SubmitForApprovalModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      await onSubmit(values.comment);
      form.resetFields();
      message.success(`КП ${quoteNumber} отправлено на финансовое утверждение`);
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <span>
          <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
          Отправить на финансовое утверждение
        </span>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText="Отправить"
      cancelText="Отмена"
      confirmLoading={loading}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="КП для утверждения" style={{ marginBottom: 16 }}>
          <Input value={quoteNumber} disabled />
        </Form.Item>

        <Form.Item
          name="comment"
          label="Комментарий (необязательно)"
          help="Добавьте комментарий для финансового менеджера"
        >
          <Input.TextArea
            rows={4}
            placeholder="Например: Срочный заказ, требует быстрого утверждения"
            maxLength={500}
            showCount
          />
        </Form.Item>

        <div
          style={{
            padding: '12px',
            background: '#f0f2f5',
            borderRadius: '6px',
            marginTop: 16,
          }}
        >
          <strong>После отправки:</strong>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>КП будет направлено финансовому менеджеру</li>
            <li>Статус изменится на &quot;На финансовом утверждении&quot;</li>
            <li>Вы не сможете редактировать КП до принятия решения</li>
          </ul>
        </div>
      </Form>
    </Modal>
  );
}
