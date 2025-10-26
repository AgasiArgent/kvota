'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Row, Col, Statistic, Table, Button, Skeleton, Alert, Badge, Typography } from 'antd';
import {
  FileTextOutlined,
  EditOutlined,
  SendOutlined,
  CheckCircleOutlined,
  PlusCircleOutlined,
  UnorderedListOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import {
  DashboardService,
  type DashboardStats,
  type RecentQuote,
} from '@/lib/api/dashboard-service';
import { useAuth } from '@/lib/auth/AuthProvider';

const { Title, Text } = Typography;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format currency for Russian locale
 */
const formatCurrency = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Calculate percentage
 */
const calculatePercentage = (part: number, total: number): string => {
  if (total === 0) return '0.0';
  return ((part / total) * 100).toFixed(1);
};

/**
 * Get status badge configuration
 */
const getStatusBadge = (status: string): { text: string; color: string } => {
  const config: Record<string, { text: string; color: string }> = {
    draft: { text: 'Черновик', color: 'default' },
    sent: { text: 'Отправлено', color: 'processing' },
    accepted: { text: 'Утверждено', color: 'success' },
    rejected: { text: 'Отклонено', color: 'error' },
    expired: { text: 'Истек срок', color: 'warning' },
  };
  return config[status] || { text: status, color: 'default' };
};

/**
 * Format trend indicator
 */
const formatTrend = (trend: number) => {
  const icon = trend >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />;
  const color = trend >= 0 ? '#3f8600' : '#cf1322';
  return (
    <span style={{ color, fontSize: '14px', marginLeft: '8px' }}>
      {icon} {Math.abs(trend).toFixed(1)}%
    </span>
  );
};

/**
 * Format date to DD.MM format
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${month}`;
};

// ============================================================================
// DASHBOARD PAGE COMPONENT
// ============================================================================

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/login');
      } else {
        loadDashboardStats();
      }
    }
  }, [user, authLoading, router]);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await DashboardService.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
      setError('Не удалось загрузить данные панели');
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while checking auth
  if (authLoading || loading) {
    return (
      <div style={{ padding: '24px' }}>
        <Title level={2}>Панель управления</Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          </Col>
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
          <Col xs={24} lg={14}>
            <Card title="Последние котировки">
              <Skeleton active paragraph={{ rows: 5 }} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="Быстрые действия">
              <Skeleton active paragraph={{ rows: 3 }} />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Title level={2}>Панель управления</Title>
        <Alert
          message="Ошибка загрузки"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={loadDashboardStats}>
              Повторить
            </Button>
          }
        />
      </div>
    );
  }

  if (!stats) return null;

  // Table columns for recent quotes
  const columns = [
    {
      title: 'Номер',
      dataIndex: 'quote_number',
      key: 'quote_number',
      render: (text: string, record: RecentQuote) => (
        <a onClick={() => router.push(`/quotes/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: 'Клиент',
      dataIndex: 'customer_name',
      key: 'customer_name',
      ellipsis: true,
    },
    {
      title: 'Сумма',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount: string) => formatCurrency(amount),
      align: 'right' as const,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const badge = getStatusBadge(status);
        return <Badge status={badge.color as any} text={badge.text} />;
      },
    },
    {
      title: 'Дата',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => formatDate(date),
      align: 'center' as const,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Панель управления</Title>

      {/* Row 1: Statistics Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Всего котировок"
              value={stats.total_quotes}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Черновики"
              value={stats.draft_quotes}
              prefix={<EditOutlined />}
              suffix={
                stats.total_quotes > 0 ? (
                  <span style={{ fontSize: '14px', color: '#999' }}>
                    ({calculatePercentage(stats.draft_quotes, stats.total_quotes)}%)
                  </span>
                ) : null
              }
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Отправлено"
              value={stats.sent_quotes}
              prefix={<SendOutlined />}
              suffix={
                stats.total_quotes > 0 ? (
                  <span style={{ fontSize: '14px', color: '#999' }}>
                    ({calculatePercentage(stats.sent_quotes, stats.total_quotes)}%)
                  </span>
                ) : null
              }
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Утверждено"
              value={stats.accepted_quotes}
              prefix={<CheckCircleOutlined />}
              suffix={
                stats.total_quotes > 0 ? (
                  <span style={{ fontSize: '14px', color: '#999' }}>
                    ({calculatePercentage(stats.accepted_quotes, stats.total_quotes)}%)
                  </span>
                ) : null
              }
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Row 2: Revenue and Recent Quotes */}
      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col xs={24} lg={14}>
          <Card
            title="Последние котировки"
            extra={
              <Button type="link" onClick={() => router.push('/quotes')}>
                Все КП
              </Button>
            }
          >
            <Table
              dataSource={stats.recent_quotes}
              columns={columns}
              rowKey="id"
              pagination={false}
              size="small"
              onRow={(record) => ({
                onClick: () => router.push(`/quotes/${record.id}`),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Выручка за месяц" style={{ marginBottom: '16px' }}>
            <Statistic
              value={formatCurrency(stats.revenue_this_month)}
              valueStyle={{ fontSize: '32px', color: '#1890ff' }}
            />
            <div style={{ marginTop: '16px' }}>
              <Text type="secondary">vs предыдущий месяц</Text>
              {formatTrend(stats.revenue_trend)}
            </div>
          </Card>
          <Card title="Быстрые действия">
            <Button
              type="primary"
              size="large"
              icon={<PlusCircleOutlined />}
              onClick={() => router.push('/quotes/create')}
              block
              style={{ marginBottom: '12px' }}
            >
              Создать КП
            </Button>
            <Button
              size="large"
              icon={<UnorderedListOutlined />}
              onClick={() => router.push('/quotes')}
              block
            >
              Все КП
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
