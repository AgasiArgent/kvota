'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Tabs,
  Space,
  Typography,
  message,
  Modal,
  Descriptions,
  Badge,
  Empty,
  Spin,
} from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { FeedbackService, type Feedback } from '@/lib/api/feedback-service';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

export default function FeedbackPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'resolved'>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      message.error('Доступ запрещён');
      router.push('/dashboard');
    }
  }, [profile, router]);

  // Fetch feedback
  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchFeedback();
    }
  }, [activeTab, currentPage, profile]);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const statusFilter = activeTab === 'all' ? undefined : activeTab;
      const response = await FeedbackService.list(statusFilter, currentPage, 20);
      setFeedback(response.feedback);
      setTotal(response.total);
    } catch (error) {
      if (error instanceof Error) {
        message.error(`Ошибка загрузки: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (feedbackId: string) => {
    try {
      setResolvingId(feedbackId);
      await FeedbackService.resolve(feedbackId);
      message.success('Обратная связь отмечена как решённая');
      fetchFeedback(); // Refresh list
    } catch (error) {
      if (error instanceof Error) {
        message.error(`Ошибка: ${error.message}`);
      }
    } finally {
      setResolvingId(null);
    }
  };

  const showDetail = (record: Feedback) => {
    setSelectedFeedback(record);
    setDetailModalVisible(true);
  };

  const columns: ColumnsType<Feedback> = [
    {
      title: 'Дата',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      render: (date: string) => dayjs(date).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Пользователь',
      key: 'user',
      width: 200,
      render: (_, record) => (
        <div>
          <Text strong>{record.user_full_name || 'Неизвестно'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.user_email}
          </Text>
        </div>
      ),
    },
    {
      title: 'Страница',
      dataIndex: 'page_url',
      key: 'page_url',
      width: 250,
      ellipsis: true,
      render: (url: string) => (
        <a href={url} target="_blank" rel="noopener noreferrer" title={url}>
          {url}
        </a>
      ),
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => <Text ellipsis={{ tooltip: text }}>{text}</Text>,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag
          icon={status === 'open' ? <ClockCircleOutlined /> : <CheckCircleOutlined />}
          color={status === 'open' ? 'default' : 'green'}
        >
          {status === 'open' ? 'Открыто' : 'Решено'}
        </Tag>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<InfoCircleOutlined />} onClick={() => showDetail(record)}>
            Детали
          </Button>
          {record.status === 'open' && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={resolvingId === record.id}
              onClick={() => handleResolve(record.id)}
            >
              Решено
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const handleTabChange = (key: string) => {
    setActiveTab(key as 'all' | 'open' | 'resolved');
    setCurrentPage(1); // Reset to first page
  };

  if (profile?.role !== 'admin') {
    return null; // Will redirect
  }

  return (
    <div>
      <Card>
        <Title level={2}>Обратная связь пользователей</Title>
        <Text type="secondary">
          Просмотр и управление отчётами об ошибках и предложениями пользователей
        </Text>

        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          style={{ marginTop: 24 }}
          items={[
            {
              key: 'all',
              label: 'Все',
            },
            {
              key: 'open',
              label: (
                <Badge count={feedback.filter((f) => f.status === 'open').length} offset={[10, 0]}>
                  <span>Открытые</span>
                </Badge>
              ),
            },
            {
              key: 'resolved',
              label: 'Решённые',
            },
          ]}
        />

        <Table
          columns={columns}
          dataSource={feedback}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: 20,
            total: total,
            onChange: (page) => setCurrentPage(page),
            showSizeChanger: false,
            showTotal: (total) => `Всего: ${total}`,
          }}
          locale={{
            emptyText: <Empty description="Нет данных" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Детали обратной связи"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Закрыть
          </Button>,
          selectedFeedback?.status === 'open' && (
            <Button
              key="resolve"
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={resolvingId === selectedFeedback?.id}
              onClick={() => {
                if (selectedFeedback) {
                  handleResolve(selectedFeedback.id);
                  setDetailModalVisible(false);
                }
              }}
            >
              Отметить как решённое
            </Button>
          ),
        ]}
        width={700}
      >
        {selectedFeedback && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Статус">
              <Tag
                icon={
                  selectedFeedback.status === 'open' ? (
                    <ClockCircleOutlined />
                  ) : (
                    <CheckCircleOutlined />
                  )
                }
                color={selectedFeedback.status === 'open' ? 'default' : 'green'}
              >
                {selectedFeedback.status === 'open' ? 'Открыто' : 'Решено'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Дата создания">
              {dayjs(selectedFeedback.created_at).format('DD.MM.YYYY HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="Пользователь">
              <div>
                <Text strong>{selectedFeedback.user_full_name || 'Неизвестно'}</Text>
                <br />
                <Text type="secondary">{selectedFeedback.user_email}</Text>
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Страница">
              <a href={selectedFeedback.page_url} target="_blank" rel="noopener noreferrer">
                {selectedFeedback.page_url}
              </a>
            </Descriptions.Item>
            <Descriptions.Item label="Описание">
              <Text style={{ whiteSpace: 'pre-wrap' }}>{selectedFeedback.description}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Информация о браузере">
              {selectedFeedback.browser_info ? (
                <div style={{ fontSize: 12 }}>
                  <div>
                    <strong>User Agent:</strong> {selectedFeedback.browser_info.userAgent}
                  </div>
                  <div>
                    <strong>Экран:</strong> {selectedFeedback.browser_info.screenWidth} x{' '}
                    {selectedFeedback.browser_info.screenHeight}
                  </div>
                  <div>
                    <strong>Окно:</strong> {selectedFeedback.browser_info.windowWidth} x{' '}
                    {selectedFeedback.browser_info.windowHeight}
                  </div>
                  <div>
                    <strong>Время:</strong>{' '}
                    {dayjs(selectedFeedback.browser_info.timestamp).format('DD.MM.YYYY HH:mm:ss')}
                  </div>
                </div>
              ) : (
                <Text type="secondary">Нет данных</Text>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
