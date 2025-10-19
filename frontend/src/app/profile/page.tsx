'use client'

import React, { useState } from 'react'
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Row,
  Col,
  message,
  Divider,
  Statistic,
  Avatar,
  Upload,
  Descriptions,
} from 'antd'
import {
  UserOutlined,
  SaveOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  CameraOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import MainLayout from '@/components/layout/MainLayout'
import { useAuth } from '@/lib/auth/AuthProvider'

const { Title, Text } = Typography

export default function ProfilePage() {
  const { user, profile, updateProfile } = useAuth()
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Mock stats - in real app, fetch from API
  const stats = {
    quotesCreated: 45,
    quotesApproved: 12,
    quotesInProgress: 8,
    totalRevenue: 12500000,
  }

  const handleProfileUpdate = async (values: any) => {
    setLoading(true)
    try {
      await updateProfile(values)
      message.success('Профиль успешно обновлен')
    } catch (error: any) {
      message.error(`Ошибка обновления профиля: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (values: any) => {
    setPasswordLoading(true)
    try {
      // In real app, call API to change password
      // await authService.changePassword(values.current_password, values.new_password)
      message.success('Пароль успешно изменен')
      passwordForm.resetFields()
    } catch (error: any) {
      message.error(`Ошибка изменения пароля: ${error.message}`)
    } finally {
      setPasswordLoading(false)
    }
  }

  const getRoleDisplay = (role: string) => {
    const roleMap = {
      sales_manager: 'Менеджер по продажам',
      finance_manager: 'Финансовый менеджер',
      department_manager: 'Руководитель отдела',
      director: 'Директор',
      admin: 'Администратор',
      procurement_manager: 'Менеджер по закупкам',
      customs_manager: 'Менеджер по таможне',
      logistics_manager: 'Менеджер по логистике',
    }
    return roleMap[role as keyof typeof roleMap] || role
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>Мой профиль</Title>
          </Col>
        </Row>

        <Row gutter={24}>
          {/* Main Profile Info */}
          <Col xs={24} lg={16}>
            {/* Personal Information */}
            <Card title="Личная информация">
              <Form
                form={form}
                layout="vertical"
                onFinish={handleProfileUpdate}
                initialValues={{
                  full_name: profile?.full_name || '',
                  email: user?.email || '',
                  phone: profile?.phone || '',
                }}
              >
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="full_name"
                      label="Полное имя"
                      rules={[
                        { required: true, message: 'Введите имя' },
                        { min: 2, message: 'Минимум 2 символа' },
                      ]}
                    >
                      <Input
                        size="large"
                        prefix={<UserOutlined />}
                        placeholder="Иван Иванов"
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="email"
                      label="Email"
                      rules={[
                        { required: true, message: 'Введите email' },
                        { type: 'email', message: 'Неверный формат email' },
                      ]}
                    >
                      <Input
                        size="large"
                        prefix={<MailOutlined />}
                        placeholder="email@example.com"
                        disabled
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item name="phone" label="Телефон">
                      <Input
                        size="large"
                        prefix={<PhoneOutlined />}
                        placeholder="+7 (999) 123-45-67"
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item label="Роль">
                      <Input
                        size="large"
                        value={profile?.role ? getRoleDisplay(profile.role) : 'Пользователь'}
                        disabled
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<SaveOutlined />}
                      size="large"
                      loading={loading}
                    >
                      Сохранить изменения
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card>

            {/* Change Password */}
            <Card title="Изменить пароль" style={{ marginTop: 24 }}>
              <Form
                form={passwordForm}
                layout="vertical"
                onFinish={handlePasswordChange}
              >
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="current_password"
                      label="Текущий пароль"
                      rules={[
                        { required: true, message: 'Введите текущий пароль' },
                      ]}
                    >
                      <Input.Password
                        size="large"
                        prefix={<LockOutlined />}
                        placeholder="••••••••"
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      name="new_password"
                      label="Новый пароль"
                      rules={[
                        { required: true, message: 'Введите новый пароль' },
                        { min: 8, message: 'Минимум 8 символов' },
                      ]}
                    >
                      <Input.Password
                        size="large"
                        prefix={<LockOutlined />}
                        placeholder="••••••••"
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      name="confirm_password"
                      label="Подтвердите пароль"
                      dependencies={['new_password']}
                      rules={[
                        { required: true, message: 'Подтвердите пароль' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue('new_password') === value) {
                              return Promise.resolve()
                            }
                            return Promise.reject(new Error('Пароли не совпадают'))
                          },
                        }),
                      ]}
                    >
                      <Input.Password
                        size="large"
                        prefix={<LockOutlined />}
                        placeholder="••••••••"
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<LockOutlined />}
                      size="large"
                      loading={passwordLoading}
                    >
                      Изменить пароль
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card>

            {/* Account Info */}
            <Card title="Информация об аккаунте" style={{ marginTop: 24 }}>
              <Descriptions column={1} bordered>
                <Descriptions.Item label="ID пользователя">
                  {user?.id}
                </Descriptions.Item>
                <Descriptions.Item label="Email подтвержден">
                  {user?.email_confirmed_at ? (
                    <Text type="success">
                      ✓ Подтвержден {new Date(user.email_confirmed_at).toLocaleDateString('ru-RU')}
                    </Text>
                  ) : (
                    <Text type="warning">Не подтвержден</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Дата регистрации">
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString('ru-RU')
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Последнее обновление">
                  {profile?.updated_at
                    ? new Date(profile.updated_at).toLocaleString('ru-RU')
                    : '—'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          {/* Sidebar */}
          <Col xs={24} lg={8}>
            {/* Avatar */}
            <Card>
              <Space direction="vertical" align="center" style={{ width: '100%' }}>
                <Avatar
                  size={120}
                  icon={<UserOutlined />}
                  src={profile?.avatar_url}
                  style={{ backgroundColor: '#1890ff' }}
                />
                <Title level={4} style={{ margin: 0 }}>
                  {profile?.full_name || user?.email}
                </Title>
                <Text type="secondary">
                  {profile?.role ? getRoleDisplay(profile.role) : 'Пользователь'}
                </Text>
                <Upload
                  showUploadList={false}
                  beforeUpload={(file) => {
                    // In real app, upload to storage
                    message.info('Загрузка аватара в разработке')
                    return false
                  }}
                >
                  <Button icon={<CameraOutlined />}>Изменить фото</Button>
                </Upload>
              </Space>
            </Card>

            {/* Activity Stats */}
            <Card title="Моя активность" style={{ marginTop: 24 }}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Statistic
                  title="Создано КП"
                  value={stats.quotesCreated}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
                <Divider style={{ margin: 0 }} />
                <Statistic
                  title="Утверждено КП"
                  value={stats.quotesApproved}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
                <Divider style={{ margin: 0 }} />
                <Statistic
                  title="В работе"
                  value={stats.quotesInProgress}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
                <Divider style={{ margin: 0 }} />
                <Statistic
                  title="Общая выручка"
                  value={formatCurrency(stats.totalRevenue)}
                  valueStyle={{ color: '#722ed1', fontSize: '18px' }}
                />
              </Space>
            </Card>
          </Col>
        </Row>
      </Space>
    </MainLayout>
  )
}
