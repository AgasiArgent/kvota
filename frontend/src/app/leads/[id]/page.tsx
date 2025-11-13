'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Button,
  Space,
  Tag,
  Typography,
  message,
  Spin,
  Tabs,
  Timeline,
  List,
  Avatar,
  Popconfirm,
  Select,
  Modal,
  Form,
  Input,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  CheckCircleOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  PlusOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { getLead, qualifyLead, type LeadWithDetails } from '@/lib/api/lead-service';
import {
  listActivities,
  createActivity,
  completeActivity,
  type ActivityWithDetails,
  type ActivityCreate,
} from '@/lib/api/activity-service';
import { listLeadContacts, createLeadContact, type LeadContact, type LeadContactCreate } from '@/lib/api/lead-contact-service';

const { Title, Text } = Typography;

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<LeadWithDetails | null>(null);
  const [activities, setActivities] = useState<ActivityWithDetails[]>([]);
  const [activeTab, setActiveTab] = useState('details');

  // Modals
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [contactForm] = Form.useForm();
  const [activityForm] = Form.useForm();

  useEffect(() => {
    if (leadId) {
      fetchLead();
      fetchActivities();
    }
  }, [leadId]);

  const fetchLead = async () => {
    setLoading(true);
    try {
      const data = await getLead(leadId);
      setLead(data);
    } catch (error: any) {
      message.error(`Ошибка загрузки лида: ${error.message}`);
      router.push('/leads');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await listActivities({ lead_id: leadId, limit: 100 });
      setActivities(response.data || []);
    } catch (error: any) {
      message.error(`Ошибка загрузки активностей: ${error.message}`);
    }
  };

  const handleQualify = async () => {
    if (!lead) return;
    try {
      const response = await qualifyLead(leadId);
      message.success(`Лид квалифицирован. Создан клиент "${response.customer_name}"`);
      router.push(`/customers/${response.customer_id}`);
    } catch (error: any) {
      message.error(`Ошибка квалификации: ${error.message}`);
    }
  };

  const handleAddContact = async (values: LeadContactCreate) => {
    try {
      await createLeadContact(leadId, values);
      message.success('Контакт добавлен');
      contactForm.resetFields();
      setContactModalOpen(false);
      fetchLead(); // Refresh to get updated contacts
    } catch (error: any) {
      message.error(`Ошибка добавления контакта: ${error.message}`);
    }
  };

  const handleAddActivity = async (values: any) => {
    try {
      const activityData: ActivityCreate = {
        lead_id: leadId,
        type: values.type,
        title: values.title,
        notes: values.notes,
        scheduled_at: values.scheduled_at?.toISOString(),
        duration_minutes: values.duration_minutes || 15,
      };
      await createActivity(activityData);
      message.success('Активность добавлена');
      activityForm.resetFields();
      setActivityModalOpen(false);
      fetchActivities(); // Refresh
    } catch (error: any) {
      message.error(`Ошибка добавления активности: ${error.message}`);
    }
  };

  const handleCompleteActivity = async (activityId: string) => {
    try {
      await completeActivity(activityId);
      message.success('Активность завершена');
      fetchActivities(); // Refresh
    } catch (error: any) {
      message.error(`Ошибка: ${error.message}`);
    }
  };

  if (loading || !lead) {
    return (
      <MainLayout>
        <div style={{ padding: 60, textAlign: 'center' }}>
          <Spin size="large" tip="Загрузка лида..." />
        </div>
      </MainLayout>
    );
  }

  const isQualified = lead.stage_name === 'Квалифицирован';
  const isFailed = lead.stage_name === 'Отказ';

  const tabItems = [
    {
      key: 'details',
      label: 'Детали',
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Company Info */}
          <Card title="Информация о компании">
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Название">{lead.company_name}</Descriptions.Item>
              <Descriptions.Item label="ИНН">{lead.inn || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">
                {lead.email ? (
                  <Space>
                    <MailOutlined />
                    <a href={`mailto:${lead.email}`}>{lead.email}</a>
                  </Space>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Телефон">
                {lead.primary_phone ? (
                  <Space>
                    <PhoneOutlined />
                    <a href={`tel:${lead.primary_phone}`}>{lead.primary_phone}</a>
                  </Space>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Сегмент">{lead.segment || '—'}</Descriptions.Item>
              <Descriptions.Item label="Этап">
                <Tag color={lead.stage_color}>{lead.stage_name}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Ответственный" span={2}>
                {lead.assigned_to_name || <Tag color="orange">Не назначен</Tag>}
              </Descriptions.Item>
              {lead.notes && (
                <Descriptions.Item label="Заметки" span={2}>
                  {lead.notes}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* Contacts (ЛПР) */}
          <Card
            title="Контактные лица (ЛПР)"
            extra={
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setContactModalOpen(true)}
              >
                Добавить контакт
              </Button>
            }
          >
            {lead.contacts && lead.contacts.length > 0 ? (
              <List
                dataSource={lead.contacts}
                renderItem={(contact) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} />}
                      title={
                        <Space>
                          {contact.full_name}
                          {contact.is_primary && (
                            <Tag color="blue" style={{ fontSize: '11px' }}>
                              Основной
                            </Tag>
                          )}
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={2}>
                          {contact.position && <Text type="secondary">{contact.position}</Text>}
                          {contact.phone && (
                            <Space size={4}>
                              <PhoneOutlined style={{ fontSize: '12px' }} />
                              <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                            </Space>
                          )}
                          {contact.email && (
                            <Space size={4}>
                              <MailOutlined style={{ fontSize: '12px' }} />
                              <a href={`mailto:${contact.email}`}>{contact.email}</a>
                            </Space>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="Нет контактов" />
            )}
          </Card>
        </Space>
      ),
    },
    {
      key: 'activities',
      label: `Активности (${activities.length})`,
      children: (
        <Card
          extra={
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setActivityModalOpen(true)}
            >
              Добавить активность
            </Button>
          }
        >
          {activities.length > 0 ? (
            <Timeline
              items={activities.map((activity) => ({
                color: activity.completed ? 'green' : 'blue',
                children: (
                  <div>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Space>
                        <Tag>{getActivityTypeLabel(activity.type)}</Tag>
                        {activity.completed && <Tag color="green">Завершено</Tag>}
                      </Space>
                      <Text strong>{activity.title || getActivityTypeLabel(activity.type)}</Text>
                      {activity.scheduled_at && (
                        <Space size={4}>
                          <CalendarOutlined style={{ fontSize: '12px', color: '#888' }} />
                          <Text style={{ fontSize: '12px' }}>
                            {new Date(activity.scheduled_at).toLocaleString('ru-RU')}
                          </Text>
                          {activity.duration_minutes && (
                            <>
                              <ClockCircleOutlined style={{ fontSize: '12px', color: '#888' }} />
                              <Text style={{ fontSize: '12px' }}>{activity.duration_minutes} мин</Text>
                            </>
                          )}
                        </Space>
                      )}
                      {activity.notes && <Text type="secondary">{activity.notes}</Text>}
                      {activity.result && (
                        <Text type="secondary">Результат: {activity.result}</Text>
                      )}
                      {activity.assigned_to_name && (
                        <Text style={{ fontSize: '11px', color: '#888' }}>
                          Ответственный: {activity.assigned_to_name}
                        </Text>
                      )}
                      {!activity.completed && (
                        <Button
                          type="link"
                          size="small"
                          onClick={() => handleCompleteActivity(activity.id)}
                        >
                          Завершить
                        </Button>
                      )}
                    </Space>
                  </div>
                ),
              }))}
            />
          ) : (
            <Empty description="Нет активностей" />
          )}
        </Card>
      ),
    },
  ];

  return (
    <MainLayout>
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/leads')}>
                  Назад
                </Button>
                <Title level={2} style={{ margin: 0 }}>
                  {lead.company_name}
                </Title>
                <Tag color={lead.stage_color}>{lead.stage_name}</Tag>
              </Space>
            </Col>
            <Col>
              <Space>
                <Button icon={<EditOutlined />} onClick={() => router.push(`/leads/${leadId}/edit`)}>
                  Редактировать
                </Button>
                {!isQualified && !isFailed && (
                  <Popconfirm
                    title="Квалифицировать лид?"
                    description={`Создать клиента из лида "${lead.company_name}"?`}
                    onConfirm={handleQualify}
                    okText="Да"
                    cancelText="Нет"
                  >
                    <Button type="primary" icon={<CheckCircleOutlined />}>
                      Квалифицировать
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </Col>
          </Row>

          {/* Tabs */}
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
        </Space>

        {/* Add Contact Modal */}
        <Modal
          title="Добавить контакт"
          open={contactModalOpen}
          onCancel={() => setContactModalOpen(false)}
          onOk={() => contactForm.submit()}
          okText="Добавить"
          cancelText="Отмена"
        >
          <Form form={contactForm} layout="vertical" onFinish={handleAddContact}>
            <Form.Item
              label="Ф.И.О."
              name="full_name"
              rules={[{ required: true, message: 'Введите ФИО' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item label="Должность" name="position">
              <Input />
            </Form.Item>
            <Form.Item label="Телефон" name="phone">
              <Input />
            </Form.Item>
            <Form.Item label="Email" name="email">
              <Input type="email" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Add Activity Modal */}
        <Modal
          title="Добавить активность"
          open={activityModalOpen}
          onCancel={() => setActivityModalOpen(false)}
          onOk={() => activityForm.submit()}
          okText="Добавить"
          cancelText="Отмена"
        >
          <Form form={activityForm} layout="vertical" onFinish={handleAddActivity}>
            <Form.Item
              label="Тип"
              name="type"
              rules={[{ required: true, message: 'Выберите тип' }]}
              initialValue="meeting"
            >
              <Select>
                <Select.Option value="call">Звонок</Select.Option>
                <Select.Option value="meeting">Встреча</Select.Option>
                <Select.Option value="email">Email</Select.Option>
                <Select.Option value="task">Задача</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="Название" name="title">
              <Input placeholder="Например: Обсуждение коммерческого предложения" />
            </Form.Item>
            <Form.Item label="Заметки" name="notes">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item label="Длительность (минуты)" name="duration_minutes" initialValue={15}>
              <Input type="number" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </MainLayout>
  );
}

function getActivityTypeLabel(type: string): string {
  const labels = {
    call: 'Звонок',
    meeting: 'Встреча',
    email: 'Email',
    task: 'Задача',
  };
  return labels[type as keyof typeof labels] || type;
}
