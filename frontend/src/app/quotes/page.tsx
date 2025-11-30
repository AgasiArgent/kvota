'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Card,
  Tag,
  Typography,
  message,
  Popconfirm,
  Row,
  Col,
  Statistic,
  DatePicker,
  Drawer,
  Descriptions,
  Spin,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { QuoteService, QuoteDetailsResponse } from '@/lib/api/quote-service';
import { useAuth } from '@/lib/auth/AuthProvider';
import dayjs, { Dayjs } from 'dayjs';
import { QuoteItem } from '@/lib/types/platform';
import SubmitForApprovalModal from '@/components/quotes/SubmitForApprovalModal';
import { config } from '@/lib/config';
import { getAuthToken } from '@/lib/auth/auth-helper';

const { Title } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

interface QuoteListItem {
  id: string;
  quote_number: string;
  customer_name?: string;
  title?: string;
  status: string;
  workflow_state?: string;
  total_amount?: number;
  total_usd?: number;
  total?: number; // Backend uses 'total' instead of 'total_amount'
  total_profit_usd?: number;
  currency?: string;
  quote_date?: string;
  valid_until?: string;
  created_at: string;
}

export default function QuotesPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<QuoteDetailsResponse | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Submit modal state
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitQuoteId, setSubmitQuoteId] = useState<string | null>(null);
  const [submitQuoteNumber, setSubmitQuoteNumber] = useState<string>('');

  const quoteService = new QuoteService();

  useEffect(() => {
    console.log('[useEffect] Triggered - profile:', profile?.organization_id, 'page:', currentPage);
    if (profile?.organization_id) {
      fetchQuotes();
    } else {
      console.log('[useEffect] BLOCKED - no organization_id');
    }
  }, [currentPage, pageSize, searchTerm, statusFilter, dateRange, profile]);

  const fetchQuotes = async () => {
    console.log(
      '[fetchQuotes] START - profile:',
      profile?.email,
      'org_id:',
      profile?.organization_id
    );
    setLoading(true);
    try {
      const filters: Record<string, any> = {};

      if (searchTerm) {
        filters.search = searchTerm;
      }
      if (statusFilter) {
        filters.workflow_state = statusFilter;
      }
      if (dateRange) {
        filters.date_from = dateRange[0].format('YYYY-MM-DD');
        filters.date_to = dateRange[1].format('YYYY-MM-DD');
      }

      const organizationId = profile?.organization_id || '';
      if (!organizationId) {
        message.error('Не удалось определить организацию');
        return;
      }

      const response = await quoteService.getQuotes(organizationId, filters, {
        page: currentPage,
        limit: pageSize,
      });
      console.log('[fetchQuotes] API response:', response);
      if (response.success && response.data) {
        console.log('[fetchQuotes] Quotes array:', response.data.quotes);
        console.log('[fetchQuotes] Total items:', response.data.pagination?.total_items);
        setQuotes(response.data.quotes || []);
        setTotalCount(response.data.pagination?.total_items || 0);
      } else {
        console.error('[fetchQuotes] ERROR:', response.error);
        message.error(response.error || 'Ошибка загрузки КП');
      }
    } catch (error: any) {
      message.error(`Ошибка загрузки КП: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const organizationId = profile?.organization_id || '';
      if (!organizationId) {
        message.error('Не удалось определить организацию');
        return;
      }

      const response = await quoteService.deleteQuote(id, organizationId);
      if (response.success) {
        message.success('КП перемещено в корзину');
        fetchQuotes();
      } else {
        message.error(response.error || 'Ошибка удаления');
      }
    } catch (error: any) {
      message.error(`Ошибка удаления: ${error.message}`);
    }
  };

  const handleSubmitForApproval = async (comment?: string) => {
    if (!submitQuoteId) return;

    try {
      const token = await getAuthToken();
      if (!token) {
        message.error('Не авторизован');
        return;
      }

      const response = await fetch(
        `${config.apiUrl}/api/quotes/${submitQuoteId}/submit-for-financial-approval`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
          body: comment || '',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка отправки на утверждение');
      }

      setSubmitModalOpen(false);
      message.success('КП отправлено на финансовое утверждение');
      fetchQuotes(); // Refresh the list
    } catch (error: any) {
      message.error(error.message || 'Ошибка отправки на утверждение');
      throw error;
    }
  };

  const openSubmitModal = (id: string, quoteNumber: string) => {
    setSubmitQuoteId(id);
    setSubmitQuoteNumber(quoteNumber);
    setSubmitModalOpen(true);
  };

  const openDrawer = async (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    setDrawerOpen(true);
    setDrawerLoading(true);

    try {
      const organizationId = profile?.organization_id || '';
      if (!organizationId) {
        message.error('Не удалось определить организацию');
        return;
      }

      const response = await quoteService.getQuoteDetails(quoteId, organizationId);
      console.log('[Drawer] API response:', response);

      if (response.success && response.data) {
        // Transform flat QuoteWithItems response to nested structure
        // Backend returns: { id, quote_number, status, ..., items: [...], customer: {...}, approvals: [...] }
        // Drawer expects: { quote: {...}, items: [...], customer: {...}, workflow: {...} }

        // Destructure to separate items/customer from quote fields
        const { items, customer, ...quoteFields } = response.data as any;

        // Map backend field names to what the drawer expects
        const quote = {
          ...quoteFields,
          total: quoteFields.total_amount, // Map total_amount -> total
        };

        const transformed = {
          quote,
          items: items || [],
          customer: customer || null,
          workflow: null, // TODO: Map from approvals array
        };

        console.log('[Drawer] Transformed data:', transformed);
        setDrawerData(transformed as any);
      } else {
        console.error('[Drawer] API error:', response.error);
        message.error(response.error || 'Ошибка загрузки данных КП');
      }
    } catch (error: any) {
      message.error(`Ошибка загрузки: ${error.message}`);
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedQuoteId(null);
    setDrawerData(null);
  };

  const handleDrawerDelete = async () => {
    if (!selectedQuoteId) return;
    await handleDelete(selectedQuoteId);
    closeDrawer();
  };

  const getStatusTag = (workflowState: string) => {
    const statusMap = {
      draft: { color: 'default', text: 'Черновик' },
      awaiting_financial_approval: { color: 'orange', text: 'На финансовом утверждении' },
      financially_approved: { color: 'green', text: 'Финансово утверждено' },
      rejected_by_finance: { color: 'red', text: 'Отклонено финансами' },
      sent_back_for_revision: { color: 'purple', text: 'Требуется доработка' },
      ready_to_send: { color: 'cyan', text: 'Готово к отправке' },
      sent_to_customer: { color: 'blue', text: 'Отправлено клиенту' },
      accepted_by_customer: { color: 'green', text: 'Принято клиентом' },
      rejected_by_customer: { color: 'red', text: 'Отклонено клиентом' },
      expired: { color: 'default', text: 'Истекло' },
      cancelled: { color: 'default', text: 'Отменено' },
    };
    const config = statusMap[workflowState as keyof typeof statusMap] || {
      color: 'default',
      text: workflowState,
    };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency || 'RUB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns = [
    {
      title: 'Номер КП',
      dataIndex: 'quote_number',
      key: 'quote_number',
      width: 150,
      render: (text: string, record: QuoteListItem) => (
        <a
          onClick={() => openDrawer(record.id)}
          style={{
            fontWeight: 500,
            color: '#1890ff',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          {text}
        </a>
      ),
    },
    {
      title: 'Клиент',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Название',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      ellipsis: true,
    },
    {
      title: 'Сумма (в валюте КП)',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 150,
      align: 'right' as const,
      render: (_: any, record: QuoteListItem) => {
        const amount = record.total_amount || record.total || 0;
        return formatCurrency(amount, record.currency || 'USD');
      },
    },
    {
      title: 'Сумма USD',
      dataIndex: 'total_usd',
      key: 'total_usd',
      width: 130,
      align: 'right' as const,
      render: (totalUsd: number | null | undefined) => {
        if (totalUsd === undefined || totalUsd === null) return '—';
        return (
          <span>
            $
            {totalUsd.toLocaleString('ru-RU', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        );
      },
    },
    {
      title: 'Прибыль',
      dataIndex: 'total_profit_usd',
      key: 'total_profit_usd',
      width: 130,
      align: 'right' as const,
      render: (profit: number | undefined) => {
        if (profit === undefined || profit === null) return '—';
        const color = profit > 0 ? '#52c41a' : profit < 0 ? '#ff4d4f' : undefined;
        return (
          <span style={{ color, fontWeight: profit !== 0 ? 500 : undefined }}>
            $
            {profit.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      title: 'Статус',
      dataIndex: 'workflow_state',
      key: 'workflow_state',
      width: 180,
      render: (workflowState: string) => getStatusTag(workflowState || 'draft'),
    },
    {
      title: 'Дата КП',
      dataIndex: 'quote_date',
      key: 'quote_date',
      width: 120,
      render: (date: string) => (date ? new Date(date).toLocaleDateString('ru-RU') : '—'),
    },
    {
      title: 'Действительно до',
      dataIndex: 'valid_until',
      key: 'valid_until',
      width: 140,
      render: (date: string) => {
        if (!date) return '—';
        const validDate = new Date(date);
        const isExpired = validDate < new Date();
        return (
          <span style={{ color: isExpired ? '#ff4d4f' : undefined }}>
            {validDate.toLocaleDateString('ru-RU')}
          </span>
        );
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: QuoteListItem) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => openDrawer(record.id)}
            title="Просмотр"
          />
          {record.workflow_state === 'draft' && (
            <Button
              type="text"
              icon={<SendOutlined />}
              onClick={() => openSubmitModal(record.id, record.quote_number)}
              title="Отправить на утверждение"
              style={{ color: '#52c41a' }}
            />
          )}
          {(record.workflow_state === 'draft' || record.workflow_state === 'revision_needed') && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => router.push(`/quotes/${record.id}/edit`)}
              title="Редактировать"
            />
          )}
          {record.workflow_state === 'draft' && (
            <Popconfirm
              title="Удалить КП?"
              description="КП будет перемещено в корзину"
              onConfirm={() => handleDelete(record.id)}
              okText="Удалить"
              cancelText="Отмена"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} title="Удалить" />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // Calculate stats
  const totalQuotes = totalCount;
  const approvedQuotes = quotes.filter(
    (q) =>
      q.workflow_state === 'financially_approved' || q.workflow_state === 'accepted_by_customer'
  ).length;
  const pendingQuotes = quotes.filter(
    (q) => q.workflow_state === 'awaiting_financial_approval'
  ).length;
  const totalRevenue = quotes
    .filter((q) => q.workflow_state === 'accepted_by_customer')
    .reduce((sum, q) => sum + (q.total_amount || q.total || 0), 0);

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>Коммерческие предложения</Title>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => router.push('/quotes/create')}
            >
              Создать КП
            </Button>
          </Col>
        </Row>

        {/* Stats */}
        <Row gutter={16}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Всего КП"
                value={totalQuotes}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Утверждено"
                value={approvedQuotes}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="На утверждении"
                value={pendingQuotes}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Общая выручка"
                value={totalRevenue}
                prefix={<DollarOutlined />}
                formatter={(value) => formatCurrency(Number(value), 'RUB')}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Search
                placeholder="Поиск по номеру, клиенту..."
                allowClear
                enterButton={<SearchOutlined />}
                size="large"
                onSearch={(value) => {
                  setSearchTerm(value);
                  setCurrentPage(1);
                }}
                onChange={(e) => {
                  if (!e.target.value) {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }
                }}
              />
            </Col>
            <Col xs={24} md={8}>
              <Select
                placeholder="Статус"
                allowClear
                size="large"
                style={{ width: '100%' }}
                onChange={(value) => {
                  setStatusFilter(value || '');
                  setCurrentPage(1);
                }}
                options={[
                  { label: 'Черновик', value: 'draft' },
                  { label: 'На финансовом утверждении', value: 'awaiting_financial_approval' },
                  { label: 'Финансово утверждено', value: 'financially_approved' },
                  { label: 'Отклонено финансами', value: 'rejected_by_finance' },
                  { label: 'Требуется доработка', value: 'sent_back_for_revision' },
                  { label: 'Готово к отправке', value: 'ready_to_send' },
                  { label: 'Отправлено клиенту', value: 'sent_to_customer' },
                  { label: 'Принято клиентом', value: 'accepted_by_customer' },
                  { label: 'Отклонено клиентом', value: 'rejected_by_customer' },
                  { label: 'Истекло', value: 'expired' },
                  { label: 'Отменено', value: 'cancelled' },
                ]}
              />
            </Col>
            <Col xs={24} md={8}>
              <RangePicker
                size="large"
                style={{ width: '100%' }}
                format="DD.MM.YYYY"
                placeholder={['Дата от', 'Дата до']}
                onChange={(dates) => {
                  setDateRange(dates as [Dayjs, Dayjs] | null);
                  setCurrentPage(1);
                }}
              />
            </Col>
          </Row>
        </Card>

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={quotes}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1400 }}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: totalCount,
              showSizeChanger: true,
              showTotal: (total) => `Всего: ${total} КП`,
              onChange: (page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              },
            }}
          />
        </Card>

        {/* Quick View Drawer */}
        <Drawer
          title={drawerData?.quote?.quote_number || 'Загрузка...'}
          placement="right"
          width={800}
          onClose={closeDrawer}
          open={drawerOpen}
        >
          {drawerLoading ? (
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <Spin size="large" />
            </div>
          ) : drawerData ? (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* Section 1: Quote Summary */}
              <div>
                <Descriptions
                  title="Информация о КП"
                  bordered
                  column={1}
                  size="small"
                  styles={{ label: { fontWeight: 500, width: '40%' } }}
                >
                  <Descriptions.Item label="Клиент">
                    {drawerData.customer?.company_name || 'Не указан'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Статус">
                    {getStatusTag(drawerData.quote.workflow_state || drawerData.quote.status)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Дата КП">
                    {drawerData.quote.created_at
                      ? new Date(drawerData.quote.created_at).toLocaleDateString('ru-RU')
                      : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Действительно до">
                    {drawerData.quote.valid_until
                      ? new Date(drawerData.quote.valid_until).toLocaleDateString('ru-RU')
                      : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Дата создания">
                    {drawerData.quote.created_at
                      ? new Date(drawerData.quote.created_at).toLocaleDateString('ru-RU', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </Descriptions.Item>
                </Descriptions>
              </div>

              <Divider />

              {/* Section 2: Products Summary Table */}
              <div>
                <Typography.Title level={5}>Продукты</Typography.Title>
                <Table
                  dataSource={drawerData.items || []}
                  rowKey="id"
                  pagination={false}
                  scroll={{ y: 300 }}
                  size="small"
                  columns={[
                    {
                      title: 'Название',
                      dataIndex: 'name',
                      key: 'name',
                      ellipsis: true,
                      width: 200,
                    },
                    {
                      title: 'Артикул',
                      dataIndex: 'sku',
                      key: 'sku',
                      width: 120,
                    },
                    {
                      title: 'Кол-во',
                      dataIndex: 'quantity',
                      key: 'quantity',
                      width: 80,
                      align: 'right' as const,
                    },
                    {
                      title: 'Цена',
                      dataIndex: 'final_price',
                      key: 'final_price',
                      width: 100,
                      align: 'right' as const,
                      render: (price: number) =>
                        price ? formatCurrency(price, drawerData.quote.currency) : '—',
                    },
                    {
                      title: 'Сумма',
                      key: 'total',
                      width: 120,
                      align: 'right' as const,
                      render: (_: any, record: QuoteItem) =>
                        record.final_price && record.quantity
                          ? formatCurrency(
                              record.final_price * record.quantity,
                              drawerData.quote.currency
                            )
                          : '—',
                    },
                  ]}
                />
              </div>

              <Divider />

              {/* Section 3: Totals */}
              <div>
                <Typography.Title level={5}>Итого</Typography.Title>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="Подытог"
                      value={drawerData.quote.subtotal}
                      formatter={(value) =>
                        formatCurrency(Number(value), drawerData.quote.currency)
                      }
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Общая сумма"
                      value={drawerData.quote.total}
                      formatter={(value) =>
                        formatCurrency(Number(value), drawerData.quote.currency)
                      }
                      valueStyle={{ color: '#3f8600', fontWeight: 'bold' }}
                    />
                  </Col>
                </Row>
              </div>

              <Divider />

              {/* Section 4: Action Buttons */}
              <Space style={{ width: '100%', justifyContent: 'center' }} size="middle">
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={() => {
                    closeDrawer();
                    router.push(`/quotes/${selectedQuoteId}`);
                  }}
                >
                  Полная страница
                </Button>
                {(drawerData.quote.workflow_state === 'draft' ||
                  drawerData.quote.workflow_state === 'sent_back_for_revision') && (
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => {
                      closeDrawer();
                      router.push(`/quotes/${selectedQuoteId}/edit`);
                    }}
                  >
                    Редактировать
                  </Button>
                )}
                {drawerData.quote.workflow_state === 'draft' && (
                  <Popconfirm
                    title="Удалить КП?"
                    description="КП будет перемещено в корзину"
                    onConfirm={handleDrawerDelete}
                    okText="Удалить"
                    cancelText="Отмена"
                    okButtonProps={{ danger: true }}
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      Удалить
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </Space>
          ) : (
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <Typography.Text type="secondary">Нет данных</Typography.Text>
            </div>
          )}
        </Drawer>

        {/* Submit for Approval Modal */}
        <SubmitForApprovalModal
          open={submitModalOpen}
          onCancel={() => setSubmitModalOpen(false)}
          onSubmit={handleSubmitForApproval}
          quoteNumber={submitQuoteNumber}
        />
      </Space>
    </MainLayout>
  );
}
