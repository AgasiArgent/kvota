'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { ColDef, ColGroupDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import dayjs from 'dayjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Save,
  Info,
  Pencil,
  LayoutGrid,
  Filter,
  X,
  Upload,
  Loader2,
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import {
  quotesCalcService,
  Product,
  VariableTemplate,
  CalculationVariables,
  ProductCalculationResult,
} from '@/lib/api/quotes-calc-service';
import { customerService, Customer } from '@/lib/api/customer-service';
import { quoteService } from '@/lib/api/quote-service';
import {
  calculationSettingsService,
  CalculationSettings,
} from '@/lib/api/calculation-settings-service';
import { toast } from 'sonner';

// Lazy load ag-Grid to reduce initial bundle size (saves ~300KB)
const AgGridReact = dynamic(
  async () => {
    const { AgGridReact } = await import('ag-grid-react');
    const { ModuleRegistry, AllCommunityModule } = await import('ag-grid-community');
    ModuleRegistry.registerModules([AllCommunityModule]);
    return AgGridReact;
  },
  {
    loading: () => (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Загрузка таблицы...</span>
      </div>
    ),
    ssr: false,
  }
);

// CSS for full row highlighting when selected via checkbox
const agGridRowSelectionStyles = `
  .ag-theme-alpine .ag-row-selected {
    background-color: #e0e0e0 !important;
  }
  .ag-theme-alpine .ag-row-selected:hover {
    background-color: #d4d4d4 !important;
  }
  .ag-theme-alpine .ag-row-selected .ag-cell {
    background-color: transparent !important;
  }
`;

// Helper function to parse decimal input with comma or period separator
const parseDecimalInput = (value: string): number | null => {
  if (!value || value === '') return null;
  const normalized = value.toString().replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
};

interface FormData {
  quote_date: string;
  valid_until: string;
  seller_company: string;
  offer_sale_type: string;
  currency_of_quote: string;
  offer_incoterms: string;
  delivery_time: number;
  markup: number;
  exchange_rate_base_price_to_quote: number;
  advance_from_client: number;
  time_to_advance_on_receiving: number;
  time_to_advance: number;
  advance_to_supplier: number;
  advance_on_loading: number;
  time_to_advance_loading: number;
  advance_on_going_to_country_destination: number;
  time_to_advance_going_to_country_destination: number;
  advance_on_customs_clearance: number;
  time_to_advance_on_customs_clearance: number;
  dm_fee_type: string;
  dm_fee_value: number;
  logistics_total: number;
  logistics_supplier_hub: number;
  logistics_hub_customs: number;
  logistics_customs_client: number;
  brokerage_hub: number;
  brokerage_customs: number;
  warehousing_at_customs: number;
  customs_documentation: number;
  brokerage_extra: number;
  customs_code: string;
  import_tariff: number;
  excise_tax: number;
  currency_of_base_price: string;
  supplier_country: string;
  supplier_discount: number;
  rate_forex_risk: number;
  rate_fin_comm: number;
  rate_loan_interest_daily: number;
}

const initialFormData: FormData = {
  quote_date: dayjs().format('YYYY-MM-DD'),
  valid_until: dayjs().add(7, 'day').format('YYYY-MM-DD'),
  seller_company: '',
  offer_sale_type: '',
  currency_of_quote: 'RUB',
  offer_incoterms: 'DDP',
  delivery_time: 0,
  markup: 0,
  exchange_rate_base_price_to_quote: 1,
  advance_from_client: 0,
  time_to_advance_on_receiving: 0,
  time_to_advance: 0,
  advance_to_supplier: 0,
  advance_on_loading: 0,
  time_to_advance_loading: 0,
  advance_on_going_to_country_destination: 0,
  time_to_advance_going_to_country_destination: 0,
  advance_on_customs_clearance: 0,
  time_to_advance_on_customs_clearance: 0,
  dm_fee_type: 'fixed',
  dm_fee_value: 0,
  logistics_total: 0,
  logistics_supplier_hub: 0,
  logistics_hub_customs: 0,
  logistics_customs_client: 0,
  brokerage_hub: 0,
  brokerage_customs: 0,
  warehousing_at_customs: 0,
  customs_documentation: 0,
  brokerage_extra: 0,
  customs_code: '',
  import_tariff: 0,
  excise_tax: 0,
  currency_of_base_price: 'TRY',
  supplier_country: 'Турция',
  supplier_discount: 0,
  rate_forex_risk: 0,
  rate_fin_comm: 0,
  rate_loan_interest_daily: 0,
};

