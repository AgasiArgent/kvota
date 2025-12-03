'use client';

import React, { useState } from 'react';
import { Modal, Form, Input, Typography, App } from 'antd';
import { PhoneOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface PhoneRequiredModalProps {
  open: boolean;
  onSubmit: (phone: string) => Promise<void>;
}

/**
 * Modal that appears on first login if user has no phone number.
 * Phone is required for commercial proposal (КП) generation.
 * Cannot be dismissed - user must provide phone to continue.
 */
export function PhoneRequiredModal({ open, onSubmit }: PhoneRequiredModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { phone: string }) => {
    setLoading(true);
    try {
      await onSubmit(values.phone);
      message.success('Номер телефона сохранен');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <span>
          <PhoneOutlined style={{ marginRight: 8 }} />
          Укажите номер телефона
        </span>
      }
      open={open}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={null}
      width={450}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          Номер телефона необходим для генерации коммерческих предложений. Он будет указан в
          контактной информации КП.
        </Text>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label="Номер телефона"
          name="phone"
          rules={[
            { required: true, message: 'Введите номер телефона' },
            {
              pattern: /^[\d\s\-+()]{7,20}$/,
              message: 'Некорректный формат номера',
            },
          ]}
        >
          <Input
            prefix={<PhoneOutlined />}
            placeholder="+7 (999) 123-45-67"
            size="large"
            autoFocus
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: 40,
              backgroundColor: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 16,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Сохранение...' : 'Сохранить и продолжить'}
          </button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
