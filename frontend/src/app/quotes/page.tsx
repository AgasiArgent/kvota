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
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { QuoteService } from '@/lib/api/quote-service';
import { useAuth } from '@/lib/auth/AuthProvider';
import dayjs, { Dayjs } from 'dayjs';

const { Title } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

interface Quote {
  id: string;
  quote_number: string;
  customer_name: string;
  title: string;
  status: string;
  total_amount: number;
  currency: string;
  quote_date: string;
  valid_until: string;
  created_at: string;
}

export default function QuotesPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  const quoteService = new QuoteService();

  useEffect(() => {
    fetchQuotes();
  }, [currentPage, pageSize, searchTerm, statusFilter, dateRange]);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const filters: Record<string, any> = {};

      if (searchTerm) {
        filters.search = searchTerm;
      }
      if (statusFilter) {
        filters.status = statusFilter;
      }
      if (dateRange) {
        filters.date_from = dateRange[0].format('YYYY-MM-DD');
        filters.date_to = dateRange[1].format('YYYY-MM-DD');
      }

      const response = await quoteService.getQuotes({
        page: currentPage,
        page_size: pageSize,
        filters,
      });

      setQuotes(response.data);
      setTotalCount(response.total);
    } catch (error: any) {
      message.error(`Ошибка загрузки КП: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await quoteService.deleteQuote(id);
      message.success('КП успешно удалено');
      fetchQuotes();
    } catch (error: any) {
      message.error(`Ошибка удаления: ${error.message}`);
    }
  };

  const getStatusTag = (status: string) => {
    const statusMap = {
      draft: { color: 'default', text: 'Черновик' },
      pending_approval: { color: 'orange', text: 'На утверждении' },
      partially_approved: { color: 'gold', text: 'Частично утверждено' },
      approved: { color: 'green', text: 'Утверждено' },
      revision_needed: { color: 'purple', text: 'Требуется доработка' },
      rejected_internal: { color: 'red', text: 'Отклонено (внутр.)' },
      ready_to_send: { color: 'cyan', text: 'Готово к отправке' },
      sent: { color: 'blue', text: 'Отправлено' },
      viewed: { color: 'geekblue', text: 'Просмотрено' },
      accepted: { color: 'green', text: 'Принято' },
      rejected: { color: 'red', text: 'Отклонено' },
      expired: { color: 'default', text: 'Истекло' },
      cancelled: { color: 'default', text: 'Отменено' },
    };
    const config = statusMap[status as keyof typeof statusMap] || {
      color: 'default',
      text: status,
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
      render: (text: string, record: Quote) => (
        <a onClick={() => router.push(`/quotes/${record.id}`)} style={{ fontWeight: 500 }}>
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
      title: 'Сумма',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 150,
      align: 'right' as const,
      render: (amount: number, record: Quote) => formatCurrency(amount, record.currency),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 180,
      render: (status: string) => getStatusTag(status),
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
      render: (_: any, record: Quote) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/quotes/${record.id}`)}
            title="Просмотр"
          />
          {(record.status === 'draft' || record.status === 'revision_needed') && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => router.push(`/quotes/${record.id}?mode=edit`)}
              title="Редактировать"
            />
          )}
          {record.status === 'draft' && (
            <Popconfirm
              title="Удалить КП?"
              description="Это действие нельзя отменить"
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
    (q) => q.status === 'approved' || q.status === 'accepted'
  ).length;
  const pendingQuotes = quotes.filter((q) =>
    ['pending_approval', 'partially_approved'].includes(q.status)
  ).length;
  const totalRevenue = quotes
    .filter((q) => q.status === 'accepted')
    .reduce((sum, q) => sum + (q.total_amount || 0), 0);

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
                  { label: 'На утверждении', value: 'pending_approval' },
                  { label: 'Частично утверждено', value: 'partially_approved' },
                  { label: 'Утверждено', value: 'approved' },
                  { label: 'Требуется доработка', value: 'revision_needed' },
                  { label: 'Отклонено (внутр.)', value: 'rejected_internal' },
                  { label: 'Готово к отправке', value: 'ready_to_send' },
                  { label: 'Отправлено', value: 'sent' },
                  { label: 'Просмотрено', value: 'viewed' },
                  { label: 'Принято', value: 'accepted' },
                  { label: 'Отклонено', value: 'rejected' },
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
      </Space>
    </MainLayout>
  );
}