export default function EditQuotePage() {
  const router = useRouter();
  const params = useParams();
  const quoteId = params?.id as string;
  const gridRef = useRef<any>(null);

  // Form state
  const [formData, setFormData] = useState<FormData>(initialFormData);

  // State
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [quoteNumber, setQuoteNumber] = useState<string>('');
  const [quoteTitle, setQuoteTitle] = useState<string>('');
  const [uploadedProducts, setUploadedProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [templates, setTemplates] = useState<VariableTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>();
  const [selectedCustomer, setSelectedCustomer] = useState<string | undefined>();
  const [calculationResults, setCalculationResults] = useState<any>(null);
  const [adminSettings, setAdminSettings] = useState<CalculationSettings | null>(null);
  const [bulkEditModalVisible, setBulkEditModalVisible] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<string>('');
  const [bulkEditValue, setBulkEditValue] = useState<any>('');
  const [showAdvancedPayment, setShowAdvancedPayment] = useState(false);
  const [showLprCompensation, setShowLprCompensation] = useState(false);
  const [logisticsMode, setLogisticsMode] = useState<'total' | 'detailed'>('detailed');
  const [showBrokerage, setShowBrokerage] = useState(false);
  const [columnChooserVisible, setColumnChooserVisible] = useState(false);
  const [columnVisibilityRefresh, setColumnVisibilityRefresh] = useState(0);
  const [templateSaveModalVisible, setTemplateSaveModalVisible] = useState(false);
  const [templateSaveMode, setTemplateSaveMode] = useState<'new' | 'update'>('new');
  const [templateUpdateId, setTemplateUpdateId] = useState<string>('');
  const [templateNewName, setTemplateNewName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  // Load quote data, customers, templates, and admin settings on mount
  useEffect(() => {
    loadQuoteData();
    loadCustomers();
    loadTemplates();
    loadAdminSettings();
  }, [quoteId]);

  // Load existing quote data
  const loadQuoteData = async () => {
    if (!quoteId) return;

    setInitialLoading(true);
    try {
      const orgId = '';
      const result = await quoteService.getQuoteDetails(quoteId, orgId);

      if (result.success && result.data) {
        const { items, customer, ...quoteFields } = result.data as any;
        const quote = quoteFields;

        setSelectedCustomer(quote.customer_id || undefined);
        // Support both idn_quote (new) and quote_number (legacy)
        setQuoteNumber(quote.idn_quote || quote.quote_number || '');
        setQuoteTitle(quote.title || '');

        const products: Product[] = items.map((item: any) => ({
          sku: item.product_code || '',
          brand: item.brand || '',
          product_name: item.product_name || '',
          product_code: item.product_code || '',
          base_price_vat: item.unit_price || 0,
          quantity: item.quantity || 0,
          weight_in_kg: item.weight_kg,
          customs_code: item.custom_fields?.customs_code as string | undefined,
          supplier_country: item.custom_fields?.supplier_country as string | undefined,
          currency_of_base_price: item.custom_fields?.currency_of_base_price as string | undefined,
          supplier_discount: item.custom_fields?.supplier_discount as number | undefined,
          exchange_rate_base_price_to_quote: item.custom_fields?.exchange_rate as
            | number
            | undefined,
          import_tariff: item.custom_fields?.import_tariff as number | undefined,
          excise_tax: item.custom_fields?.excise_tax as number | undefined,
          markup: item.custom_fields?.markup as number | undefined,
        }));

        setUploadedProducts(products);

        if (items && items.length > 0 && items[0].calculation_results) {
          const resultsItems = items.map((item: any) => {
            const calc = item.calculation_results;
            return {
              product_name: item.description || item.name,
              product_code: item.product_code,
              quantity: item.quantity,
              base_price_vat: calc.purchase_price_no_vat || 0,
              base_price_no_vat: calc.purchase_price_no_vat || 0,
              purchase_price_rub: calc.purchase_price_total_quote_currency || 0,
              logistics_costs: calc.logistics_total || 0,
              cogs: calc.cogs_per_product || 0,
              cogs_with_vat: calc.cogs_per_product || 0,
              import_duties: 0,
              customs_fees: calc.customs_fee || 0,
              financing_costs: calc.financing_cost_credit + calc.financing_cost_initial || 0,
              dm_fee: calc.dm_fee || 0,
              total_cost: calc.cogs_per_product || 0,
              sale_price: calc.sales_price_per_unit_with_vat || 0,
              margin: calc.profit || 0,
            };
          });

          setCalculationResults({
            items: resultsItems,
            totals: {
              subtotal: parseFloat(quote.subtotal || '0'),
              total: parseFloat(quote.total_amount || '0'),
            },
          });
        }

        setFormData((prev) => ({
          ...prev,
          quote_date: quote.quote_date
            ? dayjs(quote.quote_date).format('YYYY-MM-DD')
            : dayjs().format('YYYY-MM-DD'),
          valid_until: quote.valid_until
            ? dayjs(quote.valid_until).format('YYYY-MM-DD')
            : dayjs().add(7, 'day').format('YYYY-MM-DD'),
          currency_of_quote: quote.currency || 'RUB',
          ...(quote.calculation_variables || {}),
        }));

        toast.success('Котировка загружена');
      } else {
        toast.error(`Ошибка загрузки котировки: ${result.error}`);
        router.push('/quotes');
      }
    } catch (error: any) {
      toast.error(`Ошибка: ${error.message}`);
      router.push('/quotes');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleLogisticsTotalChange = (value: number) => {
    if (logisticsMode === 'total' && value) {
      setFormData((prev) => ({
        ...prev,
        logistics_total: value,
        logistics_supplier_hub: value * 0.5,
        logistics_hub_customs: value * 0.3,
        logistics_customs_client: value * 0.2,
      }));
    }
  };

  const loadCustomers = async () => {
    const result = await customerService.listCustomers();
    if (result.success && result.data) {
      setCustomers(result.data.customers);
    } else {
      toast.error(`Ошибка загрузки клиентов: ${result.error}`);
    }
  };

  const loadTemplates = async () => {
    try {
      const result = await quotesCalcService.listTemplates();
      if (result.success && result.data) {
        setTemplates(result.data);
      } else {
        toast.error(`Ошибка загрузки шаблонов: ${result.error}`);
      }
    } catch (error) {
      toast.error('Ошибка при загрузке шаблонов');
    }
  };

  const loadAdminSettings = async () => {
    const result = await calculationSettingsService.getSettings();
    if (result.success && result.data) {
      setAdminSettings(result.data);
      setFormData((prev) => ({
        ...prev,
        rate_forex_risk: result.data!.rate_forex_risk,
        rate_fin_comm: result.data!.rate_fin_comm,
        rate_loan_interest_daily: result.data!.rate_loan_interest_daily,
      }));
    }
  };

  // File upload handlers
  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      const result = await quotesCalcService.uploadProducts(file);

      if (result.success && result.data) {
        setUploadedProducts(result.data.products);
        toast.success(`Загружено ${result.data.total_count} товаров`);
        return true;
      } else {
        toast.error(`Ошибка загрузки файла: ${result.error}`);
        return false;
      }
    } catch (error: any) {
      toast.error(`Ошибка: ${error.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && quotesCalcService.isValidFileType(file)) {
      await handleFileUpload(file);
    } else {
      toast.error('Поддерживаются только файлы Excel (.xlsx, .xls) и CSV (.csv)');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (quotesCalcService.isValidFileType(file)) {
        await handleFileUpload(file);
      } else {
        toast.error('Поддерживаются только файлы Excel (.xlsx, .xls) и CSV (.csv)');
      }
    }
  };

  // Template selection handler
  const handleTemplateSelect = async (templateId: string) => {
    setSelectedTemplate(templateId);

    try {
      const result = await quotesCalcService.getTemplate(templateId);
      if (result.success && result.data) {
        const templateVars = result.data.variables;
        setFormData((prev) => ({
          ...prev,
          ...templateVars,
          quote_date: templateVars.quote_date
            ? dayjs(templateVars.quote_date).format('YYYY-MM-DD')
            : prev.quote_date,
          valid_until: templateVars.valid_until
            ? dayjs(templateVars.valid_until).format('YYYY-MM-DD')
            : prev.valid_until,
        }));
        toast.success(`Шаблон "${result.data.name}" загружен`);
      } else {
        toast.error(`Ошибка загрузки шаблона: ${result.error}`);
      }
    } catch (error) {
      toast.error('Ошибка при загрузке шаблона');
    }
  };

  const handleSaveTemplate = () => {
    setTemplateNewName('');
    setTemplateUpdateId('');
    setTemplateSaveMode('new');
    setTemplateSaveModalVisible(true);
  };

  const performTemplateSave = async () => {
    try {
      let result;

      if (templateSaveMode === 'update' && templateUpdateId) {
        const existingTemplate = templates.find((t) => t.id === templateUpdateId);
        if (!existingTemplate) {
          toast.error('Шаблон не найден');
          return;
        }

        result = await quotesCalcService.updateTemplate(templateUpdateId, {
          name: existingTemplate.name,
          description: `Обновлено ${new Date().toLocaleDateString()}`,
          variables: formData as unknown as CalculationVariables,
          is_default: existingTemplate.is_default,
        });
      } else {
        if (!templateNewName.trim()) {
          toast.error('Введите название шаблона');
          return;
        }

        result = await quotesCalcService.createTemplate({
          name: templateNewName,
          description: `Создано ${new Date().toLocaleDateString()}`,
          variables: formData as unknown as CalculationVariables,
          is_default: false,
        });
      }

      if (result.success) {
        toast.success(templateSaveMode === 'update' ? 'Шаблон обновлен' : 'Шаблон создан');
        await loadTemplates();

        if (result.data?.id) {
          setSelectedTemplate(result.data.id);
        }

        setTemplateSaveModalVisible(false);
      } else {
        toast.error(`Ошибка сохранения: ${result.error}`);
      }
    } catch (error) {
      toast.error('Ошибка при сохранении шаблона');
    }
  };

  const applyQuoteDefaultsToProducts = (
    products: Product[],
    quoteDefaults: FormData
  ): Product[] => {
    return products.map((product) => ({
      ...product,
      currency_of_base_price:
        product.currency_of_base_price || quoteDefaults.currency_of_base_price || 'USD',
      exchange_rate_base_price_to_quote:
        product.exchange_rate_base_price_to_quote ||
        quoteDefaults.exchange_rate_base_price_to_quote ||
        1.0,
      supplier_discount: product.supplier_discount ?? 0,
      markup: product.markup ?? quoteDefaults.markup ?? 0,
      supplier_country: product.supplier_country || quoteDefaults.supplier_country || 'Турция',
      customs_code: product.customs_code || quoteDefaults.customs_code || '',
      import_tariff: product.import_tariff ?? quoteDefaults.import_tariff ?? 0,
      excise_tax: product.excise_tax ?? quoteDefaults.excise_tax ?? 0,
    }));
  };

  const handleClearVariables = () => {
    setFormData(initialFormData);
    toast.success('Все переменные очищены');
  };

  const handleSaveChanges = async () => {
    if (!selectedCustomer) {
      toast.error('Выберите клиента');
      return;
    }

    if (uploadedProducts.length === 0) {
      toast.error('Загрузите файл с товарами');
      return;
    }

    setLoading(true);
    try {
      const productsWithDefaults = applyQuoteDefaultsToProducts(uploadedProducts, formData);

      const result = await quotesCalcService.calculateQuote({
        customer_id: selectedCustomer,
        products: productsWithDefaults,
        variables: formData as unknown as CalculationVariables,
        title: quoteTitle || `Коммерческое предложение от ${new Date().toLocaleDateString()}`,
        quote_date: formData.quote_date,
        valid_until: formData.valid_until,
      });

      if (result.success && result.data) {
        setCalculationResults(result.data);
        toast.success(
          `Котировка пересчитана! ${result.data.idn_quote || result.data.quote_number}`
        );

        setTimeout(() => {
          router.push(`/quotes/${quoteId}`);
        }, 1500);
      } else {
        toast.error(`Ошибка расчета: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ag-Grid column definitions with groups
  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(
    () => [
      {
        width: 50,
        pinned: 'left',
        lockPosition: true,
        suppressHeaderMenuButton: true,
        resizable: false,
      },
      {
        headerName: 'Информация о товаре',
        children: [
          {
            field: 'sku',
            headerName: 'Артикул',
            width: 120,
            pinned: 'left',
            editable: true,
            cellStyle: { backgroundColor: '#fff' },
          },
          {
            field: 'brand',
            headerName: 'Бренд',
            width: 120,
            pinned: 'left',
            editable: true,
            cellStyle: { backgroundColor: '#fff' },
          },
          {
            field: 'product_name',
            headerName: 'Наименование',
            width: 200,
            pinned: 'left',
            editable: true,
            cellStyle: { backgroundColor: '#fff' },
          },
          {
            field: 'quantity',
            headerName: 'Кол-во',
            flex: 1,
            minWidth: 80,
            editable: true,
            type: 'numericColumn',
            cellStyle: { backgroundColor: '#fff' },
          },
          {
            field: 'base_price_vat',
            headerName: 'Цена с НДС',
            flex: 1,
            minWidth: 110,
            editable: true,
            type: 'numericColumn',
            cellStyle: { backgroundColor: '#fff' },
            valueFormatter: (params) =>
              params.value != null ? Number(params.value).toFixed(2) : '',
            valueParser: (params) => parseDecimalInput(params.newValue),
          },
          {
            field: 'weight_in_kg',
            headerName: 'Вес (кг)',
            flex: 1,
            minWidth: 90,
            editable: true,
            type: 'numericColumn',
            cellStyle: { backgroundColor: '#fff' },
            valueFormatter: (params) =>
              params.value != null ? Number(params.value).toFixed(2) : '-',
            valueParser: (params) => parseDecimalInput(params.newValue),
          },
        ],
      },
      {
        headerName: 'Переопределяемые параметры',
        children: [
          {
            field: 'currency_of_base_price',
            headerName: 'Валюта закупки',
            flex: 1,
            minWidth: 100,
            editable: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
              values: ['TRY', 'USD', 'EUR', 'CNY'],
            },
            cellStyle: (params) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
          },
          {
            field: 'supplier_country',
            headerName: 'Страна закупки',
            flex: 1,
            minWidth: 110,
            editable: true,
            cellStyle: (params) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
          },
          {
            field: 'supplier_discount',
            headerName: 'Скидка (%)',
            flex: 1,
            minWidth: 100,
            editable: true,
            type: 'numericColumn',
            cellStyle: (params) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
            valueFormatter: (params) =>
              params.value != null ? Number(params.value).toFixed(2) : '',
            valueParser: (params) => parseDecimalInput(params.newValue),
          },
          {
            field: 'exchange_rate_base_price_to_quote',
            headerName: 'Курс',
            flex: 1,
            minWidth: 90,
            editable: true,
            type: 'numericColumn',
            cellStyle: (params) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
            valueFormatter: (params) =>
              params.value != null ? Number(params.value).toFixed(4) : '',
            valueParser: (params) => parseDecimalInput(params.newValue),
          },
          {
            field: 'customs_code',
            headerName: 'Код ТН ВЭД',
            flex: 1,
            minWidth: 120,
            editable: true,
            cellStyle: (params) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
          },
          {
            field: 'import_tariff',
            headerName: 'Пошлина (%)',
            flex: 1,
            minWidth: 110,
            editable: true,
            type: 'numericColumn',
            cellStyle: (params) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
            valueFormatter: (params) =>
              params.value != null ? Number(params.value).toFixed(2) : '',
            valueParser: (params) => parseDecimalInput(params.newValue),
          },
          {
            field: 'excise_tax',
            headerName: 'Акциз (УЕ КП на тонну)',
            flex: 1,
            minWidth: 150,
            editable: true,
            type: 'numericColumn',
            cellStyle: (params) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
            valueFormatter: (params) =>
              params.value != null ? Number(params.value).toFixed(2) : '',
            valueParser: (params) => parseDecimalInput(params.newValue),
          },
          {
            field: 'util_fee',
            headerName: 'Утилизационный сбор (₽)',
            flex: 1,
            minWidth: 150,
            editable: true,
            type: 'numericColumn',
            cellStyle: (params) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
            valueFormatter: (params) =>
              params.value != null ? Number(params.value).toFixed(2) : '',
            valueParser: (params) => parseDecimalInput(params.newValue),
          },
          {
            field: 'markup',
            headerName: 'Наценка (%)',
            flex: 1,
            minWidth: 100,
            editable: true,
            type: 'numericColumn',
            cellStyle: (params) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
            valueFormatter: (params) =>
              params.value != null ? Number(params.value).toFixed(2) : '',
            valueParser: (params) => parseDecimalInput(params.newValue),
          },
        ],
      },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      floatingFilter: true,
      floatingFilterComponentParams: {
        suppressFilterButton: false,
      },
      filterParams: {
        buttons: ['clear'],
      },
      enableCellChangeFlash: true,
    }),
    []
  );

  const handleBulkEdit = useCallback(
    (field: string, value: any) => {
      const selectedNodes = gridRef.current?.api.getSelectedNodes();
      if (!selectedNodes || selectedNodes.length === 0) {
        toast.warning('Выберите строки для применения значения');
        return;
      }

      const updatedProducts = [...uploadedProducts];
      selectedNodes.forEach((node: any) => {
        if (node.rowIndex !== null && node.rowIndex !== undefined) {
          updatedProducts[node.rowIndex] = {
            ...updatedProducts[node.rowIndex],
            [field]: value,
          };
        }
      });

      setUploadedProducts(updatedProducts);
      gridRef.current?.api.refreshCells({ force: true });
      toast.success(`Значение применено к ${selectedNodes.length} строкам`);
    },
    [uploadedProducts]
  );

  const openBulkEditModal = () => {
    const selectedNodes = gridRef.current?.api.getSelectedNodes();
    if (!selectedNodes || selectedNodes.length === 0) {
      toast.warning('Выберите строки для массового редактирования');
      return;
    }
    setBulkEditModalVisible(true);
  };

  const applyBulkEdit = () => {
    if (!bulkEditField) {
      toast.error('Выберите поле для редактирования');
      return;
    }

    handleBulkEdit(bulkEditField, bulkEditValue);
    setBulkEditModalVisible(false);
    setBulkEditField('');
    setBulkEditValue('');
  };

  const bulkEditFields = [
    { value: 'currency_of_base_price', label: 'Валюта закупки' },
    { value: 'supplier_country', label: 'Страна закупки' },
    { value: 'supplier_discount', label: 'Скидка поставщика (%)' },
    { value: 'exchange_rate_base_price_to_quote', label: 'Курс' },
    { value: 'customs_code', label: 'Код ТН ВЭД' },
    { value: 'import_tariff', label: 'Пошлина (%)' },
    { value: 'excise_tax', label: 'Акциз (УЕ КП на тонну)' },
    { value: 'util_fee', label: 'Утилизационный сбор (₽)' },
    { value: 'markup', label: 'Наценка (%)' },
  ];

  if (initialLoading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="flex items-center justify-center min-h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Загрузка котировки...</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push(`/quotes/${quoteId}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">
                {quoteNumber ? `Редактирование ${quoteNumber}` : 'Редактировать котировку'}
              </h1>
              {quoteTitle && <p className="text-sm text-muted-foreground">{quoteTitle}</p>}
            </div>
          </div>
          {adminSettings && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              Резерв: {adminSettings.rate_forex_risk.toFixed(2)}% | Комиссия ФА:{' '}
              {adminSettings.rate_fin_comm.toFixed(2)}% | Годовая ставка:{' '}
              {(
                calculationSettingsService.dailyToAnnualRate(
                  adminSettings.rate_loan_interest_daily
                ) * 100
              ).toFixed(2)}
              %
            </div>
          )}
        </div>

        {/* Requirements Alert */}
        {(!selectedCustomer || uploadedProducts.length === 0) && !calculationResults && (
          <Alert>
            <AlertDescription>
              <strong>Чтобы рассчитать котировку:</strong>
              <ul className="list-disc ml-4 mt-2">
                {!selectedCustomer && <li>Выберите клиента из списка ниже</li>}
                {uploadedProducts.length === 0 && (
                  <li>Загрузите файл с товарами (Excel или CSV)</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Template & Customer Selector */}
        <div className="bg-muted/50 rounded-lg p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Название КП:</span>
            <Input
              className="w-64 h-8"
              value={quoteTitle}
              onChange={(e) => setQuoteTitle(e.target.value)}
              placeholder="Введите название котировки"
            />
          </div>

          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Шаблон:</span>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger className="w-48 h-8">
                <SelectValue placeholder="Выберите шаблон" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.is_default && ' (по умолч.)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={handleSaveTemplate}>
              <Save className="h-4 w-4 mr-1" />
              Сохранить
            </Button>
          </div>

          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Клиент:</span>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger className="w-64 h-8">
                <SelectValue placeholder="Выберите клиента" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.inn || 'без ИНН'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Дата КП:</span>
            <Input
              type="date"
              className="w-36 h-8"
              value={formData.quote_date}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  quote_date: e.target.value,
                  valid_until: dayjs(e.target.value).add(7, 'day').format('YYYY-MM-DD'),
                }));
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Действительно до:</span>
            <Input
              type="date"
              className="w-36 h-8"
              value={formData.valid_until}
              onChange={(e) => setFormData((prev) => ({ ...prev, valid_until: e.target.value }))}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Параметры котировки по умолчанию - эти значения будут применены ко всем товарам. Вы
          сможете переопределить их для отдельных товаров в таблице.
        </p>

        {/* Variables Form - Grid of Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Company & Payment Card */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Настройки компании и оплата</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs font-medium">Компания</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Компания-продавец</Label>
                  <Select
                    value={formData.seller_company}
                    onValueChange={(v: string) =>
                      setFormData((prev) => ({ ...prev, seller_company: v }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Выберите" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="МАСТЕР БЭРИНГ ООО">МАСТЕР БЭРИНГ ООО (Россия)</SelectItem>
                      <SelectItem value="TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ">
                        TEXCEL OTOMOTİV (Турция)
                      </SelectItem>
                      <SelectItem value="UPDOOR Limited">UPDOOR Limited (Китай)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Вид КП</Label>
                  <Select
                    value={formData.offer_sale_type}
                    onValueChange={(v: string) =>
                      setFormData((prev) => ({ ...prev, offer_sale_type: v }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Выберите" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="поставка">Поставка</SelectItem>
                      <SelectItem value="комиссия">Комиссия</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Валюта КП</Label>
                  <Select
                    value={formData.currency_of_quote}
                    onValueChange={(v: string) =>
                      setFormData((prev) => ({ ...prev, currency_of_quote: v }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RUB">RUB (Рубль)</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Базис поставки</Label>
                  <Select
                    value={formData.offer_incoterms}
                    onValueChange={(v: string) =>
                      setFormData((prev) => ({ ...prev, offer_incoterms: v }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DDP">DDP</SelectItem>
                      <SelectItem value="EXW">EXW</SelectItem>
                      <SelectItem value="FCA">FCA</SelectItem>
                      <SelectItem value="DAP">DAP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Срок поставки (дни)</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={formData.delivery_time || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        delivery_time: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Наценка (%)</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={formData.markup || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, markup: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Курс к валюте КП</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8"
                    value={formData.exchange_rate_base_price_to_quote || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        exchange_rate_base_price_to_quote: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              <p className="text-xs font-medium pt-2">Условия оплаты</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Аванс от клиента (%)</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={formData.advance_from_client || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        advance_from_client: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Дней от получения до оплаты</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={formData.time_to_advance_on_receiving || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        time_to_advance_on_receiving: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto"
                onClick={() => setShowAdvancedPayment(!showAdvancedPayment)}
              >
                {showAdvancedPayment ? '▼' : '▶'} Дополнительные условия оплаты
              </Button>

              {showAdvancedPayment && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Дней до аванса</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={formData.time_to_advance || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          time_to_advance: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Аванс поставщику (%)</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={formData.advance_to_supplier || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          advance_to_supplier: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Аванс при заборе груза (%)</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={formData.advance_on_loading || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          advance_on_loading: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Дней от забора до аванса</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={formData.time_to_advance_loading || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          time_to_advance_loading: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto"
                onClick={() => setShowLprCompensation(!showLprCompensation)}
              >
                {showLprCompensation ? '▼' : '▶'} Вознаграждение ЛПР
              </Button>

              {showLprCompensation && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Тип вознаграждения ЛПР</Label>
                    <Select
                      value={formData.dm_fee_type}
                      onValueChange={(v: string) =>
                        setFormData((prev) => ({ ...prev, dm_fee_type: v }))
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Фиксированная сумма</SelectItem>
                        <SelectItem value="percentage">Процент</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Размер вознаграждения</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={formData.dm_fee_value || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          dm_fee_value: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Logistics & Customs Card */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Логистика и таможня</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs font-medium">Логистика</p>

              <div className="flex gap-2">
                <Button
                  variant={logisticsMode === 'total' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLogisticsMode('total')}
                >
                  Итого
                </Button>
                <Button
                  variant={logisticsMode === 'detailed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLogisticsMode('detailed')}
                >
                  Детально
                </Button>
              </div>

              {logisticsMode === 'total' && (
                <div className="space-y-1">
                  <Label className="text-xs">Логистика всего (₽)</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={formData.logistics_total || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      handleLogisticsTotalChange(value);
                    }}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Поставщик - Турция (50%)</Label>
                  <Input
                    type="number"
                    className="h-8"
                    disabled={logisticsMode === 'total'}
                    value={formData.logistics_supplier_hub || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        logistics_supplier_hub: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Турция - Таможня РФ (30%)</Label>
                  <Input
                    type="number"
                    className="h-8"
                    disabled={logisticsMode === 'total'}
                    value={formData.logistics_hub_customs || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        logistics_hub_customs: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Таможня РФ - Клиент (20%)</Label>
                  <Input
                    type="number"
                    className="h-8"
                    disabled={logisticsMode === 'total'}
                    value={formData.logistics_customs_client || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        logistics_customs_client: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              <hr className="my-3" />

              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto"
                onClick={() => setShowBrokerage(!showBrokerage)}
              >
                {showBrokerage ? '▼' : '▶'} Брокеридж
              </Button>

              {showBrokerage && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Брокерские Турция (₽)</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={formData.brokerage_hub || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          brokerage_hub: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Брокерские РФ (₽)</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={formData.brokerage_customs || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          brokerage_customs: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Расходы на СВХ (₽)</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={formData.warehousing_at_customs || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          warehousing_at_customs: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Разрешительные документы (₽)</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={formData.customs_documentation || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          customs_documentation: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Прочие расходы (₽)</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={formData.brokerage_extra || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          brokerage_extra: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customs Clearance Card */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Таможенная очистка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Значения по умолчанию для таможенной очистки
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Код ТН ВЭД</Label>
                <Input
                  className="h-8"
                  placeholder="8482102009"
                  value={formData.customs_code}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, customs_code: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Пошлина (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    className="h-8"
                    value={formData.import_tariff || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        import_tariff: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Акциз (УЕ КП на тонну)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    className="h-8"
                    value={formData.excise_tax || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        excise_tax: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Defaults Card */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Значения по умолчанию для товаров</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Эти значения можно переопределить для каждого товара в таблице
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Валюта цены закупки</Label>
                  <Select
                    value={formData.currency_of_base_price}
                    onValueChange={(v: string) =>
                      setFormData((prev) => ({ ...prev, currency_of_base_price: v }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRY">TRY (Турецкая лира)</SelectItem>
                      <SelectItem value="USD">USD (Доллар США)</SelectItem>
                      <SelectItem value="EUR">EUR (Евро)</SelectItem>
                      <SelectItem value="CNY">CNY (Юань)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Страна закупки</Label>
                  <Input
                    className="h-8"
                    placeholder="Турция"
                    value={formData.supplier_country}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, supplier_country: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Скидка поставщика (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    className="h-8"
                    value={formData.supplier_discount || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        supplier_discount: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* File Upload */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Загрузить товары</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm mb-1">Нажмите или перетащите файл Excel/CSV</p>
              <p className="text-xs text-muted-foreground">
                Поддерживаются форматы: .xlsx, .xls, .csv
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                id="file-upload"
                onChange={handleFileSelect}
              />
              <Button variant="outline" className="mt-4" asChild>
                <label htmlFor="file-upload" className="cursor-pointer">
                  Выбрать файл
                </label>
              </Button>
            </div>
            {uploadedProducts.length > 0 && (
              <p className="mt-4 font-medium">Загружено товаров: {uploadedProducts.length}</p>
            )}
          </CardContent>
        </Card>

        {/* Products Grid */}
        {uploadedProducts.length > 0 && (
          <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Загруженные товары</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={openBulkEditModal}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Массовое редактирование
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    gridRef.current?.api?.setFilterModel(null);
                    toast.success('Фильтры очищены');
                  }}
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Очистить фильтры
                </Button>
                <Button variant="outline" size="sm" onClick={() => setColumnChooserVisible(true)}>
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Колонки
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Совет: Выберите строки, затем используйте &quot;Массовое редактирование&quot; или
                Ctrl+C/Ctrl+V для копирования из Excel
              </p>
              <style>{agGridRowSelectionStyles}</style>
              <div className="ag-theme-alpine" style={{ height: 500, width: '100%' }}>
                <AgGridReact
                  onGridReady={(params) => {
                    gridRef.current = { api: params.api };
                  }}
                  rowData={uploadedProducts}
                  columnDefs={columnDefs}
                  defaultColDef={defaultColDef}
                  animateRows={true}
                  rowSelection={{
                    mode: 'multiRow',
                    checkboxes: true,
                    headerCheckbox: true,
                    enableClickSelection: false,
                  }}
                  enableCellTextSelection={true}
                  suppressHorizontalScroll={false}
                  onCellValueChanged={(event: any) => {
                    setUploadedProducts((prevProducts) => {
                      const updatedProducts = [...prevProducts];
                      const index = event.rowIndex;
                      if (index !== null && index !== undefined) {
                        updatedProducts[index] = event.data as Product;
                      }
                      return updatedProducts;
                    });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Button
              className="w-full"
              size="lg"
              onClick={handleSaveChanges}
              disabled={!selectedCustomer || uploadedProducts.length === 0 || loading}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Сохранить изменения
            </Button>
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => router.push(`/quotes/${quoteId}`)}
            >
              <X className="h-4 w-4 mr-2" />
              Отмена
            </Button>
            {(!selectedCustomer || uploadedProducts.length === 0) && (
              <p className="text-sm text-center text-muted-foreground">
                {!selectedCustomer && 'Выберите клиента'}
                {!selectedCustomer && uploadedProducts.length === 0 && ' и '}
                {uploadedProducts.length === 0 && 'загрузите товары'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        {calculationResults && (
          <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Результаты - {calculationResults.idn_quote || calculationResults.quote_number}
              </CardTitle>
              <Badge variant="default">Итого: ₽{calculationResults.total_amount?.toFixed(2)}</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Показаны все промежуточные расчеты для тестирования
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">Товар</th>
                      <th className="text-right py-2 px-2 font-medium">Кол-во</th>
                      <th className="text-right py-2 px-2 font-medium">С НДС</th>
                      <th className="text-right py-2 px-2 font-medium">Без НДС</th>
                      <th className="text-right py-2 px-2 font-medium">Закупка ₽</th>
                      <th className="text-right py-2 px-2 font-medium">Логистика</th>
                      <th className="text-right py-2 px-2 font-medium">С/с</th>
                      <th className="text-right py-2 px-2 font-medium">Итого СБС</th>
                      <th className="text-right py-2 px-2 font-medium">Продажа</th>
                      <th className="text-right py-2 px-2 font-medium">Маржа</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(calculationResults.items || []).map(
                      (item: ProductCalculationResult, idx: number) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2 px-2">{item.product_name}</td>
                          <td className="py-2 px-2 text-right">{item.quantity}</td>
                          <td className="py-2 px-2 text-right">
                            {item.base_price_vat?.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {item.base_price_no_vat?.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {item.purchase_price_rub?.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {item.logistics_costs?.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right">{item.cogs?.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right font-medium">
                            {item.total_cost?.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right font-medium">
                            {item.sale_price?.toFixed(2)}
                          </td>
                          <td
                            className={`py-2 px-2 text-right font-medium ${(item.margin || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {item.margin?.toFixed(2)}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bulk Edit Modal */}
      <Dialog open={bulkEditModalVisible} onOpenChange={setBulkEditModalVisible}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Массовое редактирование</DialogTitle>
            <DialogDescription>
              Выбрано строк: {gridRef.current?.api?.getSelectedNodes()?.length || 0}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Выберите поле для редактирования</Label>
              <Select
                value={bulkEditField}
                onValueChange={(v: string) => {
                  setBulkEditField(v);
                  setBulkEditValue('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите поле" />
                </SelectTrigger>
                <SelectContent>
                  {bulkEditFields.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bulkEditField && (
              <div className="space-y-2">
                <Label>Новое значение</Label>
                {bulkEditField === 'currency_of_base_price' ? (
                  <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите валюту" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRY">TRY (Турецкая лира)</SelectItem>
                      <SelectItem value="USD">USD (Доллар США)</SelectItem>
                      <SelectItem value="EUR">EUR (Евро)</SelectItem>
                      <SelectItem value="CNY">CNY (Юань)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : bulkEditField === 'supplier_country' || bulkEditField === 'customs_code' ? (
                  <Input
                    value={bulkEditValue}
                    onChange={(e) => setBulkEditValue(e.target.value)}
                    placeholder="Введите значение"
                  />
                ) : (
                  <Input
                    type="number"
                    value={bulkEditValue}
                    onChange={(e) => setBulkEditValue(parseFloat(e.target.value) || '')}
                    placeholder="Введите числовое значение"
                    step={bulkEditField.includes('rate') ? '0.0001' : '0.01'}
                  />
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkEditModalVisible(false);
                setBulkEditField('');
                setBulkEditValue('');
              }}
            >
              Отмена
            </Button>
            <Button onClick={applyBulkEdit}>Применить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column Chooser Modal */}
      <Dialog open={columnChooserVisible} onOpenChange={setColumnChooserVisible}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Управление колонками</DialogTitle>
          </DialogHeader>

          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {gridRef.current?.api?.getAllGridColumns()?.map((column: any) => {
              const colId = column.getColId();
              const colDef = column.getColDef();
              const headerName = colDef.headerName || colId;
              const isVisible = column.isVisible();

              if (colId === 'checkbox') return null;

              return (
                <div
                  key={`${colId}-${columnVisibilityRefresh}`}
                  className="flex items-center gap-2"
                >
                  <Checkbox
                    checked={isVisible}
                    onCheckedChange={(checked: boolean) => {
                      gridRef.current?.api?.setColumnsVisible([colId], checked as boolean);
                      setColumnVisibilityRefresh((prev) => prev + 1);
                    }}
                  />
                  <span className="text-sm">{headerName}</span>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button onClick={() => setColumnChooserVisible(false)}>Готово</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Save Modal */}
      <Dialog open={templateSaveModalVisible} onOpenChange={setTemplateSaveModalVisible}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Сохранить шаблон</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Выберите действие</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={templateSaveMode === 'new'}
                    onChange={() => setTemplateSaveMode('new')}
                  />
                  <span>Создать новый шаблон</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={templateSaveMode === 'update'}
                    onChange={() => setTemplateSaveMode('update')}
                    disabled={templates.length === 0}
                  />
                  <span>Обновить существующий шаблон</span>
                </label>
              </div>
            </div>

            {templateSaveMode === 'new' && (
              <div className="space-y-2">
                <Label>Название нового шаблона</Label>
                <Input
                  value={templateNewName}
                  onChange={(e) => setTemplateNewName(e.target.value)}
                  placeholder="Введите название"
                />
              </div>
            )}

            {templateSaveMode === 'update' && (
              <div className="space-y-2">
                <Label>Выберите шаблон для обновления</Label>
                <Select value={templateUpdateId} onValueChange={setTemplateUpdateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите шаблон" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateSaveModalVisible(false)}>
              Отмена
            </Button>
            <Button onClick={performTemplateSave}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
