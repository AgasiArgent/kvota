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
  Alert,
} from 'antd';
import { SearchOutlined, DeleteOutlined, ReloadOutlined, RestOutlined } from '@ant-design/icons';
import MainLayout from '@/components/layout/MainLayout';
import { QuoteService } from '@/lib/api/quote-service';
import { useAuth } from '@/lib/auth/AuthProvider';
import dayjs, { Dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';

// Enable relativeTime plugin and set locale to Russian
dayjs.extend(relativeTime);
dayjs.locale('ru');

const { Title } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

interface QuoteListItem {
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
  deleted_at?: string;
}

export default function QuotesBinPage() {
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

  const quoteService = new QuoteService();

  useEffect(() => {
    console.log('[useEffect] Triggered - profile:', profile?.organization_id, 'page:', currentPage);
    if (profile?.organization_id) {
      fetchBinQuotes();
    } else {
      console.log('[useEffect] BLOCKED - no organization_id');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, searchTerm, statusFilter, dateRange, profile]);

  const fetchBinQuotes = async () => {
    console.log(
      '[fetchBinQuotes] START - profile:',
      profile?.email,
      'org_id:',
      profile?.organization_id
    );
    setLoading(true);
    try {
      const filters: Record<string, string> = {};

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

      const organizationId = profile?.organization_id || '';
      if (!organizationId) {
        message.error('Не удалось определить организацию');
        return;
      }

      const response = await quoteService.getBinQuotes(organizationId, filters, {
        page: currentPage,
        limit: pageSize,
      });
      console.log('[fetchBinQuotes] API response:', response);
      if (response.success && response.data) {
        setQuotes((response.data.quotes || []) as unknown as QuoteListItem[]);
        setTotalCount(response.data.pagination?.total_items || 0);
      } else {
        message.error(response.error || 'Ошибка загрузки корзины');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      message.error(`Ошибка загрузки корзины: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const organizationId = profile?.organization_id || '';
      if (!organizationId) {
        message.error('Не удалось определить организацию');
        return;
      }

      const response = await quoteService.restoreQuote(id, organizationId);
      if (response.success) {
        message.success('КП восстановлено');
        fetchBinQuotes();
      } else {
        message.error(response.error || 'Ошибка восстановления');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      message.error(`Ошибка восстановления: ${errorMessage}`);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      const organizationId = profile?.organization_id || '';
      if (!organizationId) {
        message.error('Не удалось определить организацию');
        return;
      }

      const response = await quoteService.permanentlyDeleteQuote(id, organizationId);
      if (response.success) {
        message.success('КП удалено безвозвратно');
        fetchBinQuotes();
      } else {
        message.error(response.error || 'Ошибка удаления');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      message.error(`Ошибка удаления: ${errorMessage}`);
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
      render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>,
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
      render: (amount: number, record: QuoteListItem) => formatCurrency(amount, record.currency),
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
      title: 'Удалено',
      dataIndex: 'deleted_at',
      key: 'deleted_at',
      width: 140,
      defaultSortOrder: 'descend' as const,
      sorter: (a: QuoteListItem, b: QuoteListItem) => {
        if (!a.deleted_at) return 1;
        if (!b.deleted_at) return -1;
        return new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime();
      },
      render: (date: string) => {
        if (!date) return '—';
        return <Typography.Text type="secondary">{dayjs(date).fromNow()}</Typography.Text>;
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: QuoteListItem) => (
        <Space size="small">
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => handleRestore(record.id)}
            title="Восстановить"
            style={{ color: '#52c41a' }}
          />
          <Popconfirm
            title="Безвозвратно удалить КП?"
            description="Это действие нельзя отменить."
            onConfirm={() => handlePermanentDelete(record.id)}
            okText="Удалить навсегда"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} title="Удалить навсегда" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>Корзина КП</Title>
          </Col>
        </Row>

        {/* Info Banner */}
        <Alert
          message="Автоматическое удаление"
          description="КП автоматически удаляются через 7 дней после перемещения в корзину"
          type="info"
          showIcon
          closable
        />

        {/* Stats */}
        <Row gutter={16}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Всего в корзине"
                value={totalCount}
                prefix={<RestOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
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
