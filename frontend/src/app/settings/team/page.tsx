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
  cancelInvitation,
  fetchInvitations,
  TeamMember,
  Role,
  Invitation,
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

  // Invite modal
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteForm] = Form.useForm();
  const [inviteLoading, setInviteLoading] = useState(false);

  // Invitation link modal
  const [invitationLinkModal, setInvitationLinkModal] = useState(false);
  const [invitationLink, setInvitationLink] = useState('');

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
      const [membersData, rolesData, invitationsData] = await Promise.all([
        fetchTeamMembers(orgId),
        fetchRoles(orgId),
        fetchInvitations(orgId),
      ]);

      // Convert invitations to TeamMember-like format
      const invitationsAsMembers: TeamMember[] = invitationsData.map((inv) => ({
        id: inv.id,
        organization_id: inv.organization_id,
        user_id: '', // No user_id yet - invitation not accepted
        role_id: inv.role_id,
        role_name: rolesData.find((r) => r.id === inv.role_id)?.name || '',
        role_slug: rolesData.find((r) => r.id === inv.role_id)?.slug || '',
        user_full_name: null,
        user_email: inv.email,
        is_owner: false,
        status: 'invited',
        joined_at: inv.created_at,
        created_at: inv.created_at,
        updated_at: inv.created_at,
      }));

      // Merge members and invitations
      const allMembers = [...membersData, ...invitationsAsMembers];
      setMembers(allMembers);
      setRoles(rolesData);

      // Get current user's actual role from team members data
      // Use passed userId if available (to avoid React state timing issues)
      const userIdToFind = userId || currentUserId;
      const currentMember = membersData.find((m) => m.user_id === userIdToFind);
      if (currentMember) {
        // Use the role slug from organization_members table
        setCurrentUserRole(currentMember.role_slug);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (values: { email: string; role_id: string }) => {
    setInviteLoading(true);
    try {
      const invitation = await inviteMember(organizationId, {
        email: values.email,
        role_id: values.role_id,
      });

      // Create invitation link
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/invitations/accept/${invitation.token}`;
      setInvitationLink(link);

      message.success('Приглашение создано');
      setInviteModalVisible(false);
      inviteForm.resetFields();
      setInvitationLinkModal(true); // Show the link modal
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

  const handleRemove = async (
    userIdOrInvitationId: string,
    userName: string,
    isInvitation: boolean = false
  ) => {
    try {
      if (isInvitation) {
        await cancelInvitation(organizationId, userIdOrInvitationId);
        message.success(`Приглашение для ${userName} отменено`);
      } else {
        await removeMember(organizationId, userIdOrInvitationId);
        message.success(`${userName} удален из команды`);
      }
      loadData(organizationId);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка удаления');
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

        const isInvited = record.status === 'invited';
        const confirmTitle = isInvited ? 'Отменить приглашение?' : 'Удалить участника?';
        const confirmDescription = isInvited
          ? `Вы уверены, что хотите отменить приглашение для ${record.user_email}?`
          : `Вы уверены, что хотите удалить ${record.user_full_name || record.user_email} из команды?`;
        const buttonTitle = isInvited ? 'Отменить приглашение' : 'Удалить';
        const idToRemove = isInvited ? record.id : record.user_id;

        return (
          <Popconfirm
            title={confirmTitle}
            description={confirmDescription}
            onConfirm={() =>
              handleRemove(idToRemove, record.user_full_name || record.user_email, isInvited)
            }
            okText={isInvited ? 'Отменить' : 'Удалить'}
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              title={buttonTitle}
            />
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

        {/* Invitation Link Modal */}
        <Modal
          title="Ссылка для приглашения"
          open={invitationLinkModal}
          onCancel={() => setInvitationLinkModal(false)}
          footer={[
            <Button key="close" onClick={() => setInvitationLinkModal(false)}>
              Закрыть
            </Button>,
            <Button
              key="copy"
              type="primary"
              onClick={() => {
                navigator.clipboard.writeText(invitationLink);
                message.success('Ссылка скопирована в буфер обмена');
              }}
            >
              Скопировать ссылку
            </Button>,
          ]}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Text>
              Отправьте эту ссылку приглашенному пользователю. Ссылка действительна в течение 7
              дней.
            </Text>
            <Input.TextArea
              value={invitationLink}
              readOnly
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </Space>
        </Modal>
      </Space>
    </div>
  );
}
