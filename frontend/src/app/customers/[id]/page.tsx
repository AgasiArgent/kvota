'use client';

import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Space,
  Typography,
  Row,
  Col,
  message,
  Spin,
  InputNumber,
  Tabs,
  Table,
  Tag,
  Popconfirm,
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { customerService, Customer } from '@/lib/api/customer-service';
import { quoteService } from '@/lib/api/quote-service';
import { validateINN, validateKPP, validateOGRN } from '@/lib/validation/russian-business';

const { Title } = Typography;
const { TextArea } = Input;

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const customerId = params.id as string;

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isEditMode, setIsEditMode] = useState(searchParams.get('mode') === 'edit');
  const [companyType, setCompanyType] = useState<string>('organization');

  useEffect(() => {
    fetchCustomer();
    fetchCustomerQuotes();
  }, [customerId]);

  const fetchCustomer = async () => {
    setLoading(true);
    try {
      const response = await customerService.getCustomer(customerId);
      if (response.success && response.data) {
        setCustomer(response.data);
        setCompanyType(response.data.company_type);
        form.setFieldsValue(response.data);
      } else {
        throw new Error(response.error || 'Failed to load customer');
      }
    } catch (error: any) {
      message.error(`Ошибка загрузки клиента: ${error.message}`);
      router.push('/customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerQuotes = async () => {
    try {
      const response = await quoteService.getQuotes({
        filters: { customer_id: customerId },
        page: 1,
        page_size: 10,
      });
      setQuotes(response.data);
    } catch (error: any) {
      console.error('Error fetching quotes:', error);
    }
  };

  const handleUpdate = async (values: any) => {
    setSaving(true);
    try {
      await customerService.updateCustomer(customerId, values);
      message.success('Клиент успешно обновлен');
      setIsEditMode(false);
      fetchCustomer();
    } catch (error: any) {
      message.error(`Ошибка обновления: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await customerService.deleteCustomer(customerId);
      message.success('Клиент успешно удален');
      router.push('/customers');
    } catch (error: any) {
      message.error(`Ошибка удаления: ${error.message}`);
    }
  };

  // Custom validators (same as create page)
  const validateINNField = (_: any, value: string) => {
    if (!value) return Promise.resolve();
    const validation = validateINN(value);
    if (!validation.isValid) {
      return Promise.reject(new Error(validation.error));
    }
    return Promise.resolve();
  };

  const validateKPPField = (_: any, value: string) => {
    if (!value) return Promise.resolve();
    const validation = validateKPP(value);
    if (!validation.isValid) {
      return Promise.reject(new Error(validation.error));
    }
    return Promise.resolve();
  };

  const validateOGRNField = (_: any, value: string) => {
    if (!value) return Promise.resolve();
    const validation = validateOGRN(value);
    if (!validation.isValid) {
      return Promise.reject(new Error(validation.error));
    }
    return Promise.resolve();
  };

  const getStatusTag = (status: string) => {
    const statusMap = {
      active: { color: 'green', text: 'Активный' },
      inactive: { color: 'default', text: 'Неактивный' },
      suspended: { color: 'red', text: 'Приостановлен' },
    };
    const config = statusMap[status as keyof typeof statusMap] || {
      color: 'default',
      text: status,
    };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getQuoteStatusTag = (status: string) => {
    const statusMap = {
      draft: { color: 'default', text: 'Черновик' },
      pending_approval: { color: 'orange', text: 'На утверждении' },
      approved: { color: 'green', text: 'Утверждено' },
      sent: { color: 'blue', text: 'Отправлено' },
      accepted: { color: 'cyan', text: 'Принято' },
      rejected: { color: 'red', text: 'Отклонено' },
    };
    return statusMap[status as keyof typeof statusMap] || { color: 'default', text: status };
  };

  const quoteColumns = [
    {
      title: 'Номер',
      dataIndex: 'quote_number',
      key: 'quote_number',
      render: (text: string, record: Quote) => (
        <a onClick={() => router.push(`/quotes/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: 'Название',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Сумма',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount: number, record: Quote) =>
        new Intl.NumberFormat('ru-RU', {
          style: 'currency',
          currency: record.currency || 'RUB',
        }).format(amount),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = getQuoteStatusTag(status);
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'Дата',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString('ru-RU'),
    },
  ];

  if (loading) {
    return (
      <MainLayout>
        <div style={{ textAlign: 'center', padding: '100px' }}>
          <Spin size="large" />
        </div>
      </MainLayout>
    );
  }

  if (!customer) return null;

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/customers')}>
                Назад
              </Button>
              <Title level={2} style={{ margin: 0 }}>
                {customer.name}
              </Title>
              {getStatusTag(customer.status)}
            </Space>
          </Col>
          <Col>
            <Space>
              {!isEditMode && (
                <Button type="primary" icon={<EditOutlined />} onClick={() => setIsEditMode(true)}>
                  Редактировать
                </Button>
              )}
              <Popconfirm
                title="Удалить клиента?"
                description="Это действие нельзя отменить. Все связанные КП останутся, но ссылка на клиента будет удалена."
                onConfirm={handleDelete}
                okText="Удалить"
                cancelText="Отмена"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />}>
                  Удалить
                </Button>
              </Popconfirm>
            </Space>
          </Col>
        </Row>

        <Tabs
          defaultActiveKey="info"
          items={[
            {
              key: 'info',
              label: 'Информация',
              children: (
                <Form form={form} layout="vertical" onFinish={handleUpdate} disabled={!isEditMode}>
                  <Row gutter={24}>
                    <Col xs={24} lg={16}>
                      <Card title="Основная информация">
                        <Row gutter={16}>
                          <Col xs={24}>
                            <Form.Item
                              name="name"
                              label="Название"
                              rules={[{ required: true, message: 'Введите название' }]}
                            >
                              <Input size="large" />
                            </Form.Item>
                          </Col>

                          <Col xs={24} md={12}>
                            <Form.Item
                              name="company_type"
                              label="Тип организации"
                              rules={[{ required: true }]}
                            >
                              <Select
                                size="large"
                                onChange={(value) => setCompanyType(value)}
                                options={[
                                  { label: 'ООО (Организация)', value: 'organization' },
                                  { label: 'ИП', value: 'individual_entrepreneur' },
                                  { label: 'Физическое лицо', value: 'individual' },
                                  { label: 'Государственный орган', value: 'government' },
                                ]}
                              />
                            </Form.Item>
                          </Col>

                          <Col xs={24} md={12}>
                            <Form.Item name="industry" label="Отрасль">
                              <Select
                                size="large"
                                options={[
                                  { label: 'Промышленность', value: 'manufacturing' },
                                  { label: 'Торговля', value: 'trade' },
                                  { label: 'IT и технологии', value: 'it_tech' },
                                  { label: 'Строительство', value: 'construction' },
                                  { label: 'Транспорт', value: 'transport' },
                                  { label: 'Финансы', value: 'finance' },
                                  { label: 'Другое', value: 'other' },
                                ]}
                              />
                            </Form.Item>
                          </Col>

                          <Col xs={24} md={12}>
                            <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
                              <Input size="large" />
                            </Form.Item>
                          </Col>

                          <Col xs={24} md={12}>
                            <Form.Item name="phone" label="Телефон">
                              <Input size="large" />
                            </Form.Item>
                          </Col>

                          <Col xs={24} md={12}>
                            <Form.Item name="status" label="Статус" rules={[{ required: true }]}>
                              <Select
                                size="large"
                                options={[
                                  { label: 'Активный', value: 'active' },
                                  { label: 'Неактивный', value: 'inactive' },
                                  { label: 'Приостановлен', value: 'suspended' },
                                ]}
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>

                      <Card title="Адрес" style={{ marginTop: 24 }}>
                        <Row gutter={16}>
                          <Col xs={24}>
                            <Form.Item name="address" label="Адрес">
                              <TextArea rows={2} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item name="city" label="Город">
                              <Input size="large" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item name="region" label="Регион">
                              <Input size="large" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item name="postal_code" label="Индекс">
                              <Input size="large" maxLength={6} />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>

                      <Card title="Реквизиты" style={{ marginTop: 24 }}>
                        <Row gutter={16}>
                          <Col xs={24} md={8}>
                            <Form.Item
                              name="inn"
                              label="ИНН"
                              rules={[{ validator: validateINNField }]}
                            >
                              <Input size="large" maxLength={12} />
                            </Form.Item>
                          </Col>
                          {companyType === 'organization' && (
                            <Col xs={24} md={8}>
                              <Form.Item
                                name="kpp"
                                label="КПП"
                                rules={[{ validator: validateKPPField }]}
                              >
                                <Input size="large" maxLength={9} />
                              </Form.Item>
                            </Col>
                          )}
                          <Col xs={24} md={8}>
                            <Form.Item
                              name="ogrn"
                              label={companyType === 'organization' ? 'ОГРН' : 'ОГРНИП'}
                              rules={[{ validator: validateOGRNField }]}
                            >
                              <Input size="large" maxLength={15} />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    </Col>

                    <Col xs={24} lg={8}>
                      <Card title="Финансовые условия">
                        <Form.Item name="credit_limit" label="Кредитный лимит (₽)">
                          <InputNumber
                            size="large"
                            style={{ width: '100%' }}
                            min={0}
                            formatter={(value) =>
                              `₽ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                            }
                            parser={(value) => value?.replace(/₽\s?|(\s*)/g, '') as any}
                          />
                        </Form.Item>
                        <Form.Item name="payment_terms" label="Условия оплаты (дней)">
                          <InputNumber
                            size="large"
                            style={{ width: '100%' }}
                            min={0}
                            max={365}
                            addonAfter="дней"
                          />
                        </Form.Item>
                      </Card>

                      <Card title="Примечания" style={{ marginTop: 24 }}>
                        <Form.Item name="notes">
                          <TextArea rows={6} />
                        </Form.Item>
                      </Card>

                      {isEditMode && (
                        <Card style={{ marginTop: 24 }}>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <Button
                              type="primary"
                              htmlType="submit"
                              icon={<SaveOutlined />}
                              size="large"
                              block
                              loading={saving}
                            >
                              Сохранить изменения
                            </Button>
                            <Button
                              size="large"
                              block
                              onClick={() => {
                                setIsEditMode(false);
                                form.setFieldsValue(customer);
                              }}
                            >
                              Отмена
                            </Button>
                          </Space>
                        </Card>
                      )}
                    </Col>
                  </Row>
                </Form>
              ),
            },
            {
              key: 'quotes',
              label: `Коммерческие предложения (${quotes.length})`,
              children: (
                <Card>
                  <Table
                    columns={quoteColumns}
                    dataSource={quotes}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                  />
                </Card>
              ),
            },
          ]}
        />
      </Space>
    </MainLayout>
  );
}
