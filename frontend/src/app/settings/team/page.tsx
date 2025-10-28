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
  Popconfirm,
  Row,
  Col,
  Modal,
  Form,
  Input,
  Select,
  Spin,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  MailOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import {
  fetchTeamMembers,
  fetchRoles,
  inviteMember,
  updateMemberRole,
  removeMember,
  TeamMember,
  Role,
  getRoleBadgeColor,
  getRoleDisplayName,
  canModifyMember,
} from '@/lib/api/team-service';
import { createClient } from '@/lib/supabase/client';

dayjs.locale('ru');

const { Title, Text } = Typography;

export default function TeamManagementPage() {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [organizationId, setOrganizationId] = useState<string>('');

  // Invite modal
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteForm] = Form.useForm();
  const [inviteLoading, setInviteLoading] = useState(false);

  // Fetch current user and organization
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setCurrentUserId(user.id);

        // Get user's organization and role
        // For now, using app_metadata (should be fetched from backend)
        const orgId = user.user_metadata?.current_organization_id;
        const role = user.user_metadata?.role || 'member';

        if (orgId) {
          setOrganizationId(orgId);
          setCurrentUserRole(role);
          loadData(orgId);
        } else {
          message.error('Организация не найдена. Пожалуйста, выберите организацию.');
        }
      }
    };

    fetchCurrentUser();
  }, []);

  const loadData = async (orgId: string) => {
    setLoading(true);
    try {
      const [membersData, rolesData] = await Promise.all([
        fetchTeamMembers(orgId),
        fetchRoles(orgId),
      ]);

      setMembers(membersData);
      setRoles(rolesData);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (values: { email: string; role_id: string }) => {
    setInviteLoading(true);
    try {
      await inviteMember(organizationId, {
        email: values.email,
        role_id: values.role_id,
      });

      message.success('Приглашение отправлено');
      setInviteModalVisible(false);
      inviteForm.resetFields();
      loadData(organizationId);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка отправки приглашения');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, roleId: string) => {
    try {
      await updateMemberRole(organizationId, userId, roleId);
      message.success('Роль изменена');
      loadData(organizationId);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка изменения роли');
    }
  };

  const handleRemove = async (userId: string, userName: string) => {
    try {
      await removeMember(organizationId, userId);
      message.success(`${userName} удален из команды`);
      loadData(organizationId);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка удаления участника');
    }
  };

  // Check if current user is admin/manager/owner
  const canManageTeam = ['owner', 'admin', 'manager'].includes(currentUserRole);

  // Filter out owner role from invitation options (only one owner allowed)
  const invitableRoles = roles.filter((role) => role.slug !== 'owner');

  const columns = [
    {
      title: 'Участник',
      key: 'user',
      width: 250,
      render: (_: any, record: TeamMember) => (
        <Space direction="vertical" size={0}>
          <Space>
            <UserOutlined />
            <Text strong>{record.user_full_name || 'Без имени'}</Text>
            {record.is_owner && (
              <Tag color="red" style={{ fontSize: '10px' }}>
                Владелец
              </Tag>
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <MailOutlined style={{ marginRight: 4 }} />
            {record.user_email}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Роль',
      dataIndex: 'role_slug',
      key: 'role',
      width: 180,
      render: (roleSlug: string, record: TeamMember) => {
        const color = getRoleBadgeColor(roleSlug);
        const displayName = getRoleDisplayName(roleSlug, record.role_name);

        if (!canManageTeam || !canModifyMember(currentUserId, record, currentUserRole)) {
          return <Tag color={color}>{displayName}</Tag>;
        }

        return (
          <Select
            value={record.role_id}
            style={{ width: 150 }}
            size="small"
            onChange={(value) => handleRoleChange(record.user_id, value)}
            disabled={record.is_owner || record.user_id === currentUserId}
            options={invitableRoles.map((role) => ({
              label: getRoleDisplayName(role.slug, role.name),
              value: role.id,
            }))}
          />
        );
      },
    },
    {
      title: 'Дата присоединения',
      dataIndex: 'joined_at',
      key: 'joined_at',
      width: 150,
      render: (date: string) => (
        <Text style={{ fontSize: '12px' }}>{dayjs(date).format('DD.MM.YYYY')}</Text>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap = {
          active: { color: 'green', text: 'Активен' },
          invited: { color: 'blue', text: 'Приглашен' },
          left: { color: 'default', text: 'Покинул' },
        };
        const config = statusMap[status as keyof typeof statusMap] || {
          color: 'default',
          text: status,
        };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: TeamMember) => {
        if (!canManageTeam || !canModifyMember(currentUserId, record, currentUserRole)) {
          return null;
        }

        return (
          <Popconfirm
            title="Удалить участника?"
            description={`Вы уверены, что хотите удалить ${record.user_full_name || record.user_email} из команды?`}
            onConfirm={() =>
              handleRemove(record.user_id, record.user_full_name || record.user_email)
            }
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small" title="Удалить" />
          </Popconfirm>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <TeamOutlined style={{ fontSize: '24px' }} />
              <Title level={2} style={{ margin: 0 }}>
                Команда
              </Title>
            </Space>
          </Col>
          <Col>
            {canManageTeam && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="large"
                onClick={() => setInviteModalVisible(true)}
              >
                Пригласить участника
              </Button>
            )}
          </Col>
        </Row>

        {/* Info Alert for non-admins */}
        {!canManageTeam && (
          <Alert
            message="Только администраторы могут управлять командой"
            description="Обратитесь к администратору организации для изменения ролей или приглашения новых участников."
            type="info"
            showIcon
          />
        )}

        {/* Members Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={members}
            rowKey="id"
            loading={loading}
            scroll={{ x: 800 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Всего: ${total} участников`,
            }}
          />
        </Card>

        {/* Invite Modal */}
        <Modal
          title="Пригласить участника"
          open={inviteModalVisible}
          onCancel={() => {
            setInviteModalVisible(false);
            inviteForm.resetFields();
          }}
          footer={null}
          width={500}
        >
          <Form form={inviteForm} layout="vertical" onFinish={handleInvite}>
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Введите email' },
                { type: 'email', message: 'Некорректный email' },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="user@example.com"
                size="large"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              label="Роль"
              name="role_id"
              rules={[{ required: true, message: 'Выберите роль' }]}
              initialValue={invitableRoles.find((r) => r.slug === 'member')?.id}
            >
              <Select
                placeholder="Выберите роль"
                size="large"
                options={invitableRoles.map((role) => ({
                  label: (
                    <Space>
                      <Tag color={getRoleBadgeColor(role.slug)}>
                        {getRoleDisplayName(role.slug, role.name)}
                      </Tag>
                      {role.description && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {role.description}
                        </Text>
                      )}
                    </Space>
                  ),
                  value: role.id,
                }))}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button
                  onClick={() => {
                    setInviteModalVisible(false);
                    inviteForm.resetFields();
                  }}
                >
                  Отмена
                </Button>
                <Button type="primary" htmlType="submit" loading={inviteLoading}>
                  Отправить приглашение
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </Space>
    </div>
  );
}
