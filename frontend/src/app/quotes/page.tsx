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
  Row,
  Col,
  Statistic,
  DatePicker,
  Dropdown,
  Upload,
  Popover,
} from 'antd';
import type { MenuProps, UploadProps } from 'antd';
import {
  SearchOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  SendOutlined,
  DownloadOutlined,
  UploadOutlined,
  DownOutlined,
} from '@ant-design/icons';
import MainLayout from '@/components/layout/MainLayout';
import { QuoteService } from '@/lib/api/quote-service';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { Dayjs } from 'dayjs';
import { QuoteItem } from '@/lib/types/platform';
import SubmitForApprovalModal from '@/components/quotes/SubmitForApprovalModal';
import CreateQuoteModal from '@/components/quotes/CreateQuoteModal';
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

  // Submit modal state
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitQuoteId, setSubmitQuoteId] = useState<string | null>(null);
  const [submitQuoteNumber, setSubmitQuoteNumber] = useState<string>('');

  // Create quote modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  // Template download handler
  const handleDownloadTemplate = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        message.error('Не авторизован');
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/quotes/upload/download-template`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Ошибка скачивания шаблона');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'quote_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('Шаблон скачан');
    } catch (error: any) {
      message.error(error.message || 'Ошибка скачивания шаблона');
    }
  };

  // File selection handler for Create Quote flow
  const uploadProps: UploadProps = {
    name: 'file',
    accept: '.xlsx,.xls,.xlsm',
    showUploadList: false,
    beforeUpload: (file) => {
      // Capture file and open modal instead of uploading
      setSelectedFile(file);
      setCreateModalOpen(true);
      return false; // Prevent automatic upload
    },
  };

  // Handle successful quote creation
  const handleCreateQuoteSuccess = (quoteId: string, quoteNumber: string) => {
    setCreateModalOpen(false);
    setSelectedFile(null);
    fetchQuotes(); // Refresh the list to show new quote
  };

  // Handle modal cancel
  const handleCreateModalCancel = () => {
    setCreateModalOpen(false);
    setSelectedFile(null);
  };

  // Export handler
  const handleExport = async (quoteId: string, exportType: string) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        message.error('Не авторизован');
        return;
      }

      let url: string;
      let filename: string;

      if (exportType === 'validation') {
        url = `${config.apiUrl}/api/quotes-calc/validation-export/${quoteId}`;
        filename = `validation_${quoteId}.xlsm`;
      } else {
        // PDF exports: supply, supply-letter, openbook, openbook-letter
        url = `${config.apiUrl}/api/quotes/${quoteId}/export/pdf?format=${exportType}`;
        filename = `quote_${exportType}_${quoteId}.pdf`;
      }

      message.loading({ content: 'Экспорт...', key: 'export' });

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Ошибка экспорта');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      message.success({ content: 'Файл скачан', key: 'export' });
    } catch (error: any) {
      message.error({ content: error.message || 'Ошибка экспорта', key: 'export' });
    }
  };

  // Export dropdown menu items generator
  const getExportMenuItems = (quoteId: string): MenuProps['items'] => [
    {
      key: 'validation',
      label: 'Экспорт для проверки',
      onClick: () => handleExport(quoteId, 'validation'),
    },
    { type: 'divider' },
    {
      key: 'supply',
      label: 'КП поставка',
      onClick: () => handleExport(quoteId, 'supply'),
    },
    {
      key: 'supply-letter',
      label: 'КП поставка — письмо',
      onClick: () => handleExport(quoteId, 'supply-letter'),
    },
    {
      key: 'openbook',
      label: 'КП open book',
      onClick: () => handleExport(quoteId, 'openbook'),
    },
    {
      key: 'openbook-letter',
      label: 'КП open book — письмо',
      onClick: () => handleExport(quoteId, 'openbook-letter'),
    },
  ];

  // Products popover state
  const [popoverProducts, setPopoverProducts] = useState<Record<string, QuoteItem[]>>({});
  const [popoverLoading, setPopoverLoading] = useState<Record<string, boolean>>({});

  // Fetch products for popover
  const fetchProductsForPopover = async (quoteId: string) => {
    // If already loaded, don't refetch
    if (popoverProducts[quoteId]) return;

    setPopoverLoading((prev) => ({ ...prev, [quoteId]: true }));
    try {
      const organizationId = profile?.organization_id || '';
      if (!organizationId) return;

      const response = await quoteService.getQuoteDetails(quoteId, organizationId);
      if (response.success && response.data) {
        const { items } = response.data as any;
        setPopoverProducts((prev) => ({ ...prev, [quoteId]: items || [] }));
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setPopoverLoading((prev) => ({ ...prev, [quoteId]: false }));
    }
  };

  // Products popover content
  const renderProductsPopover = (quoteId: string, currency: string) => {
    const products = popoverProducts[quoteId] || [];
    const isLoading = popoverLoading[quoteId];

    if (isLoading) {
      return (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <span>Загрузка...</span>
        </div>
      );
    }

    if (products.length === 0) {
      return (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <Typography.Text type="secondary">Нет товаров</Typography.Text>
        </div>
      );
    }

    const totalQuantity = products.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalAmount = products.reduce(
      (sum, p) => sum + (p.final_price || 0) * (p.quantity || 0),
      0
    );

    return (
      <div style={{ width: 450 }}>
        <div style={{ fontWeight: 500, marginBottom: 12 }}>Товары ({products.length} позиций)</div>
        <Table
          dataSource={products}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ y: 200 }}
          columns={[
            {
              title: 'Название',
              dataIndex: 'name',
              key: 'name',
              width: 200,
              ellipsis: true,
              render: (name: string, record: QuoteItem) =>
                record.sku ? `${record.sku} - ${name}` : name,
            },
            {
              title: 'Кол-во',
              dataIndex: 'quantity',
              key: 'quantity',
              width: 80,
              align: 'right' as const,
              render: (qty: number) => `${qty} шт`,
            },
            {
              title: 'Цена',
              dataIndex: 'final_price',
              key: 'final_price',
              width: 100,
              align: 'right' as const,
              render: (price: number) => (price ? formatCurrency(price, currency) + '/шт' : '—'),
            },
          ]}
        />
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>
            <strong>Итого:</strong> {totalQuantity} шт
          </span>
          <span>
            <strong>Сумма:</strong> {formatCurrency(totalAmount, currency)}
          </span>
        </div>
      </div>
    );
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
        <Popover
          content={renderProductsPopover(record.id, record.currency || 'USD')}
          title={null}
          trigger="click"
          placement="right"
          onOpenChange={(open) => {
            if (open) fetchProductsForPopover(record.id);
          }}
        >
          <a
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
        </Popover>
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
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: QuoteListItem) => (
        <Space size="small">
          {record.workflow_state === 'draft' && (
            <Button
              type="text"
              icon={<SendOutlined />}
              onClick={() => openSubmitModal(record.id, record.quote_number)}
              title="Отправить на утверждение"
              style={{ color: '#52c41a' }}
            />
          )}
          <Dropdown menu={{ items: getExportMenuItems(record.id) }}>
            <Button icon={<DownloadOutlined />}>
              Экспорт <DownOutlined />
            </Button>
          </Dropdown>
        </Space>
      ),
    },
  ];

  // Calculate stats from displayed quotes
  const totalQuotes = totalCount;
  const approvedQuotes = quotes.filter(
    (q) =>
      q.workflow_state === 'financially_approved' || q.workflow_state === 'accepted_by_customer'
  ).length;
  const pendingQuotes = quotes.filter(
    (q) => q.workflow_state === 'awaiting_financial_approval'
  ).length;
  // Sum total_usd for all displayed quotes (shows — if no data)
  const totalRevenueUsd = quotes.reduce((sum, q) => sum + (q.total_usd || 0), 0);
  const totalProfitUsd = quotes.reduce((sum, q) => sum + (q.total_profit_usd || 0), 0);

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>Коммерческие предложения</Title>
          </Col>
          <Col>
            <Space>
              <Button icon={<DownloadOutlined />} size="large" onClick={handleDownloadTemplate}>
                Скачать шаблон
              </Button>
              <Upload {...uploadProps}>
                <Button type="primary" icon={<UploadOutlined />} size="large">
                  Создать КП
                </Button>
              </Upload>
            </Space>
          </Col>
        </Row>

        {/* Stats */}
        <Row gutter={16}>
          <Col xs={12} sm={8} lg={4}>
            <Card size="small">
              <Statistic
                title="Всего КП"
                value={totalQuotes}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Card size="small">
              <Statistic
                title="Утверждено"
                value={approvedQuotes}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Card size="small">
              <Statistic
                title="На утверждении"
                value={pendingQuotes}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} lg={6}>
            <Card size="small">
              <Statistic
                title="Выручка (USD)"
                value={totalRevenueUsd}
                prefix={<DollarOutlined />}
                formatter={(value) =>
                  `$${Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} lg={6}>
            <Card size="small">
              <Statistic
                title="Прибыль (USD)"
                value={totalProfitUsd}
                prefix={<DollarOutlined />}
                formatter={(value) =>
                  `$${Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
                valueStyle={{ color: totalProfitUsd >= 0 ? '#52c41a' : '#ff4d4f' }}
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

        {/* Submit for Approval Modal */}
        <SubmitForApprovalModal
          open={submitModalOpen}
          onCancel={() => setSubmitModalOpen(false)}
          onSubmit={handleSubmitForApproval}
          quoteNumber={submitQuoteNumber}
        />

        {/* Create Quote Modal */}
        <CreateQuoteModal
          open={createModalOpen}
          onCancel={handleCreateModalCancel}
          onSuccess={handleCreateQuoteSuccess}
          selectedFile={selectedFile}
        />
      </Space>
    </MainLayout>
  );
}
