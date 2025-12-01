'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, message, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { config } from '@/lib/config';
import { getAuthToken } from '@/lib/auth/auth-helper';
import { useAuth } from '@/lib/auth/AuthProvider';

const { Text } = Typography;

interface Customer {
  id: string;
  name: string;
  email?: string;
}

interface CreateQuoteModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: (quoteId: string, quoteNumber: string) => void;
  selectedFile: File | null;
}

export default function CreateQuoteModal({
  open,
  onCancel,
  onSuccess,
  selectedFile,
}: CreateQuoteModalProps) {
  const { profile } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Fetch customers when modal opens
  useEffect(() => {
    if (open && profile?.organization_id) {
      fetchCustomers();
    }
  }, [open, profile?.organization_id]);

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        message.error('Не авторизован');
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/customers?limit=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки клиентов');
      }

      const data = await response.json();
      setCustomers(data.customers || data || []);
    } catch (error: any) {
      message.error(error.message || 'Ошибка загрузки клиентов');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      message.error('Файл не выбран');
      return;
    }

    try {
      setLoading(true);
      const values = await form.validateFields();

      const token = await getAuthToken();
      if (!token) {
        message.error('Не авторизован');
        return;
      }

      // Create form data with file and customer_id
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('customer_id', values.customer_id);

      const response = await fetch(`${config.apiUrl}/api/quotes/upload-excel-validation`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка создания КП');
      }

      // Get quote info from headers
      // Note: X-Quote-Number is URL-encoded because HTTP headers must be ASCII-safe
      const quoteId = response.headers.get('X-Quote-Id');
      const quoteNumberEncoded = response.headers.get('X-Quote-Number');
      const quoteNumber = quoteNumberEncoded ? decodeURIComponent(quoteNumberEncoded) : null;

      // Download the validation file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `validation_${selectedFile.name.replace(/\.(xlsx|xls|xlsm)$/i, '')}_${new Date().toISOString().slice(0, 10)}.xlsm`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Reset form and close modal
      form.resetFields();

      if (quoteId && quoteNumber) {
        message.success(`КП ${quoteNumber} создано и сохранено`);
        onSuccess(quoteId, quoteNumber);
      } else {
        message.success('Расчёт выполнен. Файл скачан.');
        onCancel();
      }
    } catch (error: any) {
      message.error(error.message || 'Ошибка создания КП');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <span>
          <FileTextOutlined style={{ color: '#1890ff', marginRight: 8 }} />
          Создать коммерческое предложение
        </span>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText="Создать КП"
      cancelText="Отмена"
      confirmLoading={loading}
      width={500}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="Файл">
          <div
            style={{
              padding: '8px 12px',
              background: '#f5f5f5',
              borderRadius: '6px',
              border: '1px solid #d9d9d9',
            }}
          >
            <Text>{selectedFile?.name || 'Не выбран'}</Text>
          </div>
        </Form.Item>

        <Form.Item
          name="customer_id"
          label="Клиент"
          rules={[{ required: true, message: 'Выберите клиента' }]}
        >
          <Select
            placeholder="Выберите клиента"
            loading={loadingCustomers}
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
            }
          >
            {customers.map((customer) => (
              <Select.Option key={customer.id} value={customer.id}>
                {customer.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <div
          style={{
            padding: '12px',
            background: '#e6f7ff',
            borderRadius: '6px',
            marginTop: 16,
            border: '1px solid #91d5ff',
          }}
        >
          <strong>После создания:</strong>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>Файл с расчётом будет скачан</li>
            <li>КП будет сохранено в базу данных</li>
            <li>КП появится в списке со статусом &quot;Черновик&quot;</li>
          </ul>
        </div>
      </Form>
    </Modal>
  );
}
