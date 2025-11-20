'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { config } from '@/lib/config';
import dynamic from 'next/dynamic';
import {
  Card,
  Descriptions,
  Button,
  Space,
  Tag,
  Typography,
  Spin,
  message,
  Popconfirm,
  Row,
  Col,
  Dropdown,
  Tabs,
  App,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { QuoteService } from '@/lib/api/quote-service';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getAuthToken } from '@/lib/auth/auth-helper';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { WorkflowStatusCard, WorkflowStateBadge } from '@/components/workflow';
import { getWorkflowStatus, type WorkflowStatus } from '@/lib/api/workflow-service';
import FinancialApprovalActions from '@/components/quotes/FinancialApprovalActions';

// Lazy load ag-Grid to reduce initial bundle size (saves ~300KB)
const AgGridReact = dynamic(
  async () => {
    const { AgGridReact } = await import('ag-grid-react');
    const { ModuleRegistry, AllCommunityModule } = await import('ag-grid-community');

    // Register modules when ag-Grid loads
    ModuleRegistry.registerModules([AllCommunityModule]);

    return AgGridReact;
  },
  {
    loading: () => <Spin size="large" tip="Загрузка таблицы..." />,
    ssr: false,
  }
);

const { Title, Text } = Typography;

// TypeScript interfaces matching backend response
interface QuoteItem {
  id: string;
  sku?: string;
  brand?: string;
  product_name: string;
  quantity: number;
  base_price_vat?: number;
  currency?: string;
  weight_in_kg?: number;
  unit_price?: number;
  total_price?: number;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  inn?: string;
  kpp?: string;
  company_name?: string;
}

interface QuoteDetail {
  id: string;
  quote_number: string;
  customer_id?: string;
  customer?: Customer; // Backend returns customer object, not customer_name string
  title?: string;
  status: string;
  workflow_state?: string; // For financial approval workflow
  quote_date?: string;
  valid_until?: string;
  currency?: string;
  total_amount?: number;
  created_at: string;
  items: QuoteItem[];
}

