'use client';

import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Space,
  Table,
  Tag,
  Button,
  Divider,
  Progress,
  Spin,
  message,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  TrophyOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/lib/auth/AuthProvider';
import { QuoteService } from '@/lib/api/quote-service';
import { BaseApiService } from '@/lib/api/base-api';

const { Title, Text } = Typography;

interface Quote {
  id: string;
  quote_number: string;
  customer_name: string;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalQuotes: 0,
    approvedQuotes: 0,
    pendingQuotes: 0,
    totalRevenue: 0,
    monthlyGrowth: 12.5, // This would come from analytics API
    totalCustomers: 0,
  });
  const [recentQuotes, setRecentQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // TODO: Implement dashboard data fetching with proper organizationId context
      // This requires refactoring to get organizationId from auth context
      // and properly calling quoteService.getQuotes(organizationId, filters, pagination)
      // and customerService.listCustomers()

      // Temporary: Set empty/default stats
      setStats({
        totalQuotes: 0,
        approvedQuotes: 0,
        pendingQuotes: 0,
        totalRevenue: 0,
        monthlyGrowth: 0,
        totalCustomers: 0,
      });
      setRecentQuotes([]);
    } catch (error: any) {
      message.error(`Ошибка загрузки данных: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status: string) => {
    const statusMap = {
      draft: { color: 'default', text: 'Черновик' },
      pending_approval: { color: 'orange', text: 'На утверждении' },
      approved: { color: 'green', text: 'Утверждено' },
      sent: { color: 'blue', text: 'Отправлено' },
      accepted: { color: 'cyan', text: 'Принято' },
      rejected: { color: 'red', text: 'Отклонено' },
      expired: { color: 'default', text: 'Истекло' },
    };
    return statusMap[status as keyof typeof statusMap] || { color: 'default', text: status };
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const tableColumns = [
    {
      title: 'Номер КП',
      dataIndex: 'quote_number',
      key: 'quote_number',
      render: (text: string, record: Quote) => (
        <a onClick={() => router.push(`/quotes/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: 'Клиент',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: 'Сумма',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount: number, record: Quote) => formatCurrency(amount, record.currency),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = getStatusTag(status);
        return <Tag color={statusConfig.color}>{statusConfig.text}</Tag>;
      },
    },
    {
      title: 'Дата',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString('ru-RU'),
    },
  ];

  const getRoleWelcome = () => {
    const roleMessages = {
      sales_manager: 'Создавайте и отправляйте коммерческие предложения',
      finance_manager: 'Утверждайте КП и контролируйте финансовые показатели',
      department_manager: 'Управляйте процессами утверждения в отделе',
      director: 'Контролируйте все бизнес-процессы компании',
      admin: 'Администрируйте систему и управляйте пользователями',
    };
    return roleMessages[profile?.role as keyof typeof roleMessages] || 'Добро пожаловать в систему';
  };

  if (loading) {
    return (
      <MainLayout>
        <div style={{ textAlign: 'center', padding: '100px' }}>
          <Spin size="large" tip="Загрузка данных..." />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Welcome Section */}
        <div>
          <Title level={2}>Добро пожаловать, {profile?.full_name || 'Пользователь'}!</Title>
          <Text type="secondary" style={{ fontSize: '16px' }}>
            {getRoleWelcome()}
          </Text>
        </div>

        {/* Statistics Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Всего КП"
                value={stats.totalQuotes}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Утверждено"
                value={stats.approvedQuotes}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="На утверждении"
                value={stats.pendingQuotes}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Общая выручка"
                value={stats.totalRevenue}
                prefix={<DollarOutlined />}
                formatter={(value) => formatCurrency(Number(value), 'RUB')}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Performance and Recent Activity */}
        <Row gutter={[16, 16]}>
          {/* Performance Chart */}
          <Col xs={24} lg={12}>
            <Card title="Эффективность за месяц" extra={<Button type="link">Подробнее</Button>}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Text strong>Рост продаж</Text>
                  </Col>
                  <Col>
                    <Text type="success">
                      <ArrowUpOutlined /> {stats.monthlyGrowth}%
                    </Text>
                  </Col>
                </Row>
                <Progress
                  percent={stats.monthlyGrowth}
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                />

                <Divider />

                <Row justify="space-between">
                  <Col>
                    <Statistic
                      title="Конверсия КП"
                      value={68.5}
                      suffix="%"
                      valueStyle={{ fontSize: '20px' }}
                    />
                  </Col>
                  <Col>
                    <Statistic
                      title="Среднее время утверждения"
                      value={2.3}
                      suffix="дня"
                      valueStyle={{ fontSize: '20px' }}
                    />
                  </Col>
                </Row>
              </Space>
            </Card>
          </Col>

          {/* Quick Actions */}
          <Col xs={24} lg={12}>
            <Card title="Быстрые действия">
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Button type="primary" size="large" block href="/quotes/create">
                  Создать новое КП
                </Button>

                {profile?.role &&
                  ['finance_manager', 'department_manager', 'director', 'admin'].includes(
                    profile.role
                  ) && (
                    <Button size="large" block href="/quotes/approval">
                      Проверить КП на утверждении ({stats.pendingQuotes})
                    </Button>
                  )}

                <Button size="large" block href="/customers">
                  Управление клиентами
                </Button>

                <Button size="large" block href="/quotes">
                  Просмотреть все КП
                </Button>

                <Divider />

                <div style={{ textAlign: 'center' }}>
                  <TrophyOutlined style={{ fontSize: '24px', color: '#faad14' }} />
                  <div style={{ marginTop: '8px' }}>
                    <Text strong>Цель месяца</Text>
                    <br />
                    <Text type="secondary">200 КП (выполнено 78%)</Text>
                  </div>
                  <Progress percent={78} size="small" />
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Recent Quotes Table */}
        <Card
          title="Последние коммерческие предложения"
          extra={
            <Button type="link" href="/quotes">
              Показать все
            </Button>
          }
        >
          <Table
            columns={tableColumns}
            dataSource={recentQuotes}
            pagination={false}
            size="middle"
          />
        </Card>
      </Space>
    </MainLayout>
  );
}
