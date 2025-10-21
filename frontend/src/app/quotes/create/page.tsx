'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Upload,
  Table,
  Typography,
  Row,
  Col,
  message,
  InputNumber,
  Space,
  Spin,
  Tag,
  Modal,
  Radio,
  Divider,
  Checkbox,
  Alert,
} from 'antd';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef, ColGroupDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register AG Grid modules (required for v34+)
ModuleRegistry.registerModules([AllCommunityModule]);
import {
  InboxOutlined,
  SaveOutlined,
  CalculatorOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined,
  EditOutlined,
  AppstoreOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { UploadFile, UploadProps } from 'antd';
import MainLayout from '@/components/layout/MainLayout';
import {
  quotesCalcService,
  Product,
  VariableTemplate,
  CalculationVariables,
} from '@/lib/api/quotes-calc-service';
import { customerService, Customer } from '@/lib/api/customer-service';
import {
  calculationSettingsService,
  CalculationSettings,
} from '@/lib/api/calculation-settings-service';

const { Title, Text } = Typography;
const { Dragger } = Upload;

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

// CSS for compact form styling
const compactFormStyles = `
  .compact-form .ant-form-item {
    margin-bottom: 12px;
  }
  .compact-form .ant-form-item-label > label {
    font-size: 12px;
    height: auto;
  }
`;

// Helper function to parse decimal input with comma or period separator
const parseDecimalInput = (value: string): number | null => {
  if (!value || value === '') return null;
  // Replace comma with period for parsing
  const normalized = value.toString().replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
};

export default function CreateQuotePage() {
  const router = useRouter();
  const [form] = Form.useForm<CalculationVariables>();
  const gridRef = useRef<AgGridReact>(null);

  // State
  const [loading, setLoading] = useState(false);
  const [uploadedProducts, setUploadedProducts] = useState<Product[]>([]);
  const [uploadedFile, setUploadedFile] = useState<UploadFile | null>(null);
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

  // Load customers, templates, and admin settings on mount
  useEffect(() => {
    loadCustomers();
    loadTemplates();
    loadAdminSettings();

    // Set default values
    const defaultVars = quotesCalcService.getDefaultVariables();
    form.setFieldsValue(defaultVars);
  }, []);

  // Auto-calculate logistics breakdown when in "total" mode
  const handleLogisticsTotalChange = (value: number | null) => {
    if (logisticsMode === 'total' && value) {
      form.setFieldsValue({
        logistics_supplier_hub: value * 0.5, // 50%
        logistics_hub_customs: value * 0.3, // 30%
        logistics_customs_client: value * 0.2, // 20%
      });
    }
  };

  const loadCustomers = async () => {
    const result = await customerService.listCustomers();
    if (result.success && result.data) {
      setCustomers(result.data.customers);
    } else {
      message.error(`Ошибка загрузки клиентов: ${result.error}`);
    }
  };

  const loadTemplates = async () => {
    console.log('Loading templates...');
    try {
      const result = await quotesCalcService.listTemplates();
      console.log('Templates list result:', result);

      if (result.success && result.data) {
        setTemplates(result.data);
        console.log('Templates loaded:', result.data.length, 'templates');
      } else {
        console.error('Templates load failed:', result.error);
        message.error(`Ошибка загрузки шаблонов: ${result.error}`);
      }
    } catch (error) {
      console.error('Templates load error:', error);
      message.error('Ошибка при загрузке шаблонов');
    }
  };

  const loadAdminSettings = async () => {
    const result = await calculationSettingsService.getSettings();
    if (result.success && result.data) {
      setAdminSettings(result.data);
      // Pre-fill admin-only fields from settings
      form.setFieldsValue({
        rate_forex_risk: result.data.rate_forex_risk,
        rate_fin_comm: result.data.rate_fin_comm,
        rate_loan_interest_daily: result.data.rate_loan_interest_daily,
      });
    }
  };

  // File upload handlers
  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      const result = await quotesCalcService.uploadProducts(file);

      if (result.success && result.data) {
        setUploadedProducts(result.data.products);
        setUploadedFile({
          uid: Date.now().toString(),
          name: file.name,
          status: 'done',
        } as UploadFile);
        message.success(`Загружено ${result.data.total_count} товаров`);
        return true;
      } else {
        message.error(`Ошибка загрузки файла: ${result.error}`);
        return false;
      }
    } catch (error: any) {
      message.error(`Ошибка: ${error.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    maxCount: 1,
    accept: '.xlsx,.xls,.csv',
    customRequest: async ({ file, onSuccess, onError }) => {
      const uploadFile = file as File;

      if (!quotesCalcService.isValidFileType(uploadFile)) {
        message.error('Поддерживаются только файлы Excel (.xlsx, .xls) и CSV (.csv)');
        if (onError) onError(new Error('Invalid file type'));
        return;
      }

      const success = await handleFileUpload(uploadFile);
      if (success) {
        if (onSuccess) onSuccess('ok');
      } else {
        if (onError) onError(new Error('Upload failed'));
      }
    },
    onRemove: () => {
      setUploadedProducts([]);
      setUploadedFile(null);
    },
    fileList: uploadedFile ? [uploadedFile] : [],
    showUploadList: true,
  };

  // Template selection handler
  const handleTemplateSelect = async (templateId: string) => {
    console.log('Template select called with ID:', templateId);
    setSelectedTemplate(templateId);

    try {
      const result = await quotesCalcService.getTemplate(templateId);
      console.log('Template load result:', result);

      if (result.success && result.data) {
        // Merge template variables with current form values
        const templateVars = result.data.variables;
        console.log('Template variables:', templateVars);
        form.setFieldsValue(templateVars as any);
        message.success(`Шаблон "${result.data.name}" загружен`);
      } else {
        console.error('Template load failed:', result.error);
        message.error(`Ошибка загрузки шаблона: ${result.error}`);
      }
    } catch (error) {
      console.error('Template select error:', error);
      message.error('Ошибка при загрузке шаблона');
    }
  };

  // Open template save modal
  const handleSaveTemplate = () => {
    console.log('Save template clicked');
    setTemplateNewName('');
    setTemplateUpdateId('');
    setTemplateSaveMode('new');
    setTemplateSaveModalVisible(true);
  };

  // Perform template save/update
  const performTemplateSave = async () => {
    console.log('=== performTemplateSave called ===');
    console.log('templateSaveMode:', templateSaveMode);
    console.log('templateUpdateId:', templateUpdateId);
    console.log('templateNewName:', templateNewName);

    const variables = form.getFieldsValue();
    console.log('Form values to save:', variables);

    try {
      let result;

      if (templateSaveMode === 'update' && templateUpdateId) {
        console.log('>>> ENTERING UPDATE BRANCH');
        // Update existing template
        const existingTemplate = templates.find((t) => t.id === templateUpdateId);
        console.log('existingTemplate found:', existingTemplate);

        if (!existingTemplate) {
          message.error('Шаблон не найден');
          return;
        }

        console.log('Calling updateTemplate with ID:', templateUpdateId);
        result = await quotesCalcService.updateTemplate(templateUpdateId, {
          name: existingTemplate.name,
          description: `Обновлено ${new Date().toLocaleDateString()}`,
          variables: variables,
          is_default: existingTemplate.is_default,
        });
        console.log('Template update result:', result);
      } else {
        // Create new template
        if (!templateNewName.trim()) {
          message.error('Введите название шаблона');
          return;
        }

        result = await quotesCalcService.createTemplate({
          name: templateNewName,
          description: `Создано ${new Date().toLocaleDateString()}`,
          variables: variables,
          is_default: false,
        });
        console.log('Template create result:', result);
      }

      if (result.success) {
        message.success(templateSaveMode === 'update' ? 'Шаблон обновлен' : 'Шаблон создан');
        await loadTemplates(); // Reload templates list

        // Select the saved/updated template
        if (result.data?.id) {
          setSelectedTemplate(result.data.id);
        }

        setTemplateSaveModalVisible(false);
        console.log('Templates reloaded after save');
      } else {
        console.error('Template save failed:', result.error);
        message.error(`Ошибка сохранения: ${result.error}`);
      }
    } catch (error) {
      console.error('Template save error:', error);
      message.error('Ошибка при сохранении шаблона');
    }
  };

  // Apply quote-level defaults to products before sending to API
  // Two-tier system: product override > quote default > fallback
  const applyQuoteDefaultsToProducts = (
    products: Product[],
    quoteDefaults: CalculationVariables
  ): Product[] => {
    return products.map((product) => ({
      ...product,
      // Financial defaults (both Product and CalculationVariables have these)
      currency_of_base_price:
        product.currency_of_base_price || quoteDefaults.currency_of_base_price || 'USD',
      exchange_rate_base_price_to_quote:
        product.exchange_rate_base_price_to_quote ||
        quoteDefaults.exchange_rate_base_price_to_quote ||
        1.0,
      supplier_discount: product.supplier_discount ?? 0, // Product-only field, default to 0 if not set
      markup: product.markup ?? quoteDefaults.markup ?? 0,

      // Logistics defaults
      supplier_country: product.supplier_country || quoteDefaults.supplier_country || 'Турция',

      // Customs defaults
      customs_code: product.customs_code || quoteDefaults.customs_code || '',
      import_tariff: product.import_tariff ?? quoteDefaults.import_tariff ?? 0,
      excise_tax: product.excise_tax ?? quoteDefaults.excise_tax ?? 0,
    }));
  };

  // Calculate quote
  const handleCalculate = async () => {
    if (!selectedCustomer) {
      message.error('Выберите клиента');
      return;
    }

    if (uploadedProducts.length === 0) {
      message.error('Загрузите файл с товарами');
      return;
    }

    setLoading(true);
    try {
      const variables = form.getFieldsValue();

      // Apply quote-level defaults to products BEFORE sending to API
      const productsWithDefaults = applyQuoteDefaultsToProducts(uploadedProducts, variables);

      const result = await quotesCalcService.calculateQuote({
        customer_id: selectedCustomer,
        products: productsWithDefaults,
        variables: variables as CalculationVariables,
        title: `Коммерческое предложение от ${new Date().toLocaleDateString()}`,
      });

      if (result.success && result.data) {
        setCalculationResults(result.data);
        message.success(`Расчет выполнен! Котировка №${result.data.quote_number}`);
      } else {
        message.error(`Ошибка расчета: ${result.error}`);
      }
    } catch (error: any) {
      message.error(`Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ag-Grid column definitions with groups
  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(
    () => [
      // Checkbox selection column - PINNED LEFT
      {
        headerCheckboxSelection: true,
        checkboxSelection: true,
        width: 50,
        pinned: 'left',
        lockPosition: true,
        suppressMenu: true,
        resizable: false,
      },
      // Group 1: Product Info (Always Editable)
      {
        headerName: 'Информация о товаре',
        children: [
          {
            field: 'sku',
            headerName: 'Артикул',
            width: 120,
            pinned: 'left', // Always visible
            editable: true,
            cellStyle: { backgroundColor: '#fff' },
          },
          {
            field: 'brand',
            headerName: 'Бренд',
            width: 120,
            pinned: 'left', // Always visible
            editable: true,
            cellStyle: { backgroundColor: '#fff' },
          },
          {
            field: 'product_name',
            headerName: 'Наименование',
            width: 200,
            pinned: 'left', // Always visible
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
            valueFormatter: (params) => params.value?.toFixed(2) || '',
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
            valueFormatter: (params) => params.value?.toFixed(2) || '-',
            valueParser: (params) => parseDecimalInput(params.newValue),
          },
        ],
      },
      // Group 2: Product Defaults (Can Override)
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
            valueFormatter: (params) => params.value?.toFixed(2) || '',
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
            valueFormatter: (params) => params.value?.toFixed(4) || '',
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
            valueFormatter: (params) => params.value?.toFixed(2) || '',
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
            valueFormatter: (params) => params.value?.toFixed(2) || '',
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
            valueFormatter: (params) => params.value?.toFixed(2) || '',
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
            valueFormatter: (params) => params.value?.toFixed(2) || '',
            valueParser: (params) => parseDecimalInput(params.newValue),
          },
        ],
      },
    ],
    []
  );

  // Default column properties
  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      floatingFilter: true, // Enable floating filter row below headers
      floatingFilterComponentParams: {
        suppressFilterButton: false, // Show filter menu button
      },
      filterParams: {
        buttons: ['clear'], // Add clear button to filter menu
      },
      enableCellChangeFlash: true,
    }),
    []
  );

  // Bulk edit handler for applying value to selected rows
  const handleBulkEdit = useCallback(
    (field: string, value: any) => {
      const selectedNodes = gridRef.current?.api.getSelectedNodes();
      if (!selectedNodes || selectedNodes.length === 0) {
        message.warning('Выберите строки для применения значения');
        return;
      }

      const updatedProducts = [...uploadedProducts];
      selectedNodes.forEach((node) => {
        if (node.rowIndex !== null && node.rowIndex !== undefined) {
          updatedProducts[node.rowIndex] = {
            ...updatedProducts[node.rowIndex],
            [field]: value,
          };
        }
      });

      setUploadedProducts(updatedProducts);
      gridRef.current?.api.refreshCells({ force: true });
      message.success(`Значение применено к ${selectedNodes.length} строкам`);
    },
    [uploadedProducts]
  );

  // Open bulk edit modal
  const openBulkEditModal = () => {
    const selectedNodes = gridRef.current?.api.getSelectedNodes();
    if (!selectedNodes || selectedNodes.length === 0) {
      message.warning('Выберите строки для массового редактирования');
      return;
    }
    setBulkEditModalVisible(true);
  };

  // Apply bulk edit
  const applyBulkEdit = () => {
    if (!bulkEditField) {
      message.error('Выберите поле для редактирования');
      return;
    }

    handleBulkEdit(bulkEditField, bulkEditValue);
    setBulkEditModalVisible(false);
    setBulkEditField('');
    setBulkEditValue('');
  };

  // Bulk editable fields
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

  return (
    <MainLayout>
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/quotes')}>
                Назад
              </Button>
              <Title level={2} style={{ margin: 0 }}>
                Создать котировку
              </Title>
            </Space>
          </Col>
          {/* Admin Settings - Minimal Horizontal Display */}
          {adminSettings && (
            <Col>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <InfoCircleOutlined style={{ fontSize: '11px', marginRight: 4 }} />
                Резерв: {adminSettings.rate_forex_risk.toFixed(2)}% | Комиссия ФА:{' '}
                {adminSettings.rate_fin_comm.toFixed(2)}% | Годовая ставка:{' '}
                {(
                  calculationSettingsService.dailyToAnnualRate(
                    adminSettings.rate_loan_interest_daily
                  ) * 100
                ).toFixed(2)}
                %
              </Text>
            </Col>
          )}
        </Row>

        {/* Requirements Alert - Show when customer or products are missing */}
        {(!selectedCustomer || uploadedProducts.length === 0) && !calculationResults && (
          <Alert
            message="Чтобы рассчитать котировку"
            description={
              <div>
                {!selectedCustomer && <div>• Выберите клиента из списка ниже</div>}
                {uploadedProducts.length === 0 && (
                  <div>• Загрузите файл с товарами (Excel или CSV)</div>
                )}
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Spin spinning={loading}>
          <Form
            form={form}
            layout="vertical"
            size="small"
            className="compact-form"
            onFinish={handleCalculate}
          >
            {/* Top Section - Form Cards (Full Width) */}
            <Row gutter={24}>
              <Col span={24}>
                {/* Template & Customer Selector - Compact Inline */}
                <Row
                  gutter={12}
                  align="middle"
                  style={{
                    marginBottom: 16,
                    padding: '8px 12px',
                    background: '#fafafa',
                    borderRadius: '4px',
                  }}
                >
                  <Col>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Шаблон:
                    </Text>
                  </Col>
                  <Col flex="auto" style={{ maxWidth: '300px' }}>
                    <Select
                      size="small"
                      placeholder="Выберите шаблон"
                      value={selectedTemplate}
                      onChange={handleTemplateSelect}
                      allowClear
                      style={{ width: '100%' }}
                      options={templates.map((t) => ({
                        label: `${t.name}${t.is_default ? ' (по умолч.)' : ''}`,
                        value: t.id,
                      }))}
                    />
                  </Col>
                  <Col>
                    <Button
                      size="small"
                      type="text"
                      icon={<SaveOutlined />}
                      onClick={handleSaveTemplate}
                    >
                      Сохранить
                    </Button>
                  </Col>
                  <Col>
                    <Divider type="vertical" style={{ height: '24px', margin: '0 8px' }} />
                  </Col>
                  <Col>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Клиент:
                    </Text>
                  </Col>
                  <Col flex="auto" style={{ maxWidth: '300px' }}>
                    <Select
                      size="small"
                      showSearch
                      placeholder="Выберите клиента"
                      value={selectedCustomer}
                      onChange={setSelectedCustomer}
                      optionFilterProp="children"
                      style={{ width: '100%' }}
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={customers.map((c) => ({
                        label: `${c.name} (${c.inn || 'без ИНН'})`,
                        value: c.id,
                      }))}
                    />
                  </Col>
                </Row>

                {/* Variables Form - Grid of Cards */}
                <Text
                  type="secondary"
                  style={{ display: 'block', marginBottom: 16, fontSize: '14px' }}
                >
                  🔧 Параметры котировки по умолчанию - эти значения будут применены ко всем
                  товарам. Вы сможете переопределить их для отдельных товаров в таблице.
                </Text>

                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  {/* 1. Company & Payment Combined Card */}
                  <Col xs={24} lg={12}>
                    <Card
                      title="🏢 Настройки компании и оплата"
                      size="small"
                      style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                      bodyStyle={{ padding: '12px' }}
                    >
                      <Row gutter={[12, 8]}>
                        {/* Company Settings Section */}
                        <Col span={24}>
                          <Text
                            strong
                            style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}
                          >
                            Компания
                          </Text>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="seller_company" label="Компания-продавец">
                            <Input placeholder="МАСТЕР БЭРИНГ ООО" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="offer_sale_type" label="Вид КП">
                            <Select>
                              <Select.Option value="поставка">Поставка</Select.Option>
                              <Select.Option value="комиссия">Комиссия</Select.Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="currency_of_quote" label="Валюта КП">
                            <Select>
                              <Select.Option value="RUB">RUB (Рубль)</Select.Option>
                              <Select.Option value="USD">USD</Select.Option>
                              <Select.Option value="EUR">EUR</Select.Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="offer_incoterms" label="Базис поставки">
                            <Select>
                              <Select.Option value="DDP">DDP</Select.Option>
                              <Select.Option value="EXW">EXW</Select.Option>
                              <Select.Option value="FCA">FCA</Select.Option>
                              <Select.Option value="DAP">DAP</Select.Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="delivery_time" label="Срок поставки (дни)">
                            <InputNumber
                              min={0}
                              step={1}
                              style={{ width: '100%' }}
                              addonAfter="дн"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="markup" label="Наценка (%)">
                            <InputNumber
                              min={0}
                              max={500}
                              step={1}
                              style={{ width: '100%' }}
                              addonAfter="%"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name="exchange_rate_base_price_to_quote"
                            label="Курс к валюте КП"
                          >
                            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>

                        {/* Payment Terms - Basic (always visible) */}
                        <Col span={24} style={{ marginTop: 12 }}>
                          <Text
                            strong
                            style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}
                          >
                            Условия оплаты
                          </Text>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="advance_from_client" label="Аванс от клиента (%)">
                            <InputNumber
                              min={0}
                              max={100}
                              style={{ width: '100%' }}
                              addonAfter="%"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name="time_to_advance_on_receiving"
                            label="Дней от получения до оплаты"
                          >
                            <InputNumber min={0} addonAfter="дн" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>

                        {/* Advanced Payment Fields Toggle */}
                        <Col span={24}>
                          <Button
                            type="link"
                            size="small"
                            onClick={() => setShowAdvancedPayment(!showAdvancedPayment)}
                            style={{ padding: 0 }}
                          >
                            {showAdvancedPayment
                              ? '▼ Скрыть дополнительные условия оплаты'
                              : '▶ Показать дополнительные условия оплаты'}
                          </Button>
                        </Col>

                        {/* Advanced Payment Fields (conditionally rendered) */}
                        {showAdvancedPayment && (
                          <>
                            <Col span={12}>
                              <Form.Item name="time_to_advance" label="Дней до аванса">
                                <InputNumber min={0} addonAfter="дн" style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="advance_to_supplier" label="Аванс поставщику (%)">
                                <InputNumber
                                  min={0}
                                  max={100}
                                  style={{ width: '100%' }}
                                  addonAfter="%"
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item
                                name="advance_on_loading"
                                label="Аванс при заборе груза (%)"
                              >
                                <InputNumber
                                  min={0}
                                  max={100}
                                  style={{ width: '100%' }}
                                  addonAfter="%"
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item
                                name="time_to_advance_loading"
                                label="Дней от забора до аванса"
                              >
                                <InputNumber min={0} addonAfter="дн" style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item
                                name="advance_on_going_to_country_destination"
                                label="Аванс при отправке в РФ (%)"
                              >
                                <InputNumber
                                  min={0}
                                  max={100}
                                  style={{ width: '100%' }}
                                  addonAfter="%"
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item
                                name="time_to_advance_going_to_country_destination"
                                label="Дней от отправки до аванса"
                              >
                                <InputNumber min={0} addonAfter="дн" style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item
                                name="advance_on_customs_clearance"
                                label="Аванс при прохождении таможни (%)"
                              >
                                <InputNumber
                                  min={0}
                                  max={100}
                                  style={{ width: '100%' }}
                                  addonAfter="%"
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item
                                name="time_to_advance_on_customs_clearance"
                                label="Дней от таможни до аванса"
                              >
                                <InputNumber min={0} addonAfter="дн" style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                          </>
                        )}

                        {/* LPR Compensation - Collapsible (at bottom) */}
                        <Col span={24} style={{ marginTop: 16 }}>
                          <Button
                            type="link"
                            size="small"
                            onClick={() => setShowLprCompensation(!showLprCompensation)}
                            style={{ padding: 0 }}
                          >
                            {showLprCompensation
                              ? '▼ Скрыть вознаграждение ЛПР'
                              : '▶ Показать вознаграждение ЛПР'}
                          </Button>
                        </Col>

                        {/* LPR Fields (conditionally rendered) */}
                        {showLprCompensation && (
                          <>
                            <Col span={12}>
                              <Form.Item name="dm_fee_type" label="Тип вознаграждения ЛПР">
                                <Select>
                                  <Select.Option value="fixed">Фиксированная сумма</Select.Option>
                                  <Select.Option value="percentage">Процент</Select.Option>
                                </Select>
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="dm_fee_value" label="Размер вознаграждения">
                                <InputNumber min={0} step={100} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                          </>
                        )}
                      </Row>
                    </Card>
                  </Col>

                  {/* 2. Logistics & Customs Card */}
                  <Col xs={24} lg={12}>
                    <Card
                      title="🚚 Логистика и таможня"
                      size="small"
                      style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                      bodyStyle={{ padding: '12px' }}
                    >
                      <Row gutter={[12, 8]}>
                        {/* Logistics Section */}
                        <Col span={24}>
                          <Text
                            strong
                            style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}
                          >
                            Логистика
                          </Text>
                        </Col>

                        {/* Toggle between Total and Detailed */}
                        <Col span={24}>
                          <Radio.Group
                            value={logisticsMode}
                            onChange={(e) => setLogisticsMode(e.target.value)}
                            size="small"
                            style={{ marginBottom: 12 }}
                          >
                            <Radio.Button value="total">Итого</Radio.Button>
                            <Radio.Button value="detailed">Детально</Radio.Button>
                          </Radio.Group>
                        </Col>

                        {/* Total Logistics Field (when mode = total) */}
                        {logisticsMode === 'total' && (
                          <Col span={24}>
                            <Form.Item name="logistics_total" label="Логистика всего (₽)">
                              <InputNumber
                                min={0}
                                step={100}
                                style={{ width: '100%' }}
                                addonAfter="₽"
                                onChange={handleLogisticsTotalChange}
                              />
                            </Form.Item>
                          </Col>
                        )}

                        {/* Detailed Logistics Fields (always present, disabled when mode = total) */}
                        <Col span={12}>
                          <Form.Item name="logistics_supplier_hub" label="Поставщик - Турция (50%)">
                            <InputNumber
                              min={0}
                              step={100}
                              style={{ width: '100%' }}
                              addonAfter="₽"
                              disabled={logisticsMode === 'total'}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="logistics_hub_customs" label="Турция - Таможня РФ (30%)">
                            <InputNumber
                              min={0}
                              step={100}
                              style={{ width: '100%' }}
                              addonAfter="₽"
                              disabled={logisticsMode === 'total'}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name="logistics_customs_client"
                            label="Таможня РФ - Клиент (20%)"
                          >
                            <InputNumber
                              min={0}
                              step={100}
                              style={{ width: '100%' }}
                              addonAfter="₽"
                              disabled={logisticsMode === 'total'}
                            />
                          </Form.Item>
                        </Col>

                        {/* Divider between Logistics and Brokerage */}
                        <Col span={24}>
                          <Divider style={{ margin: '12px 0' }} />
                        </Col>

                        {/* Brokerage Section Toggle */}
                        <Col span={24}>
                          <Button
                            type="link"
                            size="small"
                            onClick={() => setShowBrokerage(!showBrokerage)}
                            style={{ padding: 0 }}
                          >
                            {showBrokerage ? '▼ Скрыть брокеридж' : '▶ Показать брокеридж'}
                          </Button>
                        </Col>

                        {/* Brokerage Fields (conditionally rendered) */}
                        {showBrokerage && (
                          <>
                            <Col span={12}>
                              <Form.Item name="brokerage_hub" label="Брокерские Турция (₽)">
                                <InputNumber
                                  min={0}
                                  step={100}
                                  style={{ width: '100%' }}
                                  addonAfter="₽"
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="brokerage_customs" label="Брокерские РФ (₽)">
                                <InputNumber
                                  min={0}
                                  step={100}
                                  style={{ width: '100%' }}
                                  addonAfter="₽"
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="warehousing_at_customs" label="Расходы на СВХ (₽)">
                                <InputNumber
                                  min={0}
                                  step={100}
                                  style={{ width: '100%' }}
                                  addonAfter="₽"
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item
                                name="customs_documentation"
                                label="Разрешительные документы (₽)"
                              >
                                <InputNumber
                                  min={0}
                                  step={100}
                                  style={{ width: '100%' }}
                                  addonAfter="₽"
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="brokerage_extra" label="Прочие расходы (₽)">
                                <InputNumber
                                  min={0}
                                  step={100}
                                  style={{ width: '100%' }}
                                  addonAfter="₽"
                                />
                              </Form.Item>
                            </Col>
                          </>
                        )}
                      </Row>
                    </Card>
                  </Col>

                  {/* 3. Customs Clearance Card */}
                  <Col xs={24} lg={12}>
                    <Card
                      title="🛃 Таможенная очистка"
                      size="small"
                      style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                      bodyStyle={{ padding: '12px' }}
                    >
                      <Text
                        type="secondary"
                        style={{ display: 'block', marginBottom: 8, fontSize: '12px' }}
                      >
                        Значения по умолчанию для таможенной очистки
                      </Text>
                      <Row gutter={[12, 8]}>
                        <Col span={24}>
                          <Form.Item name="customs_code" label="Код ТН ВЭД">
                            <Input placeholder="8482102009" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="import_tariff" label="Пошлина (%)">
                            <InputNumber
                              min={0}
                              max={100}
                              step={0.1}
                              style={{ width: '100%' }}
                              addonAfter="%"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="excise_tax" label="Акциз (УЕ КП на тонну)">
                            <InputNumber
                              min={0}
                              max={100}
                              step={0.1}
                              style={{ width: '100%' }}
                              addonAfter="%"
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  </Col>

                  {/* 4. Product Defaults Card */}
                  <Col xs={24} lg={12}>
                    <Card
                      title="📦 Значения по умолчанию для товаров"
                      size="small"
                      style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                      bodyStyle={{ padding: '12px' }}
                    >
                      <Text
                        type="secondary"
                        style={{ display: 'block', marginBottom: 8, fontSize: '12px' }}
                      >
                        Эти значения можно переопределить для каждого товара в таблице
                      </Text>
                      <Row gutter={[12, 8]}>
                        <Col span={12}>
                          <Form.Item name="currency_of_base_price" label="Валюта цены закупки">
                            <Select>
                              <Select.Option value="TRY">TRY (Турецкая лира)</Select.Option>
                              <Select.Option value="USD">USD (Доллар США)</Select.Option>
                              <Select.Option value="EUR">EUR (Евро)</Select.Option>
                              <Select.Option value="CNY">CNY (Юань)</Select.Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="supplier_country" label="Страна закупки">
                            <Input placeholder="Турция" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="supplier_discount" label="Скидка поставщика (%)">
                            <InputNumber
                              min={0}
                              max={100}
                              step={0.1}
                              style={{ width: '100%' }}
                              addonAfter="%"
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                </Row>
              </Col>
            </Row>

            {/* File Upload Row */}
            <Row gutter={24} style={{ marginTop: 24 }}>
              <Col span={24}>
                {/* File Upload */}
                <Card title="📁 Загрузить товары">
                  <Dragger {...uploadProps}>
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">Нажмите или перетащите файл Excel/CSV</p>
                    <p className="ant-upload-hint">Поддерживаются форматы: .xlsx, .xls, .csv</p>
                  </Dragger>
                  {uploadedProducts.length > 0 && (
                    <Text strong style={{ display: 'block', marginTop: 16 }}>
                      Загружено товаров: {uploadedProducts.length}
                    </Text>
                  )}
                </Card>
              </Col>
            </Row>

            {/* Products Grid Section (Full Width) */}
            {uploadedProducts.length > 0 && (
              <Row gutter={24} style={{ marginTop: 24 }}>
                <Col span={24}>
                  <Card
                    title="📋 Загруженные товары"
                    extra={
                      <Space>
                        <Button icon={<EditOutlined />} onClick={openBulkEditModal} size="small">
                          Массовое редактирование
                        </Button>
                        <Button
                          icon={<FilterOutlined />}
                          onClick={() => {
                            // Clear all filters
                            gridRef.current?.api?.setFilterModel(null);
                            // Close all filter menus
                            gridRef.current?.api?.getAllGridColumns()?.forEach((column) => {
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              const api = gridRef.current?.api as any;
                              const filterInstance = api?.getFilterInstance(column.getColId());
                              if (filterInstance) {
                                filterInstance.setModel(null);
                                api?.destroyFilter(column.getColId());
                              }
                            });
                            message.success('Фильтры очищены');
                          }}
                          size="small"
                        >
                          Очистить фильтры
                        </Button>
                        <Button
                          icon={<AppstoreOutlined />}
                          onClick={() => setColumnChooserVisible(true)}
                          size="small"
                        >
                          Колонки
                        </Button>
                      </Space>
                    }
                  >
                    <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                      💡 Совет: Выберите строки, затем используйте &quot;Массовое
                      редактирование&quot; или Ctrl+C/Ctrl+V для копирования из Excel
                    </Text>
                    <style>
                      {agGridRowSelectionStyles}
                      {compactFormStyles}
                    </style>
                    <div className="ag-theme-alpine" style={{ height: 500, width: '100%' }}>
                      <AgGridReact
                        ref={gridRef}
                        rowData={uploadedProducts}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        animateRows={true}
                        rowSelection="multiple"
                        enableCellTextSelection={true}
                        suppressRowClickSelection={true}
                        suppressHorizontalScroll={false}
                        onCellValueChanged={(event) => {
                          setUploadedProducts((prevProducts) => {
                            const updatedProducts = [...prevProducts];
                            const index = event.rowIndex;
                            if (index !== null && index !== undefined) {
                              updatedProducts[index] = event.data;
                            }
                            return updatedProducts;
                          });
                        }}
                      />
                    </div>
                  </Card>
                </Col>
              </Row>
            )}

            {/* Calculate Button */}
            <Row gutter={24} style={{ marginTop: 24 }}>
              <Col span={24}>
                <Card>
                  <Button
                    type="primary"
                    icon={<CalculatorOutlined />}
                    size="large"
                    block
                    onClick={handleCalculate}
                    disabled={!selectedCustomer || uploadedProducts.length === 0}
                    loading={loading}
                  >
                    Рассчитать котировку
                  </Button>
                  {(!selectedCustomer || uploadedProducts.length === 0) && (
                    <Text
                      type="secondary"
                      style={{ display: 'block', marginTop: 8, textAlign: 'center' }}
                    >
                      {!selectedCustomer && 'Выберите клиента'}
                      {!selectedCustomer && uploadedProducts.length === 0 && ' и '}
                      {uploadedProducts.length === 0 && 'загрузите товары'}
                    </Text>
                  )}
                </Card>
              </Col>
            </Row>

            {/* Results Section */}
            {calculationResults && (
              <Card
                title={`📊 Результаты - Котировка №${calculationResults.quote_number}`}
                style={{ marginTop: 24 }}
                extra={
                  <Space>
                    <Tag color="green">Итого: ₽{calculationResults.total_amount?.toFixed(2)}</Tag>
                  </Space>
                }
              >
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  Показаны все промежуточные расчеты для тестирования
                </Text>

                {/* Results Table */}
                <Table
                  dataSource={calculationResults.items || []}
                  rowKey={(record, index) => index?.toString() || '0'}
                  scroll={{ x: 1500 }}
                  pagination={false}
                  size="small"
                  summary={(pageData) => {
                    const totals = {
                      quantity: pageData.reduce((sum, item) => sum + (item.quantity || 0), 0),
                      purchase_price_rub: pageData.reduce(
                        (sum, item) => sum + (item.purchase_price_rub || 0),
                        0
                      ),
                      logistics_costs: pageData.reduce(
                        (sum, item) => sum + (item.logistics_costs || 0),
                        0
                      ),
                      cogs: pageData.reduce((sum, item) => sum + (item.cogs || 0), 0),
                      cogs_with_vat: pageData.reduce(
                        (sum, item) => sum + (item.cogs_with_vat || 0),
                        0
                      ),
                      import_duties: pageData.reduce(
                        (sum, item) => sum + (item.import_duties || 0),
                        0
                      ),
                      customs_fees: pageData.reduce(
                        (sum, item) => sum + (item.customs_fees || 0),
                        0
                      ),
                      financing_costs: pageData.reduce(
                        (sum, item) => sum + (item.financing_costs || 0),
                        0
                      ),
                      dm_fee: pageData.reduce((sum, item) => sum + (item.dm_fee || 0), 0),
                      total_cost: pageData.reduce((sum, item) => sum + (item.total_cost || 0), 0),
                      sale_price: pageData.reduce((sum, item) => sum + (item.sale_price || 0), 0),
                      margin: pageData.reduce((sum, item) => sum + (item.margin || 0), 0),
                    };

                    return (
                      <Table.Summary fixed>
                        <Table.Summary.Row
                          style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}
                        >
                          <Table.Summary.Cell index={0}>
                            <strong>ИТОГО СБС</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={1}>
                            <strong>{totals.quantity}</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2}>—</Table.Summary.Cell>
                          <Table.Summary.Cell index={3}>—</Table.Summary.Cell>
                          <Table.Summary.Cell index={4}>
                            <strong>{totals.purchase_price_rub.toFixed(2)}</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={5}>
                            <strong>{totals.logistics_costs.toFixed(2)}</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={6}>
                            <strong>{totals.cogs.toFixed(2)}</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={7}>
                            <strong>{totals.cogs_with_vat.toFixed(2)}</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={8}>
                            <strong>{totals.import_duties.toFixed(2)}</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={9}>
                            <strong>{totals.customs_fees.toFixed(2)}</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={10}>
                            <strong>{totals.financing_costs.toFixed(2)}</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={11}>
                            <strong>{totals.dm_fee.toFixed(2)}</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={12}>
                            <strong>{totals.total_cost.toFixed(2)}</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={13}>
                            <strong style={{ color: '#1890ff' }}>
                              {totals.sale_price.toFixed(2)}
                            </strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={14}>
                            <strong style={{ color: totals.margin > 0 ? 'green' : 'red' }}>
                              {totals.margin.toFixed(2)}
                            </strong>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      </Table.Summary>
                    );
                  }}
                  columns={[
                    {
                      title: 'Товар',
                      dataIndex: 'product_name',
                      key: 'product_name',
                      fixed: 'left' as any,
                      width: 200,
                    },
                    {
                      title: 'Кол-во',
                      dataIndex: 'quantity',
                      key: 'quantity',
                      width: 80,
                    },
                    {
                      title: 'С НДС',
                      dataIndex: 'base_price_vat',
                      key: 'base_price_vat',
                      width: 100,
                      render: (val: any) => (typeof val === 'number' ? val.toFixed(2) : val),
                    },
                    {
                      title: 'Без НДС',
                      dataIndex: 'base_price_no_vat',
                      key: 'base_price_no_vat',
                      width: 100,
                      render: (val: any) => (typeof val === 'number' ? val.toFixed(2) : val),
                    },
                    {
                      title: 'Закупка ₽',
                      dataIndex: 'purchase_price_rub',
                      key: 'purchase_price_rub',
                      width: 110,
                      render: (val: any) => (typeof val === 'number' ? val.toFixed(2) : val),
                    },
                    {
                      title: 'Логистика',
                      dataIndex: 'logistics_costs',
                      key: 'logistics_costs',
                      width: 110,
                      render: (val: any) => (typeof val === 'number' ? val.toFixed(2) : val),
                    },
                    {
                      title: 'С/с',
                      dataIndex: 'cogs',
                      key: 'cogs',
                      width: 100,
                      render: (val: any) => (typeof val === 'number' ? val.toFixed(2) : val),
                    },
                    {
                      title: 'С/с+НДС',
                      dataIndex: 'cogs_with_vat',
                      key: 'cogs_with_vat',
                      width: 110,
                      render: (val: any) => (typeof val === 'number' ? val.toFixed(2) : val),
                    },
                    {
                      title: 'Пошлина',
                      dataIndex: 'import_duties',
                      key: 'import_duties',
                      width: 100,
                      render: (val: any) => (typeof val === 'number' ? val.toFixed(2) : val),
                    },
                    {
                      title: 'Акциз+Утиль',
                      dataIndex: 'customs_fees',
                      key: 'customs_fees',
                      width: 110,
                      render: (val: any) => (typeof val === 'number' ? val.toFixed(2) : val),
                    },
                    {
                      title: 'Финансир',
                      dataIndex: 'financing_costs',
                      key: 'financing_costs',
                      width: 100,
                      render: (val: any) => (typeof val === 'number' ? val.toFixed(2) : val),
                    },
                    {
                      title: 'Вознагр',
                      dataIndex: 'dm_fee',
                      key: 'dm_fee',
                      width: 100,
                      render: (val: any) => (typeof val === 'number' ? val.toFixed(2) : val),
                    },
                    {
                      title: 'Итого СБС',
                      dataIndex: 'total_cost',
                      key: 'total_cost',
                      width: 110,
                      render: (val: any) =>
                        typeof val === 'number' ? <strong>{val.toFixed(2)}</strong> : val,
                    },
                    {
                      title: 'Продажа',
                      dataIndex: 'sale_price',
                      key: 'sale_price',
                      width: 110,
                      render: (val: any) =>
                        typeof val === 'number' ? (
                          <strong style={{ color: '#1890ff' }}>{val.toFixed(2)}</strong>
                        ) : (
                          val
                        ),
                    },
                    {
                      title: 'Маржа',
                      dataIndex: 'margin',
                      key: 'margin',
                      width: 100,
                      render: (val: any) =>
                        typeof val === 'number' ? (
                          <span style={{ color: val > 0 ? 'green' : 'red' }}>{val.toFixed(2)}</span>
                        ) : (
                          val
                        ),
                    },
                  ]}
                />
              </Card>
            )}
          </Form>
        </Spin>

        {/* Bulk Edit Modal */}
        <Modal
          title="Массовое редактирование"
          open={bulkEditModalVisible}
          onOk={applyBulkEdit}
          onCancel={() => {
            setBulkEditModalVisible(false);
            setBulkEditField('');
            setBulkEditValue('');
          }}
          okText="Применить"
          cancelText="Отмена"
          width={500}
          keyboard={true}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Text type="secondary">
              Выбрано строк:{' '}
              <strong>{gridRef.current?.api?.getSelectedNodes()?.length || 0}</strong>
            </Text>
            <Form layout="vertical">
              <Form.Item label="Выберите поле для редактирования" required>
                <Select
                  value={bulkEditField}
                  onChange={(value) => {
                    setBulkEditField(value);
                    setBulkEditValue('');
                  }}
                  placeholder="Выберите поле"
                  options={bulkEditFields}
                />
              </Form.Item>

              {bulkEditField && (
                <Form.Item label="Новое значение" required>
                  {bulkEditField === 'currency_of_base_price' ? (
                    <Select
                      value={bulkEditValue}
                      onChange={setBulkEditValue}
                      placeholder="Выберите валюту"
                      options={[
                        { value: 'TRY', label: 'TRY (Турецкая лира)' },
                        { value: 'USD', label: 'USD (Доллар США)' },
                        { value: 'EUR', label: 'EUR (Евро)' },
                        { value: 'CNY', label: 'CNY (Юань)' },
                      ]}
                    />
                  ) : bulkEditField === 'supplier_country' || bulkEditField === 'customs_code' ? (
                    <Input
                      value={bulkEditValue}
                      onChange={(e) => setBulkEditValue(e.target.value)}
                      placeholder="Введите значение"
                      onPressEnter={applyBulkEdit}
                    />
                  ) : (
                    <InputNumber
                      value={bulkEditValue}
                      onChange={setBulkEditValue}
                      style={{ width: '100%' }}
                      placeholder="Введите числовое значение"
                      min={0}
                      step={bulkEditField.includes('rate') ? 0.0001 : 0.01}
                      onPressEnter={applyBulkEdit}
                    />
                  )}
                </Form.Item>
              )}
            </Form>
          </Space>
        </Modal>

        {/* Column Chooser Modal */}
        <Modal
          title="Управление колонками"
          open={columnChooserVisible}
          onCancel={() => setColumnChooserVisible(false)}
          onOk={() => setColumnChooserVisible(false)}
          width={600}
          okText="Готово"
          cancelText="Отмена"
        >
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {gridRef.current?.api?.getAllGridColumns()?.map((column) => {
                const colId = column.getColId();
                const colDef = column.getColDef();
                const headerName = colDef.headerName || colId;
                const isVisible = column.isVisible();

                // Skip checkbox column
                if (colId === 'checkbox') return null;

                return (
                  <div key={`${colId}-${columnVisibilityRefresh}`} style={{ padding: '4px 0' }}>
                    <Checkbox
                      checked={isVisible}
                      onChange={(e) => {
                        gridRef.current?.api?.setColumnsVisible([colId], e.target.checked);
                        setColumnVisibilityRefresh((prev) => prev + 1); // Force re-render
                      }}
                    >
                      <span style={{ fontSize: '13px' }}>{headerName}</span>
                    </Checkbox>
                  </div>
                );
              })}
            </Space>
          </div>
        </Modal>

        {/* Template Save Modal */}
        <Modal
          title="Сохранить шаблон"
          open={templateSaveModalVisible}
          onOk={performTemplateSave}
          onCancel={() => setTemplateSaveModalVisible(false)}
          okText="Сохранить"
          cancelText="Отмена"
          width={500}
        >
          <Form layout="vertical">
            <Form.Item label="Выберите действие">
              <Radio.Group
                value={templateSaveMode}
                onChange={(e) => setTemplateSaveMode(e.target.value)}
              >
                <Space direction="vertical">
                  <Radio value="new">Создать новый шаблон</Radio>
                  <Radio value="update" disabled={templates.length === 0}>
                    Обновить существующий шаблон
                  </Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            {templateSaveMode === 'new' && (
              <Form.Item label="Название нового шаблона" required>
                <Input
                  value={templateNewName}
                  onChange={(e) => setTemplateNewName(e.target.value)}
                  placeholder="Введите название"
                  onPressEnter={performTemplateSave}
                />
              </Form.Item>
            )}

            {templateSaveMode === 'update' && (
              <Form.Item label="Выберите шаблон для обновления" required>
                <Select
                  value={templateUpdateId}
                  onChange={setTemplateUpdateId}
                  placeholder="Выберите шаблон"
                  options={templates.map((t) => ({
                    label: t.name,
                    value: t.id,
                  }))}
                />
              </Form.Item>
            )}
          </Form>
        </Modal>
      </div>
    </MainLayout>
  );
}
