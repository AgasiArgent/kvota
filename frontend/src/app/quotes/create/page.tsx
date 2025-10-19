'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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
  Collapse,
  InputNumber,
  Space,
  Spin,
  Tag,
  Checkbox,
  Statistic,
  Modal,
} from 'antd'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ColGroupDef } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import {
  InboxOutlined,
  SaveOutlined,
  CalculatorOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import type { UploadFile, UploadProps } from 'antd'
import MainLayout from '@/components/layout/MainLayout'
import { quotesCalcService, Product, VariableTemplate, CalculationVariables } from '@/lib/api/quotes-calc-service'
import { customerService, Customer } from '@/lib/api/customer-service'
import { calculationSettingsService, CalculationSettings } from '@/lib/api/calculation-settings-service'

const { Title, Text } = Typography
const { Dragger } = Upload
const { Panel } = Collapse

export default function CreateQuotePage() {
  const router = useRouter()
  const [form] = Form.useForm<CalculationVariables>()
  const gridRef = useRef<AgGridReact>(null)

  // State
  const [loading, setLoading] = useState(false)
  const [uploadedProducts, setUploadedProducts] = useState<Product[]>([])
  const [uploadedFile, setUploadedFile] = useState<UploadFile | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [templates, setTemplates] = useState<VariableTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>()
  const [selectedCustomer, setSelectedCustomer] = useState<string | undefined>()
  const [calculationResults, setCalculationResults] = useState<any>(null)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [adminSettings, setAdminSettings] = useState<CalculationSettings | null>(null)
  const [bulkEditModalVisible, setBulkEditModalVisible] = useState(false)
  const [bulkEditField, setBulkEditField] = useState<string>('')
  const [bulkEditValue, setBulkEditValue] = useState<any>('')

  // Load customers, templates, and admin settings on mount
  useEffect(() => {
    loadCustomers()
    loadTemplates()
    loadAdminSettings()

    // Set default values
    const defaultVars = quotesCalcService.getDefaultVariables()
    form.setFieldsValue(defaultVars)
  }, [])

  // Debug: Log uploadedProducts when they change
  useEffect(() => {
    console.log('=== uploadedProducts changed ===')
    console.log('Length:', uploadedProducts.length)
    console.log('Data:', uploadedProducts)
  }, [uploadedProducts])

  const loadCustomers = async () => {
    const result = await customerService.listCustomers()
    if (result.success && result.data) {
      setCustomers(result.data.customers)
    } else {
      message.error(`Ошибка загрузки клиентов: ${result.error}`)
    }
  }

  const loadTemplates = async () => {
    const result = await quotesCalcService.listTemplates()
    if (result.success && result.data) {
      setTemplates(result.data)
    } else {
      message.error(`Ошибка загрузки шаблонов: ${result.error}`)
    }
  }

  const loadAdminSettings = async () => {
    const result = await calculationSettingsService.getSettings()
    if (result.success && result.data) {
      setAdminSettings(result.data)
      // Pre-fill admin-only fields from settings
      form.setFieldsValue({
        rate_forex_risk: result.data.rate_forex_risk,
        rate_fin_comm: result.data.rate_fin_comm,
        rate_loan_interest_daily: result.data.rate_loan_interest_daily,
      })
    }
  }

  // File upload handlers
  const handleFileUpload = async (file: File) => {
    setLoading(true)
    try {
      const result = await quotesCalcService.uploadProducts(file)

      if (result.success && result.data) {
        setUploadedProducts(result.data.products)
        setUploadedFile({ uid: Date.now().toString(), name: file.name, status: 'done' } as UploadFile)
        message.success(`Загружено ${result.data.total_count} товаров`)
        return true
      } else {
        message.error(`Ошибка загрузки файла: ${result.error}`)
        return false
      }
    } catch (error: any) {
      message.error(`Ошибка: ${error.message}`)
      return false
    } finally {
      setLoading(false)
    }
  }

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    maxCount: 1,
    accept: '.xlsx,.xls,.csv',
    beforeUpload: (file) => {
      if (!quotesCalcService.isValidFileType(file)) {
        message.error('Поддерживаются только файлы Excel (.xlsx, .xls) и CSV (.csv)')
        return false
      }
      handleFileUpload(file)
      return false // Prevent automatic upload
    },
    onRemove: () => {
      setUploadedProducts([])
      setUploadedFile(null)
    },
    fileList: uploadedFile ? [uploadedFile] : [],
  }

  // Template selection handler
  const handleTemplateSelect = async (templateId: string) => {
    setSelectedTemplate(templateId)

    const result = await quotesCalcService.getTemplate(templateId)
    if (result.success && result.data) {
      // Merge template variables with current form values
      const templateVars = result.data.variables
      form.setFieldsValue(templateVars as any)
      message.success(`Шаблон "${result.data.name}" загружен`)
    } else {
      message.error(`Ошибка загрузки шаблона: ${result.error}`)
    }
  }

  // Save current variables as template
  const handleSaveTemplate = async () => {
    const templateName = prompt('Введите название шаблона:')
    if (!templateName) return

    const variables = form.getFieldsValue()

    const result = await quotesCalcService.createTemplate({
      name: templateName,
      description: `Создано ${new Date().toLocaleDateString()}`,
      variables: variables,
      is_default: false,
    })

    if (result.success) {
      message.success('Шаблон сохранен')
      loadTemplates()
    } else {
      message.error(`Ошибка сохранения: ${result.error}`)
    }
  }

  // Calculate quote
  const handleCalculate = async () => {
    if (!selectedCustomer) {
      message.error('Выберите клиента')
      return
    }

    if (uploadedProducts.length === 0) {
      message.error('Загрузите файл с товарами')
      return
    }

    setLoading(true)
    try {
      const variables = form.getFieldsValue()

      const result = await quotesCalcService.calculateQuote({
        customer_id: selectedCustomer,
        products: uploadedProducts,
        variables: variables as CalculationVariables,
        title: `Коммерческое предложение от ${new Date().toLocaleDateString()}`,
      })

      if (result.success && result.data) {
        setCalculationResults(result.data)
        // Show all columns by default
        setVisibleColumns([
          'product_name',
          'quantity',
          'base_price_vat',
          'base_price_no_vat',
          'purchase_price_rub',
          'logistics_costs',
          'cogs',
          'cogs_with_vat',
          'import_duties',
          'customs_fees',
          'financing_costs',
          'dm_fee',
          'total_cost',
          'sale_price',
          'margin',
        ])
        message.success(`Расчет выполнен! Котировка №${result.data.quote_number}`)
      } else {
        message.error(`Ошибка расчета: ${result.error}`)
      }
    } catch (error: any) {
      message.error(`Ошибка: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ag-Grid column definitions with groups
  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => [
    // Group 1: Product Info (Always Editable)
    {
      headerName: 'Информация о товаре',
      children: [
        {
          field: 'sku',
          headerName: 'Артикул',
          width: 120,
          editable: true,
          cellStyle: { backgroundColor: '#fff' },
        },
        {
          field: 'brand',
          headerName: 'Бренд',
          width: 120,
          editable: true,
          cellStyle: { backgroundColor: '#fff' },
        },
        {
          field: 'product_name',
          headerName: 'Наименование',
          width: 200,
          editable: true,
          cellStyle: { backgroundColor: '#fff' },
        },
        {
          field: 'quantity',
          headerName: 'Кол-во',
          width: 100,
          editable: true,
          type: 'numericColumn',
          cellStyle: { backgroundColor: '#fff' },
        },
        {
          field: 'base_price_vat',
          headerName: 'Цена с НДС',
          width: 130,
          editable: true,
          type: 'numericColumn',
          cellStyle: { backgroundColor: '#fff' },
          valueFormatter: (params) => params.value?.toFixed(2) || '',
        },
        {
          field: 'weight_in_kg',
          headerName: 'Вес (кг)',
          width: 100,
          editable: true,
          type: 'numericColumn',
          cellStyle: { backgroundColor: '#fff' },
          valueFormatter: (params) => params.value?.toFixed(2) || '-',
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
          width: 120,
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
          width: 130,
          editable: true,
          cellStyle: (params) => ({
            backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
          }),
        },
        {
          field: 'supplier_discount',
          headerName: 'Скидка (%)',
          width: 110,
          editable: true,
          type: 'numericColumn',
          cellStyle: (params) => ({
            backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
          }),
          valueFormatter: (params) => params.value?.toFixed(2) || '',
        },
        {
          field: 'exchange_rate_base_price_to_quote',
          headerName: 'Курс',
          width: 100,
          editable: true,
          type: 'numericColumn',
          cellStyle: (params) => ({
            backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
          }),
          valueFormatter: (params) => params.value?.toFixed(4) || '',
        },
        {
          field: 'customs_code',
          headerName: 'Код ТН ВЭД',
          width: 130,
          editable: true,
          cellStyle: (params) => ({
            backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
          }),
        },
        {
          field: 'import_tariff',
          headerName: 'Пошлина (%)',
          width: 120,
          editable: true,
          type: 'numericColumn',
          cellStyle: (params) => ({
            backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
          }),
          valueFormatter: (params) => params.value?.toFixed(2) || '',
        },
        {
          field: 'excise_tax',
          headerName: 'Акциз (%)',
          width: 110,
          editable: true,
          type: 'numericColumn',
          cellStyle: (params) => ({
            backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
          }),
          valueFormatter: (params) => params.value?.toFixed(2) || '',
        },
        {
          field: 'markup',
          headerName: 'Наценка (%)',
          width: 120,
          editable: true,
          type: 'numericColumn',
          cellStyle: (params) => ({
            backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
          }),
          valueFormatter: (params) => params.value?.toFixed(2) || '',
        },
      ],
    },
  ], [])

  // Default column properties
  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    enableCellChangeFlash: true,
  }), [])

  // Bulk edit handler for applying value to selected rows
  const handleBulkEdit = useCallback((field: string, value: any) => {
    const selectedNodes = gridRef.current?.api.getSelectedNodes()
    if (!selectedNodes || selectedNodes.length === 0) {
      message.warning('Выберите строки для применения значения')
      return
    }

    const updatedProducts = [...uploadedProducts]
    selectedNodes.forEach((node) => {
      if (node.rowIndex !== null && node.rowIndex !== undefined) {
        updatedProducts[node.rowIndex] = {
          ...updatedProducts[node.rowIndex],
          [field]: value,
        }
      }
    })

    setUploadedProducts(updatedProducts)
    gridRef.current?.api.refreshCells({ force: true })
    message.success(`Значение применено к ${selectedNodes.length} строкам`)
  }, [uploadedProducts])

  // Open bulk edit modal
  const openBulkEditModal = () => {
    const selectedNodes = gridRef.current?.api.getSelectedNodes()
    if (!selectedNodes || selectedNodes.length === 0) {
      message.warning('Выберите строки для массового редактирования')
      return
    }
    setBulkEditModalVisible(true)
  }

  // Apply bulk edit
  const applyBulkEdit = () => {
    if (!bulkEditField) {
      message.error('Выберите поле для редактирования')
      return
    }

    handleBulkEdit(bulkEditField, bulkEditValue)
    setBulkEditModalVisible(false)
    setBulkEditField('')
    setBulkEditValue('')
  }

  // Bulk editable fields
  const bulkEditFields = [
    { value: 'currency_of_base_price', label: 'Валюта закупки' },
    { value: 'supplier_country', label: 'Страна закупки' },
    { value: 'supplier_discount', label: 'Скидка поставщика (%)' },
    { value: 'exchange_rate_base_price_to_quote', label: 'Курс' },
    { value: 'customs_code', label: 'Код ТН ВЭД' },
    { value: 'import_tariff', label: 'Пошлина (%)' },
    { value: 'excise_tax', label: 'Акциз (%)' },
    { value: 'markup', label: 'Наценка (%)' },
  ]

  return (
    <MainLayout>
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => router.push('/quotes')}
              >
                Назад
              </Button>
              <Title level={2} style={{ margin: 0 }}>Создать котировку</Title>
            </Space>
          </Col>
        </Row>

        <Spin spinning={loading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCalculate}
          >
            {/* Split Layout */}
            <Row gutter={24}>
              {/* LEFT COLUMN - File Upload & Customer */}
              <Col xs={24} lg={10}>
                {/* File Upload */}
                <Card title="📁 Загрузить товары" style={{ marginBottom: 16 }}>
                  <Dragger {...uploadProps}>
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">
                      Нажмите или перетащите файл Excel/CSV
                    </p>
                    <p className="ant-upload-hint">
                      Поддерживаются форматы: .xlsx, .xls, .csv
                    </p>
                  </Dragger>

                  {uploadedProducts.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        <Row justify="space-between" align="middle">
                          <Col>
                            <Text strong>Загружено товаров: {uploadedProducts.length}</Text>
                          </Col>
                          <Col>
                            <Button
                              icon={<EditOutlined />}
                              onClick={openBulkEditModal}
                              size="small"
                            >
                              Массовое редактирование
                            </Button>
                          </Col>
                        </Row>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          💡 Совет: Выберите строки (Shift+клик), затем используйте "Массовое редактирование" или Ctrl+C/Ctrl+V для копирования из Excel
                        </Text>
                      </Space>
                      <div
                        className="ag-theme-alpine"
                        style={{ height: 400, width: '100%', marginTop: 8 }}
                      >
                        <AgGridReact
                          ref={gridRef}
                          rowData={uploadedProducts}
                          columnDefs={columnDefs}
                          defaultColDef={defaultColDef}
                          animateRows={true}
                          rowSelection="multiple"
                          enableRangeSelection={true}
                          enableCellTextSelection={true}
                          suppressRowClickSelection={true}
                          onCellValueChanged={(event) => {
                            // Update the uploadedProducts state when cells are edited
                            const updatedProducts = [...uploadedProducts]
                            const index = event.rowIndex
                            if (index !== null && index !== undefined) {
                              updatedProducts[index] = event.data
                              setUploadedProducts(updatedProducts)
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </Card>

                {/* Customer Selection */}
                <Card title="👤 Выбрать клиента" style={{ marginBottom: 16 }}>
                  <Form.Item
                    label="Клиент"
                    required
                  >
                    <Select
                      showSearch
                      placeholder="Выберите клиента"
                      value={selectedCustomer}
                      onChange={setSelectedCustomer}
                      optionFilterProp="children"
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={customers.map(c => ({
                        label: `${c.name} (${c.inn || 'без ИНН'})`,
                        value: c.id,
                      }))}
                    />
                  </Form.Item>
                </Card>
              </Col>

              {/* RIGHT COLUMN - Template & Variables */}
              <Col xs={24} lg={14}>
                {/* Template Selector */}
                <Card
                  title="📋 Шаблон переменных"
                  extra={
                    <Button
                      type="link"
                      icon={<SaveOutlined />}
                      onClick={handleSaveTemplate}
                    >
                      Сохранить как шаблон
                    </Button>
                  }
                  style={{ marginBottom: 16 }}
                >
                  <Form.Item label="Загрузить шаблон">
                    <Select
                      placeholder="Выберите шаблон или заполните вручную"
                      value={selectedTemplate}
                      onChange={handleTemplateSelect}
                      allowClear
                      options={templates.map(t => ({
                        label: `${t.name} ${t.is_default ? '(по умолчанию)' : ''}`,
                        value: t.id,
                      }))}
                    />
                  </Form.Item>
                </Card>

                {/* Variables Form - Part 1 (to be continued in next command) */}
                {/* Admin Settings Info Box */}
                {adminSettings && (
                  <Card
                    title={<Space><InfoCircleOutlined /> Настройки администратора (только чтение)</Space>}
                    size="small"
                    style={{ marginBottom: 16, backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}
                  >
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Эти параметры установлены администратором и применяются ко всем котировкам:
                      </Text>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Statistic
                            title="Резерв на потери на курсовой разнице (%)"
                            value={adminSettings.rate_forex_risk}
                            suffix="%"
                            precision={2}
                            valueStyle={{ fontSize: '14px' }}
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title="Комиссия ФинАгента (%)"
                            value={adminSettings.rate_fin_comm}
                            suffix="%"
                            precision={2}
                            valueStyle={{ fontSize: '14px' }}
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title="Дневная стоимость денег (%)"
                            value={adminSettings.rate_loan_interest_daily}
                            suffix="%"
                            precision={8}
                            valueStyle={{ fontSize: '14px' }}
                          />
                        </Col>
                      </Row>
                    </Space>
                  </Card>
                )}

                {/* Variables Form - Organized into 6 Cards */}
                <Card title="🔧 Параметры котировки по умолчанию" style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                    Эти значения будут применены ко всем товарам. Вы сможете переопределить их для отдельных товаров в таблице.
                  </Text>

                  <Collapse defaultActiveKey={['company', 'financial']}>
                    {/* 1. Company Settings */}
                    <Panel header="🏢 Настройки компании (3 поля)" key="company">
                      <Row gutter={16}>
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
                      </Row>
                    </Panel>

                    {/* 2. Financial Parameters */}
                    <Panel header="💰 Финансовые параметры (3 поля)" key="financial">
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="markup" label="Наценка (%)">
                            <InputNumber min={0} max={500} step={1} style={{ width: '100%' }} addonAfter="%" />
                          </Form.Item>
                        </Col>
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
                      </Row>
                    </Panel>

                    {/* 3. Logistics */}
                    <Panel header="🚚 Логистика (5 полей)" key="logistics">
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="offer_incoterms" label="Базис поставки (Incoterms)">
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
                            <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="дн" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name="logistics_supplier_hub" label="Логистика Поставщик-Хаб (₽)">
                            <InputNumber min={0} step={100} style={{ width: '100%' }} addonAfter="₽" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name="logistics_hub_customs" label="Логистика Хаб-РФ (₽)">
                            <InputNumber min={0} step={100} style={{ width: '100%' }} addonAfter="₽" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name="logistics_customs_client" label="Логистика Таможня-Клиент (₽)">
                            <InputNumber min={0} step={100} style={{ width: '100%' }} addonAfter="₽" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Panel>

                    {/* 4. Payment Terms */}
                    <Panel header="⏱️ Условия оплаты (10 полей)" key="payment">
                      <Row gutter={16}>
                        <Col span={8}>
                          <Form.Item name="advance_from_client" label="Аванс от клиента (%)">
                            <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name="time_to_advance" label="Дней до аванса">
                            <InputNumber min={0} addonAfter="дн" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name="advance_to_supplier" label="Аванс поставщику (%)">
                            <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="advance_on_loading" label="Аванс при заборе груза (%)">
                            <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="time_to_advance_loading" label="Дней от забора до аванса">
                            <InputNumber min={0} addonAfter="дн" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="advance_on_going_to_country_destination" label="Аванс при отправке в РФ (%)">
                            <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="time_to_advance_going_to_country_destination" label="Дней от отправки до аванса">
                            <InputNumber min={0} addonAfter="дн" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="advance_on_customs_clearance" label="Аванс при прохождении таможни (%)">
                            <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="time_to_advance_on_customs_clearance" label="Дней от таможни до аванса">
                            <InputNumber min={0} addonAfter="дн" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="time_to_advance_on_receiving" label="Дней от получения до оплаты">
                            <InputNumber min={0} addonAfter="дн" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Panel>


                    {/* 5. Customs & Clearance */}
                    <Panel header="🛃 Таможня и растаможка (6 полей)" key="customs">
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="brokerage_hub" label="Брокерские Турция (₽)">
                            <InputNumber min={0} step={100} style={{ width: '100%' }} addonAfter="₽" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="brokerage_customs" label="Брокерские РФ (₽)">
                            <InputNumber min={0} step={100} style={{ width: '100%' }} addonAfter="₽" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="warehousing_at_customs" label="Расходы на СВХ (₽)">
                            <InputNumber min={0} step={100} style={{ width: '100%' }} addonAfter="₽" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="customs_documentation" label="Разрешительные документы (₽)">
                            <InputNumber min={0} step={100} style={{ width: '100%' }} addonAfter="₽" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="brokerage_extra" label="Прочие расходы (₽)">
                            <InputNumber min={0} step={100} style={{ width: '100%' }} addonAfter="₽" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="util_fee" label="Утилизационный сбор (₽)">
                            <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="₽" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Panel>

                    {/* 6. Product Defaults */}
                    <Panel header="📦 Значения по умолчанию для товаров (7 полей)" key="product-defaults">
                      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                        Эти значения можно переопределить для каждого товара в таблице
                      </Text>
                      <Row gutter={16}>
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
                          <Form.Item name="exchange_rate_base_price_to_quote" label="Курс к валюте КП">
                            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="supplier_country" label="Страна закупки">
                            <Input placeholder="Турция" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="supplier_discount" label="Скидка поставщика (%)">
                            <InputNumber min={0} max={100} step={0.1} style={{ width: '100%' }} addonAfter="%" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="customs_code" label="Код ТН ВЭД">
                            <Input placeholder="8482102009" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="import_tariff" label="Пошлина (%)">
                            <InputNumber min={0} max={100} step={0.1} style={{ width: '100%' }} addonAfter="%" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="excise_tax" label="Акциз (%)">
                            <InputNumber min={0} max={100} step={0.1} style={{ width: '100%' }} addonAfter="%" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Panel>
                  </Collapse>
                </Card>

                {/* Calculate Button */}
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
                    <Text type="secondary" style={{ display: 'block', marginTop: 8, textAlign: 'center' }}>
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
                      render: (val: any) => typeof val === 'number' ? val.toFixed(2) : val,
                    },
                    {
                      title: 'Без НДС',
                      dataIndex: 'base_price_no_vat',
                      key: 'base_price_no_vat',
                      width: 100,
                      render: (val: any) => typeof val === 'number' ? val.toFixed(2) : val,
                    },
                    {
                      title: 'Закупка ₽',
                      dataIndex: 'purchase_price_rub',
                      key: 'purchase_price_rub',
                      width: 110,
                      render: (val: any) => typeof val === 'number' ? val.toFixed(2) : val,
                    },
                    {
                      title: 'Логистика',
                      dataIndex: 'logistics_costs',
                      key: 'logistics_costs',
                      width: 110,
                      render: (val: any) => typeof val === 'number' ? val.toFixed(2) : val,
                    },
                    {
                      title: 'С/с',
                      dataIndex: 'cogs',
                      key: 'cogs',
                      width: 100,
                      render: (val: any) => typeof val === 'number' ? val.toFixed(2) : val,
                    },
                    {
                      title: 'С/с+НДС',
                      dataIndex: 'cogs_with_vat',
                      key: 'cogs_with_vat',
                      width: 110,
                      render: (val: any) => typeof val === 'number' ? val.toFixed(2) : val,
                    },
                    {
                      title: 'Пошлина',
                      dataIndex: 'import_duties',
                      key: 'import_duties',
                      width: 100,
                      render: (val: any) => typeof val === 'number' ? val.toFixed(2) : val,
                    },
                    {
                      title: 'Таможня',
                      dataIndex: 'customs_fees',
                      key: 'customs_fees',
                      width: 100,
                      render: (val: any) => typeof val === 'number' ? val.toFixed(2) : val,
                    },
                    {
                      title: 'Финансир',
                      dataIndex: 'financing_costs',
                      key: 'financing_costs',
                      width: 100,
                      render: (val: any) => typeof val === 'number' ? val.toFixed(2) : val,
                    },
                    {
                      title: 'Вознагр',
                      dataIndex: 'dm_fee',
                      key: 'dm_fee',
                      width: 100,
                      render: (val: any) => typeof val === 'number' ? val.toFixed(2) : val,
                    },
                    {
                      title: 'Итого',
                      dataIndex: 'total_cost',
                      key: 'total_cost',
                      width: 110,
                      render: (val: any) => typeof val === 'number' ? <strong>{val.toFixed(2)}</strong> : val,
                    },
                    {
                      title: 'Продажа',
                      dataIndex: 'sale_price',
                      key: 'sale_price',
                      width: 110,
                      render: (val: any) => typeof val === 'number' ? <strong style={{color: '#1890ff'}}>{val.toFixed(2)}</strong> : val,
                    },
                    {
                      title: 'Маржа',
                      dataIndex: 'margin',
                      key: 'margin',
                      width: 100,
                      render: (val: any) => typeof val === 'number' ? <span style={{color: val > 0 ? 'green' : 'red'}}>{val.toFixed(2)}</span> : val,
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
            setBulkEditModalVisible(false)
            setBulkEditField('')
            setBulkEditValue('')
          }}
          okText="Применить"
          cancelText="Отмена"
          width={500}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Text type="secondary">
              Выбрано строк: <strong>{gridRef.current?.api?.getSelectedNodes()?.length || 0}</strong>
            </Text>
            <Form layout="vertical">
              <Form.Item label="Выберите поле для редактирования" required>
                <Select
                  value={bulkEditField}
                  onChange={(value) => {
                    setBulkEditField(value)
                    setBulkEditValue('')
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
                    />
                  ) : (
                    <InputNumber
                      value={bulkEditValue}
                      onChange={setBulkEditValue}
                      style={{ width: '100%' }}
                      placeholder="Введите числовое значение"
                      min={0}
                      step={bulkEditField.includes('rate') ? 0.0001 : 0.01}
                    />
                  )}
                </Form.Item>
              )}
            </Form>
          </Space>
        </Modal>
      </div>
    </MainLayout>
  )
}
