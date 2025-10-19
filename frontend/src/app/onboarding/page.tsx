'use client'

import React, { useEffect } from 'react'
import {
  Card,
  Button,
  Typography,
  Space,
  Row,
  Col,
  Divider,
} from 'antd'
import {
  PlusOutlined,
  TeamOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthProvider'

const { Title, Paragraph, Text } = Typography

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      // Not logged in, redirect to login
      router.push('/auth/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Card loading style={{ width: 400 }} />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <Row justify="center" style={{ width: '100%', maxWidth: '1200px' }}>
        <Col xs={24} sm={22} md={20} lg={16} xl={14}>
          <Card
            style={{
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* Header */}
              <div style={{ textAlign: 'center' }}>
                <RocketOutlined style={{ fontSize: '64px', color: '#1890ff', marginBottom: '16px' }} />
                <Title level={2} style={{ marginBottom: '8px' }}>
                  Добро пожаловать!
                </Title>
                <Paragraph style={{ fontSize: '16px', color: '#666' }}>
                  Прежде чем начать работу, создайте организацию или присоединитесь к существующей
                </Paragraph>
              </div>

              <Divider />

              {/* Create Organization Option */}
              <Card
                hoverable
                style={{ border: '2px solid #1890ff' }}
                onClick={() => router.push('/organizations/create')}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Space>
                      <PlusOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
                      <div>
                        <Title level={4} style={{ margin: 0 }}>
                          Создать организацию
                        </Title>
                        <Text type="secondary">
                          Начните с нуля и пригласите команду
                        </Text>
                      </div>
                    </Space>
                  </div>
                  <Paragraph style={{ margin: 0, color: '#666' }}>
                    Создайте свою организацию и получите полный контроль. Вы будете владельцем и сможете:
                  </Paragraph>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
                    <li>Приглашать сотрудников и назначать роли</li>
                    <li>Управлять настройками организации</li>
                    <li>Создавать и утверждать коммерческие предложения</li>
                  </ul>
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlusOutlined />}
                    block
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push('/organizations/create')
                    }}
                  >
                    Создать организацию
                  </Button>
                </Space>
              </Card>

              {/* Join Organization Option */}
              <Card
                hoverable
                style={{ border: '1px solid #d9d9d9', opacity: 0.7 }}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Space>
                      <TeamOutlined style={{ fontSize: '32px', color: '#8c8c8c' }} />
                      <div>
                        <Title level={4} style={{ margin: 0, color: '#8c8c8c' }}>
                          Присоединиться к организации
                        </Title>
                        <Text type="secondary">
                          Получите приглашение от администратора
                        </Text>
                      </div>
                    </Space>
                  </div>
                  <Paragraph style={{ margin: 0, color: '#8c8c8c' }}>
                    Чтобы присоединиться к существующей организации, попросите администратора отправить вам приглашение на email {user.email}
                  </Paragraph>
                  <Button
                    size="large"
                    icon={<TeamOutlined />}
                    block
                    disabled
                  >
                    Ожидание приглашения
                  </Button>
                </Space>
              </Card>

              <Divider />

              {/* Footer */}
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary">
                  У вас уже есть доступ к организациям?{' '}
                  <a onClick={() => router.push('/organizations')} style={{ color: '#1890ff', cursor: 'pointer' }}>
                    Перейти к списку организаций
                  </a>
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
