'use client'

import React, { useState } from 'react'
import {
  Form,
  Input,
  Button,
  Card,
  Space,
  Typography,
  Row,
  Col,
  message,
} from 'antd'
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import MainLayout from '@/components/layout/MainLayout'
import { organizationService } from '@/lib/api/organization-service'
import { OrganizationCreate } from '@/lib/types/organization'

const { Title, Text } = Typography
const { TextArea } = Input

export default function CreateOrganizationPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    if (name) {
      const slug = organizationService.generateSlug(name)
      form.setFieldValue('slug', slug)
    }
  }

  const handleSubmit = async (values: OrganizationCreate) => {
    setLoading(true)
    try {
      const result = await organizationService.createOrganization(values)

      if (result.success && result.data) {
        message.success('Организация успешно создана')
        router.push('/organizations')
      } else {
        message.error(result.error || 'Ошибка создания организации')
      }
    } catch (error: any) {
      message.error(`Ошибка: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Custom validator for slug format
  const validateSlug = (_: any, value: string) => {
    if (!value) {
      return Promise.reject(new Error('Введите уникальный идентификатор'))
    }

    // Check format: lowercase, alphanumeric + hyphens
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    if (!slugRegex.test(value)) {
      return Promise.reject(
        new Error('Идентификатор может содержать только строчные латинские буквы, цифры и дефисы')
      )
    }

    // Check length
    if (value.length < 3) {
      return Promise.reject(new Error('Минимум 3 символа'))
    }

    if (value.length > 50) {
      return Promise.reject(new Error('Максимум 50 символов'))
    }

    return Promise.resolve()
  }

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => router.push('/organizations')}
              >
                Назад
              </Button>
              <Title level={2} style={{ margin: 0 }}>
                Создать организацию
              </Title>
            </Space>
          </Col>
        </Row>

        {/* Form */}
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              requiredMark="optional"
            >
              <Card title="Информация об организации">
                <Row gutter={16}>
                  <Col xs={24}>
                    <Form.Item
                      name="name"
                      label="Название организации"
                      rules={[
                        { required: true, message: 'Введите название организации' },
                        { min: 3, message: 'Минимум 3 символа' },
                        { max: 100, message: 'Максимум 100 символов' },
                      ]}
                    >
                      <Input
                        size="large"
                        placeholder='ООО "Название компании"'
                        onChange={handleNameChange}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24}>
                    <Form.Item
                      name="slug"
                      label="Уникальный идентификатор"
                      rules={[{ validator: validateSlug }]}
                      tooltip="Используется в URL. Автоматически генерируется из названия, но вы можете изменить его."
                      extra={
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          Строчные латинские буквы, цифры и дефисы. Например: moya-kompaniya
                        </Text>
                      }
                    >
                      <Input
                        size="large"
                        placeholder="moya-kompaniya"
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24}>
                    <Form.Item
                      name="description"
                      label="Описание"
                      rules={[
                        { max: 500, message: 'Максимум 500 символов' },
                      ]}
                    >
                      <TextArea
                        rows={4}
                        placeholder="Краткое описание организации (необязательно)"
                        maxLength={500}
                        showCount
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              {/* Actions */}
              <Card style={{ marginTop: 24 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    size="large"
                    block
                    loading={loading}
                  >
                    Создать организацию
                  </Button>
                  <Button
                    size="large"
                    block
                    onClick={() => router.push('/organizations')}
                  >
                    Отмена
                  </Button>
                </Space>
              </Card>
            </Form>
          </Col>

          {/* Info Sidebar */}
          <Col xs={24} lg={8}>
            <Card title="Справка">
              <Space direction="vertical" size="middle">
                <div>
                  <Text strong>Название организации</Text>
                  <br />
                  <Text type="secondary">
                    Полное название вашей организации или компании
                  </Text>
                </div>

                <div>
                  <Text strong>Уникальный идентификатор</Text>
                  <br />
                  <Text type="secondary">
                    Используется для создания уникального URL организации.
                    Автоматически генерируется из названия.
                  </Text>
                </div>

                <div>
                  <Text strong>Описание</Text>
                  <br />
                  <Text type="secondary">
                    Необязательное поле. Краткое описание вашей организации.
                  </Text>
                </div>
              </Space>
            </Card>

            <Card title="Что дальше?" style={{ marginTop: 24 }}>
              <Space direction="vertical" size="small">
                <Text>После создания организации вы сможете:</Text>
                <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
                  <li><Text type="secondary">Пригласить участников команды</Text></li>
                  <li><Text type="secondary">Настроить роли и права доступа</Text></li>
                  <li><Text type="secondary">Управлять настройками организации</Text></li>
                  <li><Text type="secondary">Создавать коммерческие предложения</Text></li>
                </ul>
              </Space>
            </Card>
          </Col>
        </Row>
      </Space>
    </MainLayout>
  )
}
