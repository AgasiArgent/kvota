'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Button,
  Space,
  Typography,
  Row,
  Col,
  message,
  Spin,
  Descriptions,
  Table,
  Tag,
  Divider,
  Steps,
  Modal,
  Input,
  Popconfirm,
  Timeline,
  Avatar,
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  DownloadOutlined,
  SendOutlined,
  UserOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import MainLayout from '@/components/layout/MainLayout'
import { QuoteService } from '@/lib/api/quote-service'
import { useAuth } from '@/lib/auth/AuthProvider'

const { Title, Text } = Typography
const { TextArea } = Input

interface QuoteItem {
  id: string
  description: string
  product_code?: string
  quantity: number
  unit: string
  unit_price: number
  line_total: number
  discount_rate?: number
  vat_rate?: number
}

interface QuoteApproval {
  id: string
  approver_id: string
  approver_name?: string
  approval_status: string
  approval_order: number
  decision_notes?: string
  revision_notes?: string
  assigned_at: string
  decided_at?: string
}

interface Quote {
  id: string
  quote_number: string
  customer_id: string
  customer_name: string
  customer_email?: string
  title: string
  description?: string
  status: string
  currency: string
  subtotal: number
  discount_amount: number
  vat_amount: number
  import_duty_amount?: number
  credit_amount?: number
  total_amount: number
  quote_date: string
  valid_until?: string
  payment_terms: number
  notes?: string
  internal_notes?: string
  created_at: string
  updated_at: string
  items?: QuoteItem[]
  approvals?: QuoteApproval[]
}

