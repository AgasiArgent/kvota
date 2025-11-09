'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Form,
  DatePicker,
  Select,
  Button,
  Switch,
  Space,
  message,
  Spin,
  Typography,
  Statistic,
  Divider,
  Checkbox,
  Transfer,
  Input,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  SaveOutlined,
  BarChartOutlined,
  TableOutlined,
  PlusOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import dayjs from 'dayjs';

// Register AG Grid modules
if (typeof window !== 'undefined') {
  ModuleRegistry.registerModules([AllCommunityModule]);
}

import {
  executeQuery,
  executeAggregate,
  exportData,
  createSavedReport,
  type AnalyticsQueryRequest,
  type AnalyticsFilter,
  type Aggregation,
} from '@/lib/api/analytics-service';
import MainLayout from '@/components/layout/MainLayout';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Available fields grouped by category
const AVAILABLE_FIELDS = {
  'Основная информация': [
    { key: 'quote_number', label: 'Номер КП' },
    { key: 'created_at', label: 'Дата создания' },
    { key: 'quote_date', label: 'Дата КП' },
    { key: 'status', label: 'Статус' },
    { key: 'offer_sale_type', label: 'Тип продажи' },
    { key: 'seller_company', label: 'Компания-продавец' },
  ],
  'Финансовые показатели': [
    { key: 'total_amount', label: 'Общая сумма' },
  ],
  'Расчетные показатели (детально)': [
    // Phase 1-2: Purchase prices
    { key: 'calc_s16_total_purchase_price', label: 'Цена закупки (итого)' },
    // Phase 3: Logistics
    { key: 'calc_v16_total_logistics', label: 'Логистика (итого)' },
    // Phase 4: Duties
    { key: 'calc_y16_customs_duty', label: 'Таможенная пошлина' },
    { key: 'calc_z16_excise_tax', label: 'Акциз' },
    // Phase 10: COGS
    { key: 'calc_ab16_cogs_total', label: 'Себестоимость (итого)' },
    // Phase 11: Sales pricing
    { key: 'calc_af16_profit_margin', label: 'Маржа прибыли %' },
    { key: 'calc_ag16_dm_fee', label: 'Вознаграждение ЛПР' },
    { key: 'calc_ak16_final_price_total', label: 'Финальная цена (итого)' },
    // Phase 12: VAT
    { key: 'calc_an16_sales_vat', label: 'НДС к уплате' },
    { key: 'calc_ao16_deductible_vat', label: 'НДС к вычету' },
    { key: 'calc_ap16_net_vat_payable', label: 'НДС (чистый)' },
  ],
};

// Status options
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'pending_approval', label: 'На утверждении' },
  { value: 'approved', label: 'Утверждено' },
  { value: 'rejected', label: 'Отклонено' },
  { value: 'sent', label: 'Отправлено' },
  { value: 'accepted', label: 'Принято' },
  { value: 'declined', label: 'Отказано' },
];

// Sale type options
const SALE_TYPE_OPTIONS = [
  { value: 'поставка', label: 'Поставка' },
  { value: 'транзит', label: 'Транзит' },
  { value: 'финтранзит', label: 'Финтранзит' },
];

// Seller company options
const SELLER_COMPANY_OPTIONS = [
  { value: 'МАСТЕР БЭРИНГ ООО', label: 'МАСТЕР БЭРИНГ ООО (Россия)' },
  {
    value: 'TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ',
    label: 'TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ (Турция)',
  },
  { value: 'UPDOOR Limited', label: 'UPDOOR Limited (Китай)' },
];

// Aggregation functions
const AGG_FUNCTIONS = [
  { value: 'sum', label: 'Сумма' },
  { value: 'avg', label: 'Среднее' },
  { value: 'count', label: 'Количество' },
  { value: 'min', label: 'Минимум' },
  { value: 'max', label: 'Максимум' },
];

