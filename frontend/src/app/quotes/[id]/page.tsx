'use client';

import React, { useState, useEffect } from 'react';
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
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { QuoteService } from '@/lib/api/quote-service';
import { useAuth } from '@/lib/auth/AuthProvider';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

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

interface QuoteDetail {
  id: string;
  quote_number: string;
  customer_id?: string;
  customer_name?: string;
  title?: string;
  status: string;
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

  const quoteService = new QuoteService();
  const quoteId = params?.id as string;

  useEffect(() => {
    if (quoteId && profile?.organization_id) {
      fetchQuoteDetails();
    }
  }, [quoteId, profile?.organization_id]);

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
        // Transform the response to match our interface
        const quoteData = response.data.quote as any;
        const items = response.data.items || [];

        setQuote({
          id: quoteData.id,
          quote_number: quoteData.quote_number,
          customer_id: quoteData.customer_id,
          customer_name: quoteData.customer_name,
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
      field: 'sku',
      headerName: 'Артикул',
      width: 120,
      pinned: 'left',
    },
    {
      field: 'brand',
      headerName: 'Бренд',
      width: 120,
      pinned: 'left',
    },
    {
      field: 'product_name',
      headerName: 'Наименование',
      width: 250,
      pinned: 'left',
    },
    {
      field: 'quantity',
      headerName: 'Кол-во',
      width: 100,
      type: 'numericColumn',
    },
    {
      field: 'base_price_vat',
      headerName: 'Цена с НДС',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (params) => (params.value ? params.value.toFixed(2) : '—'),
    },
    {
      field: 'currency',
      headerName: 'Валюта',
      width: 100,
    },
    {
      field: 'weight_in_kg',
      headerName: 'Вес (кг)',
      width: 110,
      type: 'numericColumn',
      valueFormatter: (params) => (params.value ? params.value.toFixed(2) : '—'),
    },
    {
      field: 'unit_price',
      headerName: 'Цена за ед.',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (params) => (params.value ? params.value.toFixed(2) : '—'),
    },
    {
      field: 'total_price',
      headerName: 'Сумма',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (params) => (params.value ? params.value.toFixed(2) : '—'),
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
              <Button icon={<FilePdfOutlined />} disabled>
                Экспорт PDF
              </Button>
              {(quote.status === 'draft' || quote.status === 'revision_needed') && (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => router.push('/quotes/' + quote.id + '?mode=edit')}
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

        {/* Section 2: Quote Info Card */}
        <Card title="Информация о КП" bordered={false}>
          <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered>
            <Descriptions.Item label="Клиент">{quote.customer_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Название КП">{quote.title || '—'}</Descriptions.Item>
            <Descriptions.Item label="Статус">{getStatusTag(quote.status)}</Descriptions.Item>
            <Descriptions.Item label="Дата КП">{formatDate(quote.quote_date)}</Descriptions.Item>
            <Descriptions.Item label="Действительно до">
              {formatDate(quote.valid_until)}
            </Descriptions.Item>
            <Descriptions.Item label="Создано">{formatDate(quote.created_at)}</Descriptions.Item>
            <Descriptions.Item label="Валюта">{quote.currency || 'RUB'}</Descriptions.Item>
            <Descriptions.Item label="Общая сумма">
              <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                {formatCurrency(quote.total_amount, quote.currency)}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Section 3: Products Table (ag-Grid, read-only) */}
        <Card
          title={'Товары (' + (quote.items?.length || 0) + ' позиций)'}
          bordered={false}
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
    </MainLayout>
  );
}
