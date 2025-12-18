'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import dayjs from 'dayjs';
import {
  Search,
  Download,
  Save,
  BarChart3,
  Table as TableIcon,
  Plus,
  Minus,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

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
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
  'Финансовые показатели': [{ key: 'total_amount', label: 'Общая сумма' }],
  'Расчетные показатели (детально)': [
    // Phase 1-2: Purchase prices
    { key: 'calc_s16_total_purchase_price', label: 'Цена закупки (итого)' },
    // Phase 3: Logistics
    { key: 'calc_v16_total_logistics', label: 'Логистика (транспорт)' },
    { key: 'calc_total_brokerage', label: 'Брокеридж и таможня' },
    { key: 'calc_total_logistics_and_brokerage', label: 'Логистика + Брокеридж (всего)' },
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
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // View mode: standard (rows) or lightweight (aggregations only)
  const [viewMode, setViewMode] = useState<'standard' | 'lightweight'>('standard');

  // Filter values
  const [createdDateFrom, setCreatedDateFrom] = useState('');
  const [createdDateTo, setCreatedDateTo] = useState('');
  const [sentDateFrom, setSentDateFrom] = useState('');
  const [sentDateTo, setSentDateTo] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [saleTypeFilter, setSaleTypeFilter] = useState('all');
  const [sellerCompanyFilter, setSellerCompanyFilter] = useState('all');

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

      // Load filters
      if (report.query_config?.filters) {
        const filters = report.query_config.filters;
        setCreatedDateFrom(filters.created_at_from || '');
        setCreatedDateTo(filters.created_at_to || '');
        setSentDateFrom(filters.quote_date_from || '');
        setSentDateTo(filters.quote_date_to || '');
        setStatusFilters(filters.status || []);
        setSaleTypeFilter(filters.offer_sale_type || '');
        setSellerCompanyFilter(filters.seller_company || '');
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
  }, []);

  // All available fields (flat list)
  const allFields = useMemo(() => {
    const fields: Array<{ key: string; label: string }> = [];
    Object.values(AVAILABLE_FIELDS).forEach((group) => {
      fields.push(...group);
    });
    return fields;
  }, []);

  // Build filters from state
  const buildFilters = useCallback((): AnalyticsFilter => {
    const filters: AnalyticsFilter = {};

    if (createdDateFrom) filters.created_at_from = createdDateFrom;
    if (createdDateTo) filters.created_at_to = createdDateTo;
    if (sentDateFrom) filters.quote_date_from = sentDateFrom;
    if (sentDateTo) filters.quote_date_to = sentDateTo;
    if (statusFilters.length > 0) filters.status = statusFilters;
    if (saleTypeFilter && saleTypeFilter !== 'all') filters.offer_sale_type = saleTypeFilter;
    if (sellerCompanyFilter && sellerCompanyFilter !== 'all')
      filters.seller_company = sellerCompanyFilter;

    return filters;
  }, [
    createdDateFrom,
    createdDateTo,
    sentDateFrom,
    sentDateTo,
    statusFilters,
    saleTypeFilter,
    sellerCompanyFilter,
  ]);

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
      const filters = buildFilters();

      if (selectedFields.length === 0) {
        toast.warning('Выберите хотя бы одно поле для отображения');
        return;
      }

      // Validate aggregations - text fields can only use COUNT
      const textFields = ['quote_number', 'status', 'offer_sale_type', 'seller_company'];
      const numericFunctions = ['sum', 'avg', 'min', 'max'];

      for (const agg of aggregations) {
        if (textFields.includes(agg.field) && numericFunctions.includes(agg.function)) {
          toast.error(
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
        toast.success('Агрегация выполнена успешно');
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
        toast.success(`Найдено записей: ${result.count}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка выполнения запроса');
    } finally {
      setLoading(false);
    }
  }, [buildFilters, selectedFields, viewMode, buildAggregationsObject, aggregations]);

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
        const filters = buildFilters();

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

        toast.success(`Экспорт в ${format.toUpperCase()} завершён`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Ошибка экспорта');
      } finally {
        setExportLoading(false);
      }
    },
    [buildFilters, selectedFields, buildAggregationsObject]
  );

  // Save as template
  const handleSaveTemplate = useCallback(async () => {
    try {
      const filters = buildFilters();

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

      toast.success('Отчёт сохранён');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка сохранения');
    }
  }, [buildFilters, selectedFields, buildAggregationsObject]);

  // Generate auto label for aggregation
  const generateAggregationLabel = (field: string, func: string): string => {
    const fieldLabels: Record<string, string> = {
      // Legacy fields
      total_amount: 'общая сумма',
      // New calculated fields
      calc_s16_total_purchase_price: 'цена закупки',
      calc_v16_total_logistics: 'логистика (транспорт)',
      calc_total_brokerage: 'брокеридж',
      calc_total_logistics_and_brokerage: 'логистика + брокеридж',
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

  // Toggle field selection
  const toggleField = (fieldKey: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey) ? prev.filter((f) => f !== fieldKey) : [...prev, fieldKey]
    );
  };

  // Toggle status filter
  const toggleStatus = (status: string) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  if (pageLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center" style={{ height: '80vh' }}>
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Загрузка аналитики...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Финансовая аналитика"
          description="Запросы, анализ и экспорт данных коммерческих предложений"
          actions={
            <TooltipProvider>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Режим отображения:</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'standard' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        setViewMode(viewMode === 'standard' ? 'lightweight' : 'standard')
                      }
                    >
                      {viewMode === 'standard' ? (
                        <>
                          <TableIcon className="mr-2 h-4 w-4" />
                          Таблица
                        </>
                      ) : (
                        <>
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Агрегация
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {viewMode === 'standard'
                      ? 'Стандартный режим: таблица с отдельными котировками'
                      : 'Облегчённый режим: только итоговые суммы (быстрее для больших отчётов)'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          }
        />

        {/* Filters Panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Фильтры</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltersCollapsed(!filtersCollapsed)}
              >
                {filtersCollapsed ? (
                  <>
                    <ChevronDown className="mr-2 h-4 w-4" />
                    Развернуть
                  </>
                ) : (
                  <>
                    <ChevronUp className="mr-2 h-4 w-4" />
                    Свернуть
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {!filtersCollapsed && (
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Период (по дате создания)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={createdDateFrom}
                      onChange={(e) => setCreatedDateFrom(e.target.value)}
                      placeholder="От"
                    />
                    <Input
                      type="date"
                      value={createdDateTo}
                      onChange={(e) => setCreatedDateTo(e.target.value)}
                      placeholder="До"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Период (по дате отправки)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={sentDateFrom}
                      onChange={(e) => setSentDateFrom(e.target.value)}
                      placeholder="От"
                    />
                    <Input
                      type="date"
                      value={sentDateTo}
                      onChange={(e) => setSentDateTo(e.target.value)}
                      placeholder="До"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Статус</Label>
                  <div className="space-y-2">
                    {STATUS_OPTIONS.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${option.value}`}
                          checked={statusFilters.includes(option.value)}
                          onCheckedChange={() => toggleStatus(option.value)}
                        />
                        <label
                          htmlFor={`status-${option.value}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Тип продажи</Label>
                  <Select value={saleTypeFilter} onValueChange={setSaleTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Все типы" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все типы</SelectItem>
                      {SALE_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Компания-продавец</Label>
                  <Select value={sellerCompanyFilter} onValueChange={setSellerCompanyFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Все компании" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все компании</SelectItem>
                      {SELLER_COMPANY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Field Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Выбор полей</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(AVAILABLE_FIELDS).map(([category, fields]) => (
                <div key={category} className="space-y-3">
                  <p className="text-sm font-semibold">{category}</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {fields.map((field) => (
                      <div key={field.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={`field-${field.key}`}
                          checked={selectedFields.includes(field.key)}
                          onCheckedChange={() => toggleField(field.key)}
                        />
                        <label
                          htmlFor={`field-${field.key}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {field.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  {category !== Object.keys(AVAILABLE_FIELDS).slice(-1)[0] && <Separator />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Aggregations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Агрегации</CardTitle>
              <Button size="sm" onClick={handleAddAggregation}>
                <Plus className="mr-2 h-4 w-4" />
                Добавить
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aggregations.map((agg) => (
                <div key={agg.id} className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={agg.field}
                      onValueChange={(value: string) =>
                        handleUpdateAggregation(agg.id, 'field', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Поле" />
                      </SelectTrigger>
                      <SelectContent>
                        {allFields.map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Select
                      value={agg.function}
                      onValueChange={(value: string) =>
                        handleUpdateAggregation(agg.id, 'function', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Функция" />
                      </SelectTrigger>
                      <SelectContent>
                        {AGG_FUNCTIONS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-[2]">
                    <Input
                      value={agg.label}
                      onChange={(e) => handleUpdateAggregation(agg.id, 'label', e.target.value)}
                      placeholder="Название"
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleRemoveAggregation(agg.id)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {aggregations.length === 0 && (
                <p className="text-sm text-muted-foreground">Агрегации не добавлены</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleExecuteQuery} disabled={loading}>
                <Search className="mr-2 h-4 w-4" />
                Выполнить запрос
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport('xlsx')}
                disabled={
                  exportLoading ||
                  (queryResults.length === 0 && Object.keys(aggregationResults).length === 0)
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Экспорт Excel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport('csv')}
                disabled={
                  exportLoading ||
                  (queryResults.length === 0 && Object.keys(aggregationResults).length === 0)
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Экспорт CSV
              </Button>
              <Button variant="outline" onClick={handleSaveTemplate}>
                <Save className="mr-2 h-4 w-4" />
                Сохранить как шаблон
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <Card>
            <CardContent className="py-20 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Выполнение запроса...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Aggregation Results */}
        {!loading && viewMode === 'lightweight' && Object.keys(aggregationResults).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Результаты агрегации</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                    <div
                      key={key}
                      className="cursor-pointer"
                      onClick={() => {
                        setViewMode('standard');
                        handleExecuteQuery();
                      }}
                    >
                      <StatCard
                        label={label}
                        value={typeof value === 'number' ? value.toFixed(2) : value}
                      />
                    </div>
                  );
                })}
              </div>
              {executionTime && (
                <div className="mt-4 text-right">
                  <p className="text-sm text-muted-foreground">
                    Время выполнения: {executionTime} мс
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Standard Results */}
        {!loading && viewMode === 'standard' && queryResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Результаты запроса ({totalCount} записей)</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