export default function QuoteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { user, profile } = useAuth()
  const quoteId = params.id as string

  const [loading, setLoading] = useState(true)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [approvalModalVisible, setApprovalModalVisible] = useState(false)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve')
  const [approvalNotes, setApprovalNotes] = useState('')

  const quoteService = new QuoteService()

  useEffect(() => {
    fetchQuote()
  }, [quoteId])

  const fetchQuote = async () => {
    setLoading(true)
    try {
      const data = await quoteService.getById(quoteId)
      setQuote(data)
    } catch (error: any) {
      message.error(`Ошибка загрузки КП: ${error.message}`)
      router.push('/quotes')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await quoteService.delete(quoteId)
      message.success('КП успешно удалено')
      router.push('/quotes')
    } catch (error: any) {
      message.error(`Ошибка удаления: ${error.message}`)
    }
  }

  const handleApproval = async () => {
    try {
      // This would call the backend approval endpoint
      // await quoteService.approveQuote(quoteId, approvalAction, approvalNotes)
      message.success(
        approvalAction === 'approve' ? 'КП утверждено' : 'КП отклонено'
      )
      setApprovalModalVisible(false)
      setApprovalNotes('')
      fetchQuote()
    } catch (error: any) {
      message.error(`Ошибка: ${error.message}`)
    }
  }

  const getStatusTag = (status: string) => {
    const statusMap = {
      draft: { color: 'default', text: 'Черновик' },
      pending_approval: { color: 'orange', text: 'На утверждении' },
      partially_approved: { color: 'gold', text: 'Частично утверждено' },
      approved: { color: 'green', text: 'Утверждено' },
      revision_needed: { color: 'purple', text: 'Требуется доработка' },
      rejected_internal: { color: 'red', text: 'Отклонено (внутр.)' },
      ready_to_send: { color: 'cyan', text: 'Готово к отправке' },
      sent: { color: 'blue', text: 'Отправлено' },
      viewed: { color: 'geekblue', text: 'Просмотрено' },
      accepted: { color: 'green', text: 'Принято' },
      rejected: { color: 'red', text: 'Отклонено' },
      expired: { color: 'default', text: 'Истекло' },
      cancelled: { color: 'default', text: 'Отменено' },
    }
    const config = statusMap[status as keyof typeof statusMap] || {
      color: 'default',
      text: status,
    }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  const getApprovalStatusTag = (status: string) => {
    const statusMap = {
      pending: { color: 'orange', text: 'Ожидает', icon: <ClockCircleOutlined /> },
      approved: { color: 'green', text: 'Утверждено', icon: <CheckOutlined /> },
      rejected: { color: 'red', text: 'Отклонено', icon: <CloseOutlined /> },
      skipped: { color: 'default', text: 'Пропущено' },
    }
    const config = statusMap[status as keyof typeof statusMap] || {
      color: 'default',
      text: status,
    }
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: quote?.currency || 'RUB',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const itemColumns = [
    {
      title: '№',
      key: 'index',
      width: 50,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Наименование',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string, record: QuoteItem) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          {record.product_code && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Артикул: {record.product_code}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Количество',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right' as const,
      render: (qty: number, record: QuoteItem) => `${qty} ${record.unit}`,
    },
    {
      title: 'Цена за ед.',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 120,
      align: 'right' as const,
      render: (price: number) => formatCurrency(price),
    },
    {
      title: 'Сумма',
      dataIndex: 'line_total',
      key: 'line_total',
      width: 150,
      align: 'right' as const,
      render: (total: number) => <Text strong>{formatCurrency(total)}</Text>,
    },
  ]

  // Check if current user can approve
  const userApproval = quote?.approvals?.find(
    (a) => a.approver_id === user?.id && a.approval_status === 'pending'
  )

  if (loading) {
    return (
      <MainLayout>
        <div style={{ textAlign: 'center', padding: '100px' }}>
          <Spin size="large" />
        </div>
      </MainLayout>
    )
  }

  if (!quote) return null

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => router.push('/quotes')}
              >
                Назад
              </Button>
              <Title level={2} style={{ margin: 0 }}>
                {quote.quote_number}
              </Title>
              {getStatusTag(quote.status)}
            </Space>
          </Col>
          <Col>
            <Space>
              {userApproval && (
                <>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => {
                      setApprovalAction('approve')
                      setApprovalModalVisible(true)
                    }}
                  >
                    Утвердить
                  </Button>
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => {
                      setApprovalAction('reject')
                      setApprovalModalVisible(true)
                    }}
                  >
                    Отклонить
                  </Button>
                </>
              )}
              {quote.status === 'approved' && (
                <>
                  <Button icon={<DownloadOutlined />}>Скачать PDF</Button>
                  <Button type="primary" icon={<SendOutlined />}>
                    Отправить клиенту
                  </Button>
                </>
              )}
              {(quote.status === 'draft' || quote.status === 'revision_needed') && (
                <>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => router.push(`/quotes/${quoteId}/edit`)}
                  >
                    Редактировать
                  </Button>
                  <Popconfirm
                    title="Удалить КП?"
                    description="Это действие нельзя отменить"
                    onConfirm={handleDelete}
                    okText="Удалить"
                    cancelText="Отмена"
                    okButtonProps={{ danger: true }}
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      Удалить
                    </Button>
                  </Popconfirm>
                </>
              )}
            </Space>
          </Col>
        </Row>

        <Row gutter={24}>
          {/* Main Content */}
          <Col xs={24} lg={16}>
            {/* Basic Info */}
            <Card title="Информация о КП">
              <Descriptions column={2} bordered>
                <Descriptions.Item label="Номер КП">
                  {quote.quote_number}
                </Descriptions.Item>
                <Descriptions.Item label="Статус">
                  {getStatusTag(quote.status)}
                </Descriptions.Item>
                <Descriptions.Item label="Клиент">
                  <a onClick={() => router.push(`/customers/${quote.customer_id}`)}>
                    {quote.customer_name}
                  </a>
                </Descriptions.Item>
                <Descriptions.Item label="Email клиента">
                  {quote.customer_email || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Название" span={2}>
                  {quote.title}
                </Descriptions.Item>
                {quote.description && (
                  <Descriptions.Item label="Описание" span={2}>
                    {quote.description}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Дата КП">
                  {new Date(quote.quote_date).toLocaleDateString('ru-RU')}
                </Descriptions.Item>
                <Descriptions.Item label="Действительно до">
                  {quote.valid_until
                    ? new Date(quote.valid_until).toLocaleDateString('ru-RU')
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Условия оплаты">
                  {quote.payment_terms} дней
                </Descriptions.Item>
                <Descriptions.Item label="Валюта">
                  {quote.currency}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Items */}
            <Card title="Позиции" style={{ marginTop: 24 }}>
              <Table
                columns={itemColumns}
                dataSource={quote.items || []}
                rowKey="id"
                pagination={false}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={4} align="right">
                        <Text strong>Подытог:</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <Text strong>{formatCurrency(quote.subtotal)}</Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            </Card>

            {/* Financial Breakdown */}
            <Card title="Финансовая разбивка" style={{ marginTop: 24 }}>
              <Descriptions column={1} bordered>
                <Descriptions.Item label="Подытог">
                  {formatCurrency(quote.subtotal)}
                </Descriptions.Item>
                {quote.discount_amount > 0 && (
                  <Descriptions.Item label="Скидка">
                    <Text type="danger">
                      -{formatCurrency(quote.discount_amount)}
                    </Text>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="НДС (20%)">
                  {formatCurrency(quote.vat_amount)}
                </Descriptions.Item>
                {quote.import_duty_amount && quote.import_duty_amount > 0 && (
                  <Descriptions.Item label="Импортная пошлина">
                    {formatCurrency(quote.import_duty_amount)}
                  </Descriptions.Item>
                )}
                {quote.credit_amount && quote.credit_amount > 0 && (
                  <Descriptions.Item label="Стоимость кредита">
                    {formatCurrency(quote.credit_amount)}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label={<Text strong>Итого</Text>}>
                  <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                    {formatCurrency(quote.total_amount)}
                  </Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Notes */}
            {(quote.notes || quote.internal_notes) && (
              <Card title="Примечания" style={{ marginTop: 24 }}>
                {quote.notes && (
                  <>
                    <Text strong>Примечания для клиента:</Text>
                    <p>{quote.notes}</p>
                  </>
                )}
                {quote.internal_notes && (
                  <>
                    <Divider />
                    <Text strong type="secondary">
                      Внутренние примечания:
                    </Text>
                    <p style={{ color: '#888' }}>{quote.internal_notes}</p>
                  </>
                )}
              </Card>
            )}
          </Col>

          {/* Sidebar */}
          <Col xs={24} lg={8}>
            {/* Approval Workflow */}
            {quote.approvals && quote.approvals.length > 0 && (
              <Card title="Процесс утверждения">
                <Steps
                  direction="vertical"
                  current={quote.approvals.filter((a) => a.approval_status === 'approved').length}
                  items={quote.approvals
                    .sort((a, b) => a.approval_order - b.approval_order)
                    .map((approval) => ({
                      title: approval.approver_name || `Утверждающий #${approval.approval_order}`,
                      description: (
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          {getApprovalStatusTag(approval.approval_status)}
                          {approval.decided_at && (
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              {new Date(approval.decided_at).toLocaleDateString('ru-RU')}
                            </Text>
                          )}
                          {approval.decision_notes && (
                            <Text style={{ fontSize: '12px' }}>
                              {approval.decision_notes}
                            </Text>
                          )}
                          {approval.revision_notes && (
                            <Text type="warning" style={{ fontSize: '12px' }}>
                              Доработка: {approval.revision_notes}
                            </Text>
                          )}
                        </Space>
                      ),
                      status:
                        approval.approval_status === 'approved'
                          ? 'finish'
                          : approval.approval_status === 'rejected'
                          ? 'error'
                          : 'wait',
                    }))}
                />
              </Card>
            )}

            {/* Activity Timeline */}
            <Card title="История изменений" style={{ marginTop: 24 }}>
              <Timeline
                items={[
                  {
                    children: (
                      <Space direction="vertical" size={0}>
                        <Text strong>КП создано</Text>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {new Date(quote.created_at).toLocaleString('ru-RU')}
                        </Text>
                      </Space>
                    ),
                  },
                  ...(quote.approvals?.map((approval) => ({
                    color: approval.approval_status === 'approved' ? 'green' : approval.approval_status === 'rejected' ? 'red' : 'blue',
                    children: (
                      <Space direction="vertical" size={0}>
                        <Text strong>
                          {approval.approval_status === 'approved'
                            ? 'Утверждено'
                            : approval.approval_status === 'rejected'
                            ? 'Отклонено'
                            : 'Назначен утверждающий'}
                        </Text>
                        <Text type="secondary">{approval.approver_name}</Text>
                        {approval.decided_at && (
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {new Date(approval.decided_at).toLocaleString('ru-RU')}
                          </Text>
                        )}
                      </Space>
                    ),
                  })) || []),
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Space>

      {/* Approval Modal */}
      <Modal
        title={approvalAction === 'approve' ? 'Утвердить КП' : 'Отклонить КП'}
        open={approvalModalVisible}
        onOk={handleApproval}
        onCancel={() => {
          setApprovalModalVisible(false)
          setApprovalNotes('')
        }}
        okText={approvalAction === 'approve' ? 'Утвердить' : 'Отклонить'}
        cancelText="Отмена"
        okButtonProps={{
          danger: approvalAction === 'reject',
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>
            {approvalAction === 'approve'
              ? 'Вы уверены, что хотите утвердить это КП?'
              : 'Укажите причину отклонения:'}
          </Text>
          <TextArea
            rows={4}
            placeholder={
              approvalAction === 'approve'
                ? 'Комментарий (необязательно)'
                : 'Причина отклонения'
            }
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
          />
        </Space>
      </Modal>
    </MainLayout>
  )
}
