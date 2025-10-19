'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Button,
  Space,
  Typography,
  message,
  Row,
  Col,
  Tag,
  Empty,
  Spin,
} from 'antd'
import {
  PlusOutlined,
  SettingOutlined,
  TeamOutlined,
  CrownOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import MainLayout from '@/components/layout/MainLayout'
import { organizationService } from '@/lib/api/organization-service'
import { UserOrganization } from '@/lib/types/organization'

const { Title, Text, Paragraph } = Typography

export default function OrganizationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [organizations, setOrganizations] = useState<UserOrganization[]>([])

  useEffect(() => {
    fetchOrganizations()
  }, [])

  const fetchOrganizations = async () => {
    setLoading(true)
    try {
      const result = await organizationService.listOrganizations()

      if (result.success && result.data) {
        setOrganizations(result.data)
      } else {
        message.error(result.error || 'Ошибка загрузки организаций')
      }
    } catch (error: any) {
      message.error(`Ошибка: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadge = (roleName: string, isOwner: boolean) => {
    if (isOwner) {
      return (
        <Tag icon={<CrownOutlined />} color="gold">
          Владелец
        </Tag>
      )
    }

    // Map role names to Russian labels
    const roleMap: Record<string, { label: string; color: string }> = {
      'admin': { label: 'Администратор', color: 'red' },
      'financial-admin': { label: 'Финансовый администратор', color: 'purple' },
      'sales-manager': { label: 'Менеджер по продажам', color: 'blue' },
      'procurement-manager': { label: 'Менеджер по закупкам', color: 'cyan' },
      'logistics-manager': { label: 'Менеджер по логистике', color: 'green' },
    }

    const role = roleMap[roleName] || { label: roleName, color: 'default' }

    return (
      <Tag icon={<UserOutlined />} color={role.color}>
        {role.label}
      </Tag>
    )
  }

  const canManageOrganization = (roleName: string, isOwner: boolean) => {
    // Only owners and admins can access settings
    return isOwner || roleName === 'admin'
  }

  const truncateDescription = (description?: string) => {
    if (!description) return 'Нет описания'
    if (description.length <= 100) return description
    return description.substring(0, 100) + '...'
  }

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              Мои организации
            </Title>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => router.push('/organizations/create')}
            >
              Создать организацию
            </Button>
          </Col>
        </Row>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin size="large" tip="Загрузка организаций...">
              <div style={{ minHeight: '200px' }} />
            </Spin>
          </div>
        )}

        {/* Empty State */}
        {!loading && organizations.length === 0 && (
          <Card>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size="small">
                  <Text>У вас пока нет организаций. Создайте первую!</Text>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => router.push('/organizations/create')}
                  >
                    Создать организацию
                  </Button>
                </Space>
              }
            />
          </Card>
        )}

        {/* Organizations Grid */}
        {!loading && organizations.length > 0 && (
          <Row gutter={[16, 16]}>
            {organizations.map((org) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={org.organization_id}>
                <Card
                  title={
                    <Space direction="vertical" size={0} style={{ width: '100%' }}>
                      <Text strong style={{ fontSize: '16px' }}>
                        {org.organization_name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        @{org.organization_slug}
                      </Text>
                    </Space>
                  }
                  extra={getRoleBadge(org.role_slug, org.is_owner)}
                  actions={[
                    <Button
                      key="view"
                      type="link"
                      icon={<TeamOutlined />}
                      onClick={() => router.push(`/organizations/${org.organization_id}/team`)}
                    >
                      Команда
                    </Button>,
                    canManageOrganization(org.role_slug, org.is_owner) ? (
                      <Button
                        key="settings"
                        type="link"
                        icon={<SettingOutlined />}
                        onClick={() => router.push(`/organizations/${org.organization_id}/settings`)}
                      >
                        Настройки
                      </Button>
                    ) : (
                      <div key="settings" />
                    ),
                  ]}
                  hoverable
                  style={{ height: '100%' }}
                >
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Ваша роль:
                      </Text>
                      <br />
                      <Text strong>{org.role_name}</Text>
                    </div>

                    <div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Присоединились:
                      </Text>
                      <br />
                      <Text>
                        {new Date(org.joined_at).toLocaleDateString('ru-RU')}
                      </Text>
                    </div>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {/* Info Card */}
        {!loading && organizations.length > 0 && (
          <Card>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Text type="secondary">Всего организаций</Text>
                <br />
                <Title level={3} style={{ margin: 0 }}>
                  {organizations.length}
                </Title>
              </Col>
              <Col xs={24} sm={8}>
                <Text type="secondary">Владелец</Text>
                <br />
                <Title level={3} style={{ margin: 0 }}>
                  {organizations.filter((org) => org.is_owner).length}
                </Title>
              </Col>
              <Col xs={24} sm={8}>
                <Text type="secondary">Участник</Text>
                <br />
                <Title level={3} style={{ margin: 0 }}>
                  {organizations.filter((org) => !org.is_owner).length}
                </Title>
              </Col>
            </Row>
          </Card>
        )}
      </Space>
    </MainLayout>
  )
}
