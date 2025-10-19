'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Card,
  Tag,
  Typography,
  message,
  Row,
  Col,
  Statistic,
  Modal,
  Input,
  Empty,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { QuoteService } from '@/lib/api/quote-service';
import { useAuth } from '@/lib/auth/AuthProvider';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Quote {
  id: string;
  quote_number: string;
  customer_name: string;
  title: string;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
  submitted_for_approval_at: string;
}

export default function QuoteApprovalPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const quoteService = new QuoteService();

  useEffect(() => {
    // Check if user has manager role
    const managerRoles = [
      'finance_manager',
      'department_manager',
      'director',
      'admin',
      'procurement_manager',
      'customs_manager',
      'logistics_manager',
    ];

    if (!profile?.role || !managerRoles.includes(profile.role)) {
      message.error('У вас нет прав для доступа к этой странице');
      router.push('/dashboard');
      return;
    }

    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    setLoading(true);
    try {
      // In real implementation, this would be a specific API endpoint
      // that returns quotes pending the current user's approval
      const response = await quoteService.getQuotes({
        page: 1,
        page_size: 100,
        filters: {
          // This would filter for quotes where current user is an approver
          // and their approval status is 'pending'
          status: 'pending_approval,partially_approved',
        },
      });

      setQuotes(response.data);
    } catch (error: any) {
      message.error(`Ошибка загрузки КП: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async () => {
    if (!selectedQuote) return;

    setActionLoading(true);
    try {
      // In real implementation, call API to approve/reject
      // await quoteService.approveQuote(selectedQuote.id, approvalAction, approvalNotes)

      message.success(
        approvalAction === 'approve'
          ? `КП ${selectedQuote.quote_number} утверждено`
          : `КП ${selectedQuote.quote_number} отклонено`
      );

      setApprovalModalVisible(false);
      setApprovalNotes('');
      setSelectedQuote(null);
      fetchPendingApprovals();
    } catch (error: any) {
      message.error(`Ошибка: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusTag = (status: string) => {
    const statusMap = {
      pending_approval: { color: 'orange', text: 'На утверждении' },
      partially_approved: { color: 'gold', text: 'Частично утверждено' },
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
      title: 'Отправлено на утв.',
      dataIndex: 'submitted_for_approval_at',
      key: 'submitted_for_approval_at',
      width: 160,
      render: (date: string) => {
        if (!date) return '—';
        const daysSince = Math.floor(
          (new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
        );
        return (
          <Space direction="vertical" size={0}>
            <Text>{new Date(date).toLocaleDateString('ru-RU')}</Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {daysSince === 0
                ? 'Сегодня'
                : `${daysSince} ${daysSince === 1 ? 'день' : 'дней'} назад`}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: Quote) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/quotes/${record.id}`)}
            title="Просмотр"
          />
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => {
              setSelectedQuote(record);
              setApprovalAction('approve');
              setApprovalModalVisible(true);
            }}
          >
            Утвердить
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => {
              setSelectedQuote(record);
              setApprovalAction('reject');
              setApprovalModalVisible(true);
            }}
          >
            Отклонить
          </Button>
        </Space>
      ),
    },
  ];

  const pendingCount = quotes.filter((q) => q.status === 'pending_approval').length;
  const partialCount = quotes.filter((q) => q.status === 'partially_approved').length;

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>КП на утверждении</Title>
            <Text type="secondary">Коммерческие предложения, ожидающие вашего утверждения</Text>
          </Col>
        </Row>

        {/* Stats */}
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title="Ожидают утверждения"
                value={pendingCount}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title="Частично утверждено"
                value={partialCount}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Table */}
        <Card>
          {quotes.length === 0 && !loading ? (
            <Empty
              description="Нет КП, ожидающих утверждения"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <Table
              columns={columns}
              dataSource={quotes}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1300 }}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `Всего: ${total} КП`,
              }}
            />
          )}
        </Card>
      </Space>

      {/* Approval Modal */}
      <Modal
        title={
          approvalAction === 'approve'
            ? `Утвердить КП ${selectedQuote?.quote_number}`
            : `Отклонить КП ${selectedQuote?.quote_number}`
        }
        open={approvalModalVisible}
        onOk={handleApproval}
        onCancel={() => {
          setApprovalModalVisible(false);
          setApprovalNotes('');
          setSelectedQuote(null);
        }}
        okText={approvalAction === 'approve' ? 'Утвердить' : 'Отклонить'}
        cancelText="Отмена"
        okButtonProps={{
          danger: approvalAction === 'reject',
          loading: actionLoading,
        }}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {selectedQuote && (
            <>
              <div>
                <Text strong>Клиент:</Text> <Text>{selectedQuote.customer_name}</Text>
                <br />
                <Text strong>Название:</Text> <Text>{selectedQuote.title}</Text>
                <br />
                <Text strong>Сумма:</Text>{' '}
                <Text style={{ fontSize: '16px', color: '#1890ff' }}>
                  {formatCurrency(selectedQuote.total_amount, selectedQuote.currency)}
                </Text>
              </div>
              <TextArea
                rows={4}
                placeholder={
                  approvalAction === 'approve'
                    ? 'Комментарий (необязательно)'
                    : 'Укажите причину отклонения'
                }
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
              />
              {approvalAction === 'reject' && (
                <Text type="warning">После отклонения КП вернется автору для доработки</Text>
              )}
            </>
          )}
        </Space>
      </Modal>
    </MainLayout>
  );
}
