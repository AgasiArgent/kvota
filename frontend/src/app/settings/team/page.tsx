'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Card,
  Tag,
  Typography,
  App,
  Popconfirm,
  Row,
  Col,
  Modal,
  Form,
  Input,
  Select,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  TeamOutlined,
  MailOutlined,
  UserOutlined,
  KeyOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import {
  fetchTeamMembers,
  fetchRoles,
  addMember,
  updateMemberRole,
  removeMember,
  resetMemberPassword,
  TeamMember,
  Role,
  AddMemberResponse,
  getRoleBadgeColor,
  getRoleDisplayName,
  canModifyMember,
} from '@/lib/api/team-service';
import { organizationService } from '@/lib/api/organization-service';
import { createClient } from '@/lib/supabase/client';

dayjs.locale('ru');

const { Title, Text } = Typography;

export default function TeamManagementPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [organizationId, setOrganizationId] = useState<string>('');

  // Add member modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForm] = Form.useForm();
  const [addLoading, setAddLoading] = useState(false);

  // Password display modal
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordInfo, setPasswordInfo] = useState<{
    email: string;
    password: string;
    fullName: string;
    isReset: boolean;
  } | null>(null);

  // Fetch current user and organization
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setCurrentUserId(user.id);

        // Get user's organizations from API
        const result = await organizationService.listOrganizations();

        if (result.success && result.data && result.data.length > 0) {
          // Use the first organization's ID
          const orgId = result.data[0].organization_id;
          setOrganizationId(orgId);
          // Pass user.id directly to avoid React state timing issues
          loadData(orgId, user.id);
        } else {
          message.error('Организация не найдена. Пожалуйста, обратитесь к администратору.');
        }
      }
    };

    fetchCurrentUser();
  }, []);

  const loadData = async (orgId: string, userId?: string) => {
    setLoading(true);
    try {
      const [membersData, rolesData] = await Promise.all([
        fetchTeamMembers(orgId),
        fetchRoles(orgId),
      ]);

      setMembers(membersData);
      setRoles(rolesData);

      // Get current user's actual role from team members data
      const userIdToFind = userId || currentUserId;
      const currentMember = membersData.find((m) => m.user_id === userIdToFind);
      if (currentMember) {
        setCurrentUserRole(currentMember.role_slug);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (values: { email: string; full_name: string; role_id: string }) => {
    setAddLoading(true);
    try {
      const result: AddMemberResponse = await addMember(organizationId, {
        email: values.email,
        full_name: values.full_name,
        role_id: values.role_id,
      });

      message.success(result.message);
      setAddModalVisible(false);
      addForm.resetFields();

      // If new user was created, show the password
      if (result.is_new_user && result.generated_password) {
        setPasswordInfo({
          email: result.user_email,
          password: result.generated_password,
          fullName: result.user_full_name,
          isReset: false,
        });
        setPasswordModalVisible(true);
      }

      loadData(organizationId);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка добавления участника');
    } finally {
      setAddLoading(false);
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

  const handleRemove = async (memberId: string, userName: string) => {
    try {
      await removeMember(organizationId, memberId);
      message.success(`${userName} удален из команды`);
      loadData(organizationId);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка удаления');
    }
  };

  const handleResetPassword = async (memberId: string, userEmail: string) => {
    try {
      const result = await resetMemberPassword(organizationId, memberId);
      setPasswordInfo({
        email: result.user_email,
        password: result.new_password,
        fullName: userEmail,
        isReset: true,
      });
      setPasswordModalVisible(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка сброса пароля');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Скопировано в буфер обмена');
  };

  // Check if current user is admin/manager/owner
  const canManageTeam = ['owner', 'admin', 'manager'].includes(currentUserRole);
  const isOwnerOrAdmin = ['owner', 'admin'].includes(currentUserRole);

  // Filter out owner role from options (only one owner allowed)
  const assignableRoles = roles.filter((role) => role.slug !== 'owner');

  const columns = [
    {
      title: 'Участник',
      key: 'user',
      width: 280,
      render: (_: unknown, record: TeamMember) => (
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
            options={assignableRoles.map((role) => ({
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
      width: 140,
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
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, record: TeamMember) => {
        if (!canManageTeam) {
          return null;
        }

        const canModify = canModifyMember(currentUserId, record, currentUserRole);

        return (
          <Space size="small">
            {/* Reset Password Button - only for admin/owner */}
            {isOwnerOrAdmin && canModify && (
              <Popconfirm
                title="Сбросить пароль?"
                description={`Сгенерировать новый пароль для ${record.user_email}?`}
                onConfirm={() => handleResetPassword(record.id, record.user_email)}
                okText="Сбросить"
                cancelText="Отмена"
              >
                <Button type="text" icon={<KeyOutlined />} size="small" title="Сбросить пароль" />
              </Popconfirm>
            )}

            {/* Delete Button */}
            {canModify && (
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
            )}
          </Space>
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
                onClick={() => setAddModalVisible(true)}
              >
                Добавить участника
              </Button>
            )}
          </Col>
        </Row>

        {/* Info Alert for non-admins */}
        {!canManageTeam && (
          <Alert
            message="Только администраторы могут управлять командой"
            description="Обратитесь к администратору организации для изменения ролей или добавления новых участников."
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

        {/* Add Member Modal */}
        <Modal
          title="Добавить участника"
          open={addModalVisible}
          onCancel={() => {
            setAddModalVisible(false);
            addForm.resetFields();
          }}
          footer={null}
          width={500}
        >
          <Form form={addForm} layout="vertical" onFinish={handleAddMember}>
            <Form.Item
              label="Имя"
              name="full_name"
              rules={[{ required: true, message: 'Введите имя участника' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="Иван Иванов" size="large" autoFocus />
            </Form.Item>

            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Введите email' },
                { type: 'email', message: 'Некорректный email' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="user@example.com" size="large" />
            </Form.Item>

            <Form.Item
              label="Роль"
              name="role_id"
              rules={[{ required: true, message: 'Выберите роль' }]}
              initialValue={assignableRoles.find((r) => r.slug === 'member')?.id}
            >
              <Select
                placeholder="Выберите роль"
                size="large"
                options={assignableRoles.map((role) => ({
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

            <Alert
              message="Если пользователя с таким email нет в системе, он будет создан автоматически. Вы получите пароль для передачи новому участнику."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button
                  onClick={() => {
                    setAddModalVisible(false);
                    addForm.resetFields();
                  }}
                >
                  Отмена
                </Button>
                <Button type="primary" htmlType="submit" loading={addLoading}>
                  Добавить
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Password Display Modal */}
        <Modal
          title={passwordInfo?.isReset ? 'Новый пароль' : 'Данные для входа'}
          open={passwordModalVisible}
          onCancel={() => {
            setPasswordModalVisible(false);
            setPasswordInfo(null);
          }}
          footer={[
            <Button
              key="close"
              type="primary"
              onClick={() => {
                setPasswordModalVisible(false);
                setPasswordInfo(null);
              }}
            >
              Закрыть
            </Button>,
          ]}
          width={500}
        >
          {passwordInfo && (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Alert
                message="Сохраните эти данные!"
                description="Пароль показывается только один раз. Передайте его участнику безопасным способом."
                type="warning"
                showIcon
              />

              <div>
                <Text type="secondary">Email:</Text>
                <Input.Group compact style={{ marginTop: 4 }}>
                  <Input
                    value={passwordInfo.email}
                    readOnly
                    style={{ width: 'calc(100% - 40px)' }}
                  />
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(passwordInfo.email)}
                  />
                </Input.Group>
              </div>

              <div>
                <Text type="secondary">Пароль:</Text>
                <Input.Group compact style={{ marginTop: 4 }}>
                  <Input.Password
                    value={passwordInfo.password}
                    readOnly
                    visibilityToggle
                    style={{ width: 'calc(100% - 40px)' }}
                  />
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(passwordInfo.password)}
                  />
                </Input.Group>
              </div>

              <Button
                type="dashed"
                block
                icon={<CopyOutlined />}
                onClick={() =>
                  copyToClipboard(`Email: ${passwordInfo.email}\nПароль: ${passwordInfo.password}`)
                }
              >
                Скопировать всё
              </Button>
            </Space>
          )}
        </Modal>
      </Space>
    </div>
  );
}
