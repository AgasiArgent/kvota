'use client'

import React, { useState, useEffect } from 'react'
import {
  Form,
  Input,
  Button,
  Card,
  Space,
  Typography,
  message,
  Breadcrumb,
  Divider,
  Modal,
  Descriptions,
  Tag,
  Spin,
  Alert,
} from 'antd'
import {
  SaveOutlined,
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  HomeOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useRouter, useParams } from 'next/navigation'
import MainLayout from '@/components/layout/MainLayout'
import { organizationService } from '@/lib/api/organization-service'
import { Organization, OrganizationUpdate } from '@/lib/types/organization'

const { Title, Text } = Typography
const { TextArea } = Input
const { confirm } = Modal

export default function OrganizationSettingsPage() {
  const router = useRouter()
  const params = useParams()
  const organizationId = params.id as string

  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    fetchOrganization()
  }, [organizationId])

  const fetchOrganization = async () => {
    setLoading(true)
    try {
      const result = await organizationService.getOrganization(organizationId)

      if (result.success && result.data) {
        setOrganization(result.data)
        form.setFieldsValue({
          name: result.data.name,
          description: result.data.description,
        })

        // Check user's role
        const orgsResult = await organizationService.listOrganizations()
        if (orgsResult.success && orgsResult.data) {
          const userOrg = orgsResult.data.find(
            (org) => org.organization_id === organizationId
          )
          if (userOrg) {
            const canManage = userOrg.is_owner || userOrg.role_slug === 'admin'
            setCanEdit(canManage)
            setIsOwner(userOrg.is_owner)
          }
        }
      } else {
        message.error(result.error || 'Ошибка загрузки организации')
        router.push('/organizations')
      }
    } catch (error: any) {
      message.error(`Ошибка: ${error.message}`)
      router.push('/organizations')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (values: OrganizationUpdate) => {
    setSaving(true)
    try {
      const result = await organizationService.updateOrganization(
        organizationId,
        values
      )

      if (result.success && result.data) {
        setOrganization(result.data)
        setEditMode(false)
        message.success('Изменения успешно сохранены')
      } else {
        message.error(result.error || 'Ошибка сохранения изменений')
      }
    } catch (error: any) {
      message.error(`Ошибка: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    confirm({
      title: 'Удалить организацию?',
      icon: <ExclamationCircleOutlined />,
      content: (
        <Space direction="vertical">
          <Text>Вы уверены, что хотите удалить эту организацию?</Text>
          <Text type="danger">Это действие нельзя отменить.</Text>
          <Text type="secondary">
            Организация будет помечена как удалённая и больше не будет доступна.
          </Text>
        </Space>
      ),
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      async onOk() {
        setDeleting(true)
        try {
          const result = await organizationService.deleteOrganization(
            organizationId
          )

          if (result.success) {
            message.success('Организация успешно удалена')
            router.push('/organizations')
          } else {
            message.error(result.error || 'Ошибка удаления организации')
          }
        } catch (error: any) {
          message.error(`Ошибка: ${error.message}`)
        } finally {
          setDeleting(false)
        }
      },
    })
  }

  const handleCancel = () => {
    form.setFieldsValue({
      name: organization?.name,
      description: organization?.description,
    })
    setEditMode(false)
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      active: { label: 'Активна', color: 'green' },
      trial: { label: 'Пробный период', color: 'blue' },
      suspended: { label: 'Приостановлена', color: 'red' },
      deleted: { label: 'Удалена', color: 'gray' },
    }

    const s = statusMap[status] || { label: status, color: 'default' }
    return <Tag color={s.color}>{s.label}</Tag>
  }

  if (loading) {
    return (
      <MainLayout>
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" tip="Загрузка организации..." />
        </div>
      </MainLayout>
    )
  }

  if (!organization) {
    return (
      <MainLayout>
        <Alert
          message="Организация не найдена"
          description="Запрошенная организация не существует или у вас нет прав доступа."
          type="error"
          showIcon
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            {
              href: '/organizations',
              title: (
                <>
                  <HomeOutlined />
                  <span>Организации</span>
                </>
              ),
            },
            {
              title: organization.name,
            },
            {
              title: (
                <>
                  <SettingOutlined />
                  <span>Настройки</span>
                </>
              ),
            },
          ]}
        />

        {/* Header */}
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push('/organizations')}
            >
              Назад
            </Button>
            <Title level={2} style={{ margin: 0 }}>
              {organization.name}
            </Title>
            {getStatusBadge(organization.status)}
          </Space>
          {canEdit && !editMode && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => setEditMode(true)}
            >
              Редактировать
            </Button>
          )}
        </Space>

        {/* View Mode */}
        {!editMode && (
          <Card title="Информация об организации">
            <Descriptions column={1}>
              <Descriptions.Item label="Название">
                {organization.name}
              </Descriptions.Item>
              <Descriptions.Item label="Идентификатор">
                <Text code>@{organization.slug}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Описание">
                {organization.description || (
                  <Text type="secondary">Нет описания</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Статус">
                {getStatusBadge(organization.status)}
              </Descriptions.Item>
              <Descriptions.Item label="Дата создания">
                {new Date(organization.created_at).toLocaleString('ru-RU')}
              </Descriptions.Item>
              <Descriptions.Item label="Последнее обновление">
                {new Date(organization.updated_at).toLocaleString('ru-RU')}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {/* Edit Mode */}
        {editMode && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            requiredMark="optional"
          >
            <Card title="Редактировать организацию">
              <Form.Item
                name="name"
                label="Название организации"
                rules={[
                  { required: true, message: 'Введите название' },
                  { min: 3, message: 'Минимум 3 символа' },
                  { max: 100, message: 'Максимум 100 символов' },
                ]}
              >
                <Input size="large" placeholder="Название организации" />
              </Form.Item>

              <Form.Item label="Идентификатор">
                <Input
                  value={organization.slug}
                  disabled
                  size="large"
                  addonBefore="@"
                />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Идентификатор нельзя изменить, чтобы не сломать существующие
                  ссылки
                </Text>
              </Form.Item>

              <Form.Item
                name="description"
                label="Описание"
                rules={[{ max: 500, message: 'Максимум 500 символов' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="Описание организации"
                  maxLength={500}
                  showCount
                />
              </Form.Item>

              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={saving}
                >
                  Сохранить изменения
                </Button>
                <Button onClick={handleCancel}>Отменить</Button>
              </Space>
            </Card>
          </Form>
        )}

        {/* Danger Zone (Owner only) */}
        {isOwner && (
          <Card
            title={
              <Text type="danger">
                <ExclamationCircleOutlined /> Опасная зона
              </Text>
            }
            style={{ borderColor: '#ff4d4f' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Title level={5}>Удалить организацию</Title>
                <Text type="secondary">
                  После удаления организация будет помечена как удалённая и
                  станет недоступна. Это действие нельзя отменить.
                </Text>
              </div>
              <Divider />
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleDelete}
                loading={deleting}
              >
                Удалить организацию
              </Button>
            </Space>
          </Card>
        )}
      </Space>
    </MainLayout>
  )
}