export default function AnalyticsPage() {
  const [form] = Form.useForm();
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // View mode: standard (rows) or lightweight (aggregations only)
  const [viewMode, setViewMode] = useState<'standard' | 'lightweight'>('standard');

  // Selected fields for display
  const [selectedFields, setSelectedFields] = useState<string[]>([
    'quote_number',
    'status',
    'total_amount',
  ]);

  // Aggregations
  const [aggregations, setAggregations] = useState<
    Array<{ id: string; field: string; function: string; label: string }>
  >([]);

  // Results
  const [queryResults, setQueryResults] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [aggregationResults, setAggregationResults] = useState<Record<string, any>>({});
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  // Filters collapsed state
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  // Flag to trigger auto-execution of saved report
  const [shouldExecuteReport, setShouldExecuteReport] = useState(false);

  // Simulate initial page load
  useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Load saved report from localStorage (when redirected from saved reports page)
  useEffect(() => {
    const storedReport = localStorage.getItem('analytics_load_report');
    if (!storedReport) return;

    try {
      const report = JSON.parse(storedReport);

      // Load filters into form
      if (report.query_config?.filters) {
        form.setFieldsValue(report.query_config.filters);
      }

      // Load selected fields
      if (report.query_config?.selected_fields) {
        setSelectedFields(report.query_config.selected_fields);
      }

      // Clear localStorage
      localStorage.removeItem('analytics_load_report');

      // Set flag to trigger execution in separate effect
      setShouldExecuteReport(true);
    } catch (error) {
      console.error('Failed to load saved report:', error);
      localStorage.removeItem('analytics_load_report');
    }
  }, [form]);

  // All available fields (flat list for Transfer component)
  const allFields = useMemo(() => {
    const fields: Array<{ key: string; label: string }> = [];
    Object.values(AVAILABLE_FIELDS).forEach((group) => {
      fields.push(...group);
    });
    return fields;
  }, []);

  // Build filters from form values
  const buildFilters = useCallback((values: any): AnalyticsFilter => {
    const filters: AnalyticsFilter = {};

    // Filter by created_at range
    if (values.created_date_range) {
      filters.created_at_from = values.created_date_range[0]?.format('YYYY-MM-DD');
      filters.created_at_to = values.created_date_range[1]?.format('YYYY-MM-DD');
    }

    // Filter by quote_date range
    if (values.sent_date_range) {
      filters.quote_date_from = values.sent_date_range[0]?.format('YYYY-MM-DD');
      filters.quote_date_to = values.sent_date_range[1]?.format('YYYY-MM-DD');
    }

    if (values.status && values.status.length > 0) {
      filters.status = values.status;
    }

    if (values.offer_sale_type) {
      filters.offer_sale_type = values.offer_sale_type;
    }

    if (values.seller_company) {
      filters.seller_company = values.seller_company;
    }

    return filters;
  }, []);

  // Build aggregations object
  const buildAggregationsObject = useCallback((): Record<string, Aggregation> | undefined => {
    if (aggregations.length === 0) return undefined;

    const aggObj: Record<string, Aggregation> = {};
    aggregations.forEach((agg) => {
      aggObj[agg.id] = {
        function: agg.function as any,
        field: agg.field,
        label: agg.label,
      };
    });
    return aggObj;
  }, [aggregations]);

  // Execute query
  const handleExecuteQuery = useCallback(async () => {
    try {
      setLoading(true);
      const values = form.getFieldsValue();
      const filters = buildFilters(values);

      if (selectedFields.length === 0) {
        message.warning('Выберите хотя бы одно поле для отображения');
        return;
      }

      // Validate aggregations - text fields can only use COUNT
      const textFields = ['quote_number', 'status', 'offer_sale_type', 'seller_company'];
      const numericFunctions = ['sum', 'avg', 'min', 'max'];

      for (const agg of aggregations) {
        if (textFields.includes(agg.field) && numericFunctions.includes(agg.function)) {
          message.error(
            `Поле "${agg.field}" является текстовым. Используйте функцию "Количество" вместо "${agg.function}"`
          );
          return;
        }
      }

      if (viewMode === 'lightweight') {
        // Lightweight mode: aggregations only
        console.log('[DEBUG] Lightweight mode activated');
        let aggObj = buildAggregationsObject();
        console.log('[DEBUG] Custom aggregations:', aggObj);

        // If no custom aggregations, use default ones
        if (!aggObj || Object.keys(aggObj).length === 0) {
          aggObj = {
            sum_total_amount: {
              function: 'sum',
              field: 'total_amount',
              label: 'Общая выручка',
            },
            quote_count: {
              function: 'count',
              label: 'Количество КП',
            },
          };
          console.log('[DEBUG] Using default aggregations:', aggObj);
        }

        console.log('[DEBUG] Calling executeAggregate with filters:', filters, 'aggObj:', aggObj);
        const result = await executeAggregate(filters, aggObj);
        console.log('[DEBUG] executeAggregate result:', result);
        setAggregationResults(result.aggregations);
        setExecutionTime(result.execution_time_ms);
        message.success('Агрегация выполнена успешно');
      } else {
        // Standard mode: full rows
        const request: AnalyticsQueryRequest = {
          filters,
          selected_fields: selectedFields,
          aggregations: buildAggregationsObject(),
          limit: 1000,
          offset: 0,
        };

        const result = await executeQuery(request);
        setQueryResults(result.rows);
        setTotalCount(result.total_count || result.count);
        message.success(`Найдено записей: ${result.count}`);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка выполнения запроса');
    } finally {
      setLoading(false);
    }
  }, [form, buildFilters, selectedFields, viewMode, buildAggregationsObject]);

  // Auto-execute saved report query after state loaded
  useEffect(() => {
    if (shouldExecuteReport && !loading && !pageLoading) {
      setShouldExecuteReport(false);
      handleExecuteQuery();
    }
  }, [shouldExecuteReport, loading, pageLoading, handleExecuteQuery]);

  // Export to Excel/CSV
  const handleExport = useCallback(
    async (format: 'xlsx' | 'csv') => {
      try {
        setExportLoading(true);
        const values = form.getFieldsValue();
        const filters = buildFilters(values);

        const request: AnalyticsQueryRequest = {
          filters,
          selected_fields: selectedFields,
          aggregations: buildAggregationsObject(),
          limit: 10000, // Export more rows
          offset: 0,
        };

        const result = await exportData(request, format);

        // Download file
        const link = document.createElement('a');
        link.href = result.file_url;
        link.download = result.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        message.success(`Экспорт в ${format.toUpperCase()} завершён`);
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Ошибка экспорта');
      } finally {
        setExportLoading(false);
      }
    },
    [form, buildFilters, selectedFields, buildAggregationsObject]
  );

  // Save as template
  const handleSaveTemplate = useCallback(async () => {
    try {
      const values = form.getFieldsValue();
      const filters = buildFilters(values);

      // Prompt for name
      const name = prompt('Введите название отчёта:');
      if (!name) return;

      await createSavedReport({
        name,
        filters,
        selected_fields: selectedFields,
        aggregations: buildAggregationsObject(),
        visibility: 'personal',
      });

      message.success('Отчёт сохранён');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка сохранения');
    }
  }, [form, buildFilters, selectedFields, buildAggregationsObject]);

  // Generate auto label for aggregation
  const generateAggregationLabel = (field: string, func: string): string => {
    const fieldLabels: Record<string, string> = {
      // Legacy fields
      total_amount: 'общая сумма',
      // New calculated fields
      calc_s16_total_purchase_price: 'цена закупки',
      calc_v16_total_logistics: 'логистика',
      calc_y16_customs_duty: 'таможенная пошлина',
      calc_z16_excise_tax: 'акциз',
      calc_ab16_cogs_total: 'себестоимость',
      calc_af16_profit_margin: 'маржа прибыли',
      calc_ag16_dm_fee: 'вознаграждение ЛПР',
      calc_ak16_final_price_total: 'финальная цена',
      calc_an16_sales_vat: 'НДС продажи',
      calc_ao16_deductible_vat: 'НДС к вычету',
      calc_ap16_net_vat_payable: 'НДС (чистый)',
    };

    const funcLabels: Record<string, string> = {
      sum: 'Сумма',
      avg: 'Среднее',
      count: 'Количество',
      min: 'Минимум',
      max: 'Максимум',
    };

    const fieldLabel = fieldLabels[field] || field;
    const funcLabel = funcLabels[func] || func;

    return `${funcLabel} ${fieldLabel}`;
  };

  // Add aggregation
  const handleAddAggregation = useCallback(() => {
    setAggregations((prev) => [
      ...prev,
      {
        id: `agg_${Date.now()}`,
        field: 'total_amount',
        function: 'sum',
        label: generateAggregationLabel('total_amount', 'sum'),
      },
    ]);
  }, []);

  // Remove aggregation
  const handleRemoveAggregation = useCallback((id: string) => {
    setAggregations((prev) => prev.filter((agg) => agg.id !== id));
  }, []);

  // Update aggregation
  const handleUpdateAggregation = useCallback((id: string, field: string, value: any) => {
    setAggregations((prev) =>
      prev.map((agg) => {
        if (agg.id !== id) return agg;

        const updated = { ...agg, [field]: value };

        // Auto-generate label if field or function changed and label is default/empty
        if (
          (field === 'field' || field === 'function') &&
          (agg.label === '' ||
            agg.label.startsWith('Новая агрегация') ||
            agg.label.match(/^(Сумма|Среднее|Количество|Минимум|Максимум)/))
        ) {
          const fieldValue = field === 'field' ? value : agg.field;
          const funcValue = field === 'function' ? value : agg.function;
          updated.label = generateAggregationLabel(fieldValue, funcValue);
        }

        return updated;
      })
    );
  }, []);

  // Column definitions for ag-Grid
  const columnDefs = useMemo<ColDef[]>(() => {
    return selectedFields.map((field) => {
      const fieldInfo = allFields.find((f) => f.key === field);
      return {
        field,
        headerName: fieldInfo?.label || field,
        sortable: true,
        filter: true,
        resizable: true,
      };
    });
  }, [selectedFields, allFields]);

  if (pageLoading) {
    return (
      <MainLayout>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '80vh',
          }}
        >
          <Spin size="large" tip="Загрузка аналитики..." />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Title level={2} style={{ margin: 0 }}>
                  <BarChartOutlined /> Финансовая аналитика
                </Title>
                <Text type="secondary">
                  Запросы, анализ и экспорт данных коммерческих предложений
                </Text>
              </div>
              <Space>
                <span>Режим отображения:</span>
                <Tooltip
                  title={
                    viewMode === 'standard'
                      ? 'Стандартный режим: таблица с отдельными котировками'
                      : 'Облегчённый режим: только итоговые суммы (быстрее для больших отчётов)'
                  }
                >
                  <Switch
                    checkedChildren={<TableOutlined />}
                    unCheckedChildren={<BarChartOutlined />}
                    checked={viewMode === 'standard'}
                    onChange={(checked) => setViewMode(checked ? 'standard' : 'lightweight')}
                  />
                </Tooltip>
              </Space>
            </div>
          </Card>
        </Col>

        {/* Filters Panel */}
        <Col span={24}>
          <Card
            title="Фильтры"
            extra={
              <Button
                type="text"
                icon={filtersCollapsed ? <PlusOutlined /> : <MinusOutlined />}
                onClick={() => setFiltersCollapsed(!filtersCollapsed)}
              >
                {filtersCollapsed ? 'Развернуть' : 'Свернуть'}
              </Button>
            }
          >
            {!filtersCollapsed && (
              <Form form={form} layout="vertical">
                <Row gutter={[16, 8]}>
                  <Col xs={24} md={12} lg={6}>
                    <Form.Item label="Период (по дате создания)" name="created_date_range">
                      <RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12} lg={6}>
                    <Form.Item label="Период (по дате отправки)" name="sent_date_range">
                      <RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12} lg={6}>
                    <Form.Item label="Статус" name="status">
                      <Select
                        mode="multiple"
                        placeholder="Все статусы"
                        options={STATUS_OPTIONS}
                        allowClear
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12} lg={6}>
                    <Form.Item label="Тип продажи" name="offer_sale_type">
                      <Select placeholder="Все типы" options={SALE_TYPE_OPTIONS} allowClear />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12} lg={6}>
                    <Form.Item label="Компания-продавец" name="seller_company">
                      <Select
                        placeholder="Все компании"
                        options={SELLER_COMPANY_OPTIONS}
                        allowClear
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            )}
          </Card>
        </Col>

        {/* Field Selection */}
        <Col span={24}>
          <Card title="Выбор полей">
            <Checkbox.Group
              value={selectedFields}
              onChange={(values) => setSelectedFields(values as string[])}
              style={{ width: '100%' }}
            >
              <Row gutter={[16, 8]}>
                {Object.entries(AVAILABLE_FIELDS).map(([category, fields]) => (
                  <Col span={24} key={category}>
                    <Text strong>{category}</Text>
                    <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                      {fields.map((field) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={field.key}>
                          <Checkbox value={field.key}>{field.label}</Checkbox>
                        </Col>
                      ))}
                    </Row>
                    <Divider />
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Card>
        </Col>

        {/* Aggregations */}
        <Col span={24}>
          <Card
            title="Агрегации"
            extra={
              <Button icon={<PlusOutlined />} onClick={handleAddAggregation} size="small">
                Добавить
              </Button>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {aggregations.map((agg) => (
                <Row key={agg.id} gutter={8} align="middle">
                  <Col span={6}>
                    <Select
                      value={agg.field}
                      onChange={(value) => handleUpdateAggregation(agg.id, 'field', value)}
                      placeholder="Поле"
                      style={{ width: '100%' }}
                      options={allFields.map((f) => ({ value: f.key, label: f.label }))}
                    />
                  </Col>
                  <Col span={6}>
                    <Select
                      value={agg.function}
                      onChange={(value) => handleUpdateAggregation(agg.id, 'function', value)}
                      placeholder="Функция"
                      style={{ width: '100%' }}
                      options={AGG_FUNCTIONS}
                    />
                  </Col>
                  <Col span={10}>
                    <Input
                      value={agg.label}
                      onChange={(e) => handleUpdateAggregation(agg.id, 'label', e.target.value)}
                      placeholder="Название"
                    />
                  </Col>
                  <Col span={2}>
                    <Button
                      danger
                      icon={<MinusOutlined />}
                      onClick={() => handleRemoveAggregation(agg.id)}
                    />
                  </Col>
                </Row>
              ))}
              {aggregations.length === 0 && <Text type="secondary">Агрегации не добавлены</Text>}
            </Space>
          </Card>
        </Col>

        {/* Action Buttons */}
        <Col span={24}>
          <Card>
            <Space wrap>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleExecuteQuery}
                loading={loading}
              >
                Выполнить запрос
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => handleExport('xlsx')}
                loading={exportLoading}
                disabled={queryResults.length === 0 && Object.keys(aggregationResults).length === 0}
              >
                Экспорт Excel
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => handleExport('csv')}
                loading={exportLoading}
                disabled={queryResults.length === 0 && Object.keys(aggregationResults).length === 0}
              >
                Экспорт CSV
              </Button>
              <Button icon={<SaveOutlined />} onClick={handleSaveTemplate}>
                Сохранить как шаблон
              </Button>
            </Space>
          </Card>
        </Col>

        {/* Results */}
        {loading && (
          <Col span={24}>
            <Card>
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>
                  <Text>Выполнение запроса...</Text>
                </div>
              </div>
            </Card>
          </Col>
        )}

        {!loading && viewMode === 'lightweight' && Object.keys(aggregationResults).length > 0 && (
          <Col span={24}>
            <Card title="Результаты агрегации">
              <Row gutter={[16, 16]}>
                {Object.entries(aggregationResults).map(([key, value]) => {
                  // Try to find label from custom aggregations first
                  const agg = aggregations.find((a) => a.id === key);

                  // Fallback labels for default aggregations
                  const defaultLabels: Record<string, string> = {
                    sum_total_amount: 'Общая выручка',
                    quote_count: 'Количество КП',
                  };

                  const label = agg?.label || defaultLabels[key] || key;

                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={key}>
                      <Card
                        hoverable
                        onClick={() => {
                          setViewMode('standard');
                          handleExecuteQuery();
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <Statistic
                          title={label}
                          value={typeof value === 'number' ? value.toFixed(2) : value}
                        />
                      </Card>
                    </Col>
                  );
                })}
              </Row>
              {executionTime && (
                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <Text type="secondary">Время выполнения: {executionTime} мс</Text>
                </div>
              )}
            </Card>
          </Col>
        )}

        {!loading && viewMode === 'standard' && queryResults.length > 0 && (
          <Col span={24}>
            <Card title={`Результаты запроса (${totalCount} записей)`}>
              <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
                <AgGridReact
                  rowData={queryResults}
                  columnDefs={columnDefs}
                  defaultColDef={{
                    sortable: true,
                    filter: true,
                    resizable: true,
                  }}
                  pagination={true}
                  paginationPageSize={50}
                  enableRangeSelection={true}
                  enableCellTextSelection={true}
                />
              </div>
            </Card>
          </Col>
        )}
      </Row>
    </MainLayout>
  );
}