export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [workflow, setWorkflow] = useState<WorkflowStatus | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('details');

  const quoteService = new QuoteService();
  const quoteId = params?.id as string;

  useEffect(() => {
    if (quoteId && profile?.organization_id) {
      fetchQuoteDetails();
    }
  }, [quoteId, profile?.organization_id]);

  useEffect(() => {
    if (quote?.id) {
      loadWorkflowStatus();
    }
  }, [quote?.id]);

  async function loadWorkflowStatus() {
    try {
      setWorkflowLoading(true);
      const status = await getWorkflowStatus(quote!.id);
      setWorkflow(status);
    } catch (error) {
      console.error('Failed to load workflow:', error);
    } finally {
      setWorkflowLoading(false);
    }
  }

  const fetchQuoteDetails = async () => {
    setLoading(true);
    try {
      const organizationId = profile?.organization_id || '';
      if (!organizationId) {
        message.error('Не удалось определить организацию');
        return;
      }

      const response = await quoteService.getQuoteDetails(quoteId, organizationId);
      console.log('[QuoteDetail] API response:', response);

      if (response.success && response.data) {
        // Backend returns quote data at top level with items as property
        const quoteData = response.data as any;
        const items = quoteData.items || [];

        setQuote({
          id: quoteData.id,
          quote_number: quoteData.quote_number,
          customer_id: quoteData.customer_id,
          customer: quoteData.customer, // Store customer object (contains name)
          title: quoteData.title,
          status: quoteData.status,
          quote_date: quoteData.quote_date,
          valid_until: quoteData.valid_until,
          currency: quoteData.currency || 'RUB',
          total_amount: quoteData.total_amount,
          created_at: quoteData.created_at,
          items: items,
        });
      } else {
        message.error(response.error || 'Ошибка загрузки КП');
        router.push('/quotes');
      }
    } catch (error: any) {
      console.error('[QuoteDetail] Error:', error);
      message.error('Ошибка загрузки: ' + error.message);
      router.push('/quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const organizationId = profile?.organization_id || '';
      if (!organizationId) {
        message.error('Не удалось определить организацию');
        return;
      }

      const response = await quoteService.deleteQuote(quoteId, organizationId);
      if (response.success) {
        message.success('КП перемещено в корзину');
        router.push('/quotes');
      } else {
        message.error(response.error || 'Ошибка удаления');
      }
    } catch (error: any) {
      message.error('Ошибка удаления: ' + error.message);
    }
  };

  const handleExport = useCallback(
    async (format: string, type: 'pdf' | 'excel') => {
      // Prevent concurrent exports
      if (exportLoading) {
        message.warning('Экспорт уже выполняется. Пожалуйста, подождите.');
        return;
      }

      // Check if quote has calculation results
      if (!quote?.items || quote.items.length === 0) {
        message.warning('Котировка пустая. Добавьте товары для экспорта.');
        return;
      }

      setExportLoading(true);

      try {
        const token = await getAuthToken();

        const response = await fetch(
          `${config.apiUrl}/api/quotes/${quoteId}/export/${type}?format=${format}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || errorData.detail || 'Export failed');
        }

        // Get filename from Content-Disposition header or generate
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `quote_${quoteId}_${format}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;

        if (contentDisposition) {
          console.log('[Export] Content-Disposition:', contentDisposition);

          // Try filename*= format first (RFC 5987)
          let filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;\n]*)/i);
          if (filenameMatch && filenameMatch[1]) {
            filename = decodeURIComponent(filenameMatch[1]);
          } else {
            // Try standard filename= format (with or without quotes)
            filenameMatch = contentDisposition.match(
              /filename=["']([^"']+)["']|filename=([^;\s]+)/i
            );
            if (filenameMatch) {
              // Group 1 = quoted filename, Group 2 = unquoted filename
              filename = (filenameMatch[1] || filenameMatch[2]).trim();
            }
          }

          console.log('[Export] Extracted filename:', filename);
        }

        // Download file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        message.success('Файл успешно загружен');
      } catch (error: any) {
        console.error('Export error:', error);
        message.error('Ошибка экспорта: ' + (error.message || 'Попробуйте снова'));
      } finally {
        setExportLoading(false);
      }
    },
    [quote?.items, quoteId, exportLoading]
  );

  // Create export menu items (memoized to prevent recreation on state changes)
  // Must be before early returns to satisfy Rules of Hooks
  const exportMenuItems = useMemo(
    () => [
      {
        key: 'pdf-group',
        label: 'PDF Экспорт',
        type: 'group' as const,
        children: [
          {
            key: 'pdf-supply',
            label: 'КП поставка (9 колонок)',
            onClick: () => handleExport('supply', 'pdf'),
          },
          {
            key: 'pdf-openbook',
            label: 'КП open book (21 колонка)',
            onClick: () => handleExport('openbook', 'pdf'),
          },
          {
            key: 'pdf-supply-letter',
            label: 'КП поставка письмо',
            onClick: () => handleExport('supply-letter', 'pdf'),
          },
          {
            key: 'pdf-openbook-letter',
            label: 'КП open book письмо',
            onClick: () => handleExport('openbook-letter', 'pdf'),
          },
        ],
      },
      { type: 'divider' as const },
      {
        key: 'excel-group',
        label: 'Excel Экспорт',
        type: 'group' as const,
        children: [
          {
            key: 'excel-validation',
            label: 'Проверка расчетов',
            onClick: () => handleExport('validation', 'excel'),
          },
          {
            key: 'excel-supply-grid',
            label: 'КП поставка (9 колонок)',
            onClick: () => handleExport('supply-grid', 'excel'),
          },
          {
            key: 'excel-openbook-grid',
            label: 'КП open book (21 колонка)',
            onClick: () => handleExport('openbook-grid', 'excel'),
          },
        ],
      },
    ],
    [handleExport]
  );

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
    };
    const config = statusMap[status as keyof typeof statusMap] || {
      color: 'default',
      text: status,
    };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const formatCurrency = (amount: number | undefined, currency: string = 'RUB') => {
    if (amount === undefined) return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  // ag-Grid column definitions for products table
  const columnDefs: ColDef[] = [
    {
      field: 'product_code',
      headerName: 'Артикул',
      width: 150,
      pinned: 'left',
    },
    {
      field: 'brand',
      headerName: 'Бренд',
      width: 120,
      pinned: 'left',
    },
    {
      field: 'description',
      headerName: 'Наименование',
      width: 300,
      pinned: 'left',
    },
    {
      field: 'quantity',
      headerName: 'Кол-во',
      width: 100,
      type: 'numericColumn',
    },
    {
      field: 'unit',
      headerName: 'Ед. изм.',
      width: 100,
    },
    {
      field: 'final_price',
      headerName: 'Цена продажи',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (params) => (params.value ? Number(params.value).toFixed(2) + ' ₽' : '—'),
      cellStyle: { fontWeight: 'bold', color: '#1890ff' },
    },
    {
      field: 'country_of_origin',
      headerName: 'Страна',
      width: 120,
    },
    {
      field: 'weight_in_kg',
      headerName: 'Вес (кг)',
      width: 110,
      type: 'numericColumn',
      valueFormatter: (params) => (params.value ? Number(params.value).toFixed(2) : '—'),
    },
    {
      field: 'total',
      headerName: 'Сумма',
      width: 150,
      type: 'numericColumn',
      valueGetter: (params) => {
        const finalPrice = params.data?.final_price;
        const quantity = params.data?.quantity;
        return finalPrice && quantity ? Number(finalPrice) * Number(quantity) : null;
      },
      valueFormatter: (params) => (params.value ? Number(params.value).toFixed(2) + ' ₽' : '—'),
      cellStyle: { fontWeight: 'bold', color: '#52c41a' },
    },
  ];

  const defaultColDef: ColDef = {
    resizable: true,
    sortable: true,
    filter: false, // Read-only, no filters needed
  };

  if (loading) {
    return (
      <MainLayout>
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" tip="Загрузка данных..." />
        </div>
      </MainLayout>
    );
  }

  if (!quote) {
    return (
      <MainLayout>
        <Card>
          <Text type="danger">КП не найдено</Text>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <App>
        <Space direction="vertical" size="large" style={{ width: '100%', padding: '24px' }}>
          {/* Section 1: Header with Actions */}
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/quotes')}>
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
                <Dropdown
                  menu={{ items: exportMenuItems }}
                  trigger={['click']}
                  disabled={exportLoading}
                >
                  <Button icon={<DownloadOutlined />} loading={exportLoading}>
                    Экспорт
                  </Button>
                </Dropdown>
                {(quote.status === 'draft' || quote.status === 'revision_needed') && (
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => router.push('/quotes/' + quote.id + '/edit')}
                  >
                    Редактировать
                  </Button>
                )}
                {quote.status === 'draft' && (
                  <Popconfirm
                    title="Удалить КП?"
                    description="КП будет перемещено в корзину"
                    onConfirm={handleDelete}
                    okText="Удалить"
                    cancelText="Отмена"
                    okButtonProps={{ danger: true }}
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      Удалить
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </Col>
          </Row>

          {/* Tabs for Details and Plan-Fact */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'details',
                label: 'Детали',
                children: (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {/* Workflow Section */}
                    {!workflowLoading && workflow && (
                      <Row gutter={[16, 16]}>
                        <Col span={24}>
                          <WorkflowStatusCard workflow={workflow} workflowMode={'simple'} />
                        </Col>
                      </Row>
                    )}

                    {/* Financial Approval Actions */}
                    {quote.workflow_state === 'awaiting_financial_approval' && (
                      <Card>
                        <FinancialApprovalActions
                          quoteId={quote.id}
                          quoteNumber={quote.quote_number}
                          onApprove={() => {
                            fetchQuoteDetails();
                            loadWorkflowStatus();
                          }}
                          onSendBack={() => {
                            fetchQuoteDetails();
                            loadWorkflowStatus();
                          }}
                        />
                      </Card>
                    )}

                    {/* Quote Info Card */}
                    <Card title="Информация о КП" variant="borderless">
                      <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered>
                        <Descriptions.Item label="Клиент">
                          {quote.customer?.name || 'Не указан'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Название КП">
                          {quote.title || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Статус">
                          {getStatusTag(quote.status)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Дата КП">
                          {formatDate(quote.quote_date)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Действительно до">
                          {formatDate(quote.valid_until)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Создано">
                          {formatDate(quote.created_at)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Валюта">
                          {quote.currency || 'RUB'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Общая сумма">
                          <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                            {formatCurrency(quote.total_amount, quote.currency)}
                          </Text>
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>

                    {/* Products Table (ag-Grid, read-only) */}
                    <Card
                      title={'Товары (' + (quote.items?.length || 0) + ' позиций)'}
                      variant="borderless"
                      styles={{ body: { padding: '16px' } }}
                    >
                      {quote.items && quote.items.length > 0 ? (
                        <div className="ag-theme-alpine" style={{ height: 400, width: '100%' }}>
                          <AgGridReact
                            rowData={quote.items}
                            columnDefs={columnDefs}
                            defaultColDef={defaultColDef}
                            animateRows={true}
                            suppressHorizontalScroll={false}
                          />
                        </div>
                      ) : (
                        <Text type="secondary">Нет товаров в этом КП</Text>
                      )}
                    </Card>
                  </Space>
                ),
              },
            ]}
          />
        </Space>
      </App>
    </MainLayout>
  );
}
