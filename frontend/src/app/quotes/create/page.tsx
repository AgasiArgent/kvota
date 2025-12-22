'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { config } from '@/lib/config';
import dynamic from 'next/dynamic';
import dayjs from 'dayjs';
import type { ColDef, ColGroupDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  Calculator,
  Save,
  Info,
  Pencil,
  LayoutGrid,
  Filter,
  XCircle,
  Upload,
  Loader2,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { MonetaryInput, MonetaryValue, Currency } from '@/components/inputs/MonetaryInput';
import {
  quotesCalcService,
  Product,
  VariableTemplate,
  CalculationVariables,
  ProductCalculationResult,
} from '@/lib/api/quotes-calc-service';
import { customerService, Customer } from '@/lib/api/customer-service';
import {
  calculationSettingsService,
  CalculationSettings,
} from '@/lib/api/calculation-settings-service';
import {
  getSupplierCountries,
  formatSupplierCountryOptions,
} from '@/lib/api/supplier-countries-service';
import { exchangeRateService } from '@/lib/api/exchange-rate-service';
import { toast } from 'sonner';

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
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Загрузка таблицы...</span>
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
  // Replace comma with period for parsing
  const normalized = value.toString().replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
};

// Form data interface
interface FormData {
  quote_date: string;
  valid_until: string;
  seller_company: string;
  offer_sale_type: string;
  currency_of_quote: string;
  offer_incoterms: string;
  delivery_time: number;
  markup: number;
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
  logistics_total: MonetaryValue;
  logistics_supplier_hub: MonetaryValue;
  logistics_hub_customs: MonetaryValue;
  logistics_customs_client: MonetaryValue;
  brokerage_hub: MonetaryValue;
  brokerage_customs: MonetaryValue;
  warehousing_at_customs: MonetaryValue;
  customs_documentation: MonetaryValue;
  brokerage_extra: MonetaryValue;
  customs_code: string;
  import_tariff: number;
  excise_tax: MonetaryValue;
  rate_forex_risk: number;
  rate_fin_comm: number;
  rate_loan_interest_daily: number;
  currency_of_base_price: string;
  exchange_rate_base_price_to_quote: number;
  supplier_country: string;
}

const initialFormData: FormData = {
  quote_date: dayjs().format('YYYY-MM-DD'),
  valid_until: dayjs().add(30, 'day').format('YYYY-MM-DD'),
  seller_company: '',
  offer_sale_type: '',
  currency_of_quote: 'RUB',
  offer_incoterms: 'DDP',
  delivery_time: 0,
  markup: 0,
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
  logistics_total: { value: 0, currency: 'EUR' as Currency },
  logistics_supplier_hub: { value: 0, currency: 'EUR' as Currency },
  logistics_hub_customs: { value: 0, currency: 'EUR' as Currency },
  logistics_customs_client: { value: 0, currency: 'RUB' as Currency },
  brokerage_hub: { value: 0, currency: 'EUR' as Currency },
  brokerage_customs: { value: 0, currency: 'RUB' as Currency },
  warehousing_at_customs: { value: 0, currency: 'RUB' as Currency },
  customs_documentation: { value: 0, currency: 'RUB' as Currency },
  brokerage_extra: { value: 0, currency: 'RUB' as Currency },
  customs_code: '',
  import_tariff: 0,
  excise_tax: { value: 0, currency: 'RUB' as Currency },
  rate_forex_risk: 0,
  rate_fin_comm: 0,
  rate_loan_interest_daily: 0,
  currency_of_base_price: 'USD',
  exchange_rate_base_price_to_quote: 1.0,
  supplier_country: 'Турция',
};

// Helper function to extract MonetaryValue objects from form values
const extractMonetaryValues = (
  formValues: FormData
): {
  variables: Record<string, unknown>;
  monetaryFields: Record<string, MonetaryValue>;
} => {
  const monetaryFieldNames = [
    'logistics_total',
    'logistics_supplier_hub',
    'logistics_hub_customs',
    'logistics_customs_client',
    'brokerage_hub',
    'brokerage_customs',
    'warehousing_at_customs',
    'customs_documentation',
    'brokerage_extra',
  ];

  const monetaryFields: Record<string, MonetaryValue> = {};
  const variables: Record<string, unknown> = { ...formValues };

  // Extract monetary fields and convert to numeric values for backend compatibility
  for (const fieldName of monetaryFieldNames) {
    const fieldValue = formValues[fieldName as keyof FormData];
    if (fieldValue && typeof fieldValue === 'object' && 'value' in fieldValue) {
      // Store the full MonetaryValue for API
      monetaryFields[fieldName] = fieldValue as MonetaryValue;
      // For backward compatibility, set the numeric value in variables
      variables[fieldName] = (fieldValue as MonetaryValue).value;
    }
  }

  return { variables, monetaryFields };
};

export default function CreateQuotePage() {
  const router = useRouter();
  const gridRef = useRef<any>(null);

  // State
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [uploadedProducts, setUploadedProducts] = useState<Product[]>([]);

  // Track which cells were manually edited (for product-level overrides)
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set());
  const [productOverrides, setProductOverrides] = useState<Map<number, Record<string, unknown>>>(
    new Map()
  );

  // File upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [templates, setTemplates] = useState<VariableTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>();
  const [selectedCustomer, setSelectedCustomer] = useState<string | undefined>();
  const [customerContacts, setCustomerContacts] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<string | undefined>();
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
  const [supplierCountries, setSupplierCountries] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [sellerCompanies, setSellerCompanies] = useState<
    Array<{ id: string; name: string; supplier_code: string; country: string | null }>
  >([]);

  // Calculate delivery_date from quote_date + delivery_time
  const deliveryDate = useMemo(() => {
    if (!formData.quote_date || !formData.delivery_time) return null;
    return dayjs(formData.quote_date).add(formData.delivery_time, 'day');
  }, [formData.quote_date, formData.delivery_time]);

  // Calculate VAT rate based on delivery date
  const vatRate = useMemo(() => {
    if (!deliveryDate) return '20%';
    return deliveryDate.year() >= 2026 ? '22%' : '20%';
  }, [deliveryDate]);

  // Load customers, templates, and admin settings on mount
  useEffect(() => {
    loadCustomers();
    loadTemplates();
    loadAdminSettings();
    loadSupplierCountries();
    loadSellerCompanies();

    // Set default values from quotesCalcService
    const defaultVars = quotesCalcService.getDefaultVariables();
    // Exclude fields that conflict with MonetaryValue types
    const {
      excise_tax: _exciseTax,
      logistics_supplier_hub: _logSupplierHub,
      logistics_hub_customs: _logHubCustoms,
      logistics_customs_client: _logCustomsClient,
      ...compatibleDefaults
    } = defaultVars;
    setFormData((prev) => ({
      ...prev,
      ...compatibleDefaults,
      quote_date: dayjs().format('YYYY-MM-DD'),
      valid_until: dayjs().add(30, 'day').format('YYYY-MM-DD'),
      logistics_total: { value: 0, currency: 'EUR' as Currency },
      logistics_supplier_hub: {
        value: defaultVars.logistics_supplier_hub || 0,
        currency: 'EUR' as Currency,
      },
      logistics_hub_customs: {
        value: defaultVars.logistics_hub_customs || 0,
        currency: 'EUR' as Currency,
      },
      logistics_customs_client: {
        value: defaultVars.logistics_customs_client || 0,
        currency: 'RUB' as Currency,
      },
      brokerage_hub: { value: defaultVars.brokerage_hub || 0, currency: 'EUR' as Currency },
      brokerage_customs: { value: defaultVars.brokerage_customs || 0, currency: 'RUB' as Currency },
      warehousing_at_customs: {
        value: defaultVars.warehousing_at_customs || 0,
        currency: 'RUB' as Currency,
      },
      customs_documentation: {
        value: defaultVars.customs_documentation || 0,
        currency: 'RUB' as Currency,
      },
      brokerage_extra: { value: defaultVars.brokerage_extra || 0, currency: 'RUB' as Currency },
    }));
  }, []);

  // Load contacts when customer changes
  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerContacts(selectedCustomer);
    } else {
      setCustomerContacts([]);
      setSelectedContact(undefined);
    }
  }, [selectedCustomer]);

  // Auto-calculate logistics breakdown when in "total" mode
  const handleLogisticsTotalChange = (monetaryValue: MonetaryValue | null) => {
    if (logisticsMode === 'total' && monetaryValue && monetaryValue.value > 0) {
      setFormData((prev) => ({
        ...prev,
        logistics_total: monetaryValue,
        logistics_supplier_hub: {
          value: monetaryValue.value * 0.5,
          currency: monetaryValue.currency,
        },
        logistics_hub_customs: {
          value: monetaryValue.value * 0.3,
          currency: monetaryValue.currency,
        },
        logistics_customs_client: {
          value: monetaryValue.value * 0.2,
          currency: monetaryValue.currency,
        },
      }));
    } else if (monetaryValue) {
      setFormData((prev) => ({ ...prev, logistics_total: monetaryValue }));
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

  const loadCustomerContacts = async (customerId: string) => {
    try {
      const supabase = await import('@/lib/supabase/client').then((m) => m.createClient());
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Не авторизован');
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/customers/${customerId}/contacts`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки контактов');
      }

      const data = await response.json();
      setCustomerContacts(data.contacts);

      // Auto-select primary contact if exists
      const primaryContact = data.contacts.find((c: any) => c.is_primary);
      if (primaryContact) {
        setSelectedContact(primaryContact.id);
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
      setCustomerContacts([]);
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
        toast.error(`Ошибка загрузки шаблонов: ${result.error}`);
      }
    } catch (error) {
      console.error('Templates load error:', error);
      toast.error('Ошибка при загрузке шаблонов');
    }
  };

  const loadAdminSettings = async () => {
    const result = await calculationSettingsService.getSettings();
    if (result.success && result.data) {
      setAdminSettings(result.data);
      // Pre-fill admin-only fields from settings
      setFormData((prev) => ({
        ...prev,
        rate_forex_risk: result.data!.rate_forex_risk,
        rate_fin_comm: result.data!.rate_fin_comm,
        rate_loan_interest_daily: result.data!.rate_loan_interest_daily,
      }));
    }
  };

  const loadSupplierCountries = async () => {
    try {
      const countries = await getSupplierCountries();
      const options = formatSupplierCountryOptions(countries);
      setSupplierCountries(options);
    } catch (error) {
      console.error('Failed to load supplier countries:', error);
      setSupplierCountries([]);
    }
  };

  const loadSellerCompanies = async () => {
    try {
      const apiUrl = config.apiUrl;
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch(`${apiUrl}/api/seller-companies/`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSellerCompanies(data);
      }
    } catch (error) {
      console.error('Failed to load seller companies:', error);
      setSellerCompanies([]);
    }
  };

  // File upload handlers
  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      const result = await quotesCalcService.uploadProducts(file);

      if (result.success && result.data) {
        setUploadedProducts(result.data.products);
        setUploadedFileName(file.name);
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

  const handleRemoveFile = () => {
    setUploadedProducts([]);
    setUploadedFileName(null);
    toast.info('Файл удален');
  };

  // Template selection handler
  const handleTemplateSelect = async (templateId: string) => {
    console.log('Template select called with ID:', templateId);
    setSelectedTemplate(templateId);

    try {
      const result = await quotesCalcService.getTemplate(templateId);
      console.log('Template load result:', result);

      if (result.success && result.data) {
        const templateVars = result.data.variables;
        console.log('Template variables:', templateVars);

        // Convert date strings to proper format
        const processedVars = { ...templateVars };
        if (processedVars.quote_date && typeof processedVars.quote_date === 'string') {
          processedVars.quote_date = dayjs(processedVars.quote_date).format('YYYY-MM-DD');
        }
        if (processedVars.valid_until && typeof processedVars.valid_until === 'string') {
          processedVars.valid_until = dayjs(processedVars.valid_until).format('YYYY-MM-DD');
        }

        // Type assertion needed as template vars may contain numeric values
        // that need to be converted to MonetaryValue in FormData
        setFormData((prev) => ({ ...prev, ...processedVars }) as FormData);
        toast.success(`Шаблон "${result.data.name}" загружен`);
      } else {
        console.error('Template load failed:', result.error);
        toast.error(`Ошибка загрузки шаблона: ${result.error}`);
      }
    } catch (error) {
      console.error('Template select error:', error);
      toast.error('Ошибка при загрузке шаблона');
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

    // Extract monetary values and convert to numbers for template storage
    const { variables } = extractMonetaryValues(formData);
    console.log('Form values to save:', variables);

    try {
      let result;

      if (templateSaveMode === 'update' && templateUpdateId) {
        console.log('>>> ENTERING UPDATE BRANCH');
        const existingTemplate = templates.find((t) => t.id === templateUpdateId);
        console.log('existingTemplate found:', existingTemplate);

        if (!existingTemplate) {
          toast.error('Шаблон не найден');
          return;
        }

        console.log('Calling updateTemplate with ID:', templateUpdateId);
        result = await quotesCalcService.updateTemplate(templateUpdateId, {
          name: existingTemplate.name,
          description: `Обновлено ${new Date().toLocaleDateString()}`,
          variables: variables as unknown as CalculationVariables,
          is_default: existingTemplate.is_default,
        });
        console.log('Template update result:', result);
      } else {
        if (!templateNewName.trim()) {
          toast.error('Введите название шаблона');
          return;
        }

        result = await quotesCalcService.createTemplate({
          name: templateNewName,
          description: `Создано ${new Date().toLocaleDateString()}`,
          variables: variables as unknown as CalculationVariables,
          is_default: false,
        });
        console.log('Template create result:', result);
      }

      if (result.success) {
        toast.success(templateSaveMode === 'update' ? 'Шаблон обновлен' : 'Шаблон создан');
        await loadTemplates();

        if (result.data?.id) {
          setSelectedTemplate(result.data.id);
        }

        setTemplateSaveModalVisible(false);
        console.log('Templates reloaded after save');
      } else {
        console.error('Template save failed:', result.error);
        toast.error(`Ошибка сохранения: ${result.error}`);
      }
    } catch (error) {
      console.error('Template save error:', error);
      toast.error('Ошибка при сохранении шаблона');
    }
  };

  // Clear all quote-level variables
  const handleClearVariables = () => {
    setFormData(initialFormData);
    toast.success('Все переменные очищены');
  };

  // Calculate quote
  const handleCalculate = async () => {
    // Validate required fields
    if (!formData.seller_company) {
      toast.error('Выберите компанию-продавца');
      return;
    }
    if (!formData.offer_sale_type) {
      toast.error('Выберите вид КП');
      return;
    }
    if (!formData.currency_of_quote) {
      toast.error('Выберите валюту КП');
      return;
    }
    if (!formData.offer_incoterms) {
      toast.error('Выберите базис поставки');
      return;
    }
    if (!formData.delivery_time) {
      toast.error('Укажите срок поставки');
      return;
    }

    // Validate customer selection
    if (!selectedCustomer) {
      toast.error('Выберите клиента');
      return;
    }

    // Validate products uploaded
    if (uploadedProducts.length === 0) {
      toast.error('Добавьте минимум 1 продукт');
      return;
    }

    // Validate each product has required fields
    const invalidProducts = uploadedProducts.filter(
      (p) =>
        !p.product_name ||
        p.base_price_vat === null ||
        p.base_price_vat === undefined ||
        !p.quantity
    );
    if (invalidProducts.length > 0) {
      toast.error(
        `Заполните все обязательные поля продуктов (название, цена с НДС, количество). Найдено незаполненных: ${invalidProducts.length}`
      );
      return;
    }

    setLoading(true);
    try {
      // Extract MonetaryValue objects from form values
      const { variables: processedFormValues, monetaryFields } = extractMonetaryValues(formData);

      // Merge form values with defaults
      const defaultVariables = quotesCalcService.getDefaultVariables();
      const variables = {
        ...defaultVariables,
        ...processedFormValues,
        monetary_fields: monetaryFields,
      };

      // Convert dates to ISO strings
      const quote_date = formData.quote_date || dayjs().format('YYYY-MM-DD');
      const valid_until = formData.valid_until || dayjs().add(7, 'day').format('YYYY-MM-DD');

      // Get quote currency for exchange rate lookup
      const quoteCurrency = formData.currency_of_quote || 'RUB';

      // Collect unique base currencies that need exchange rate lookup
      const uniqueBaseCurrencies = new Set<string>();
      uploadedProducts.forEach((product, index) => {
        const overrides = productOverrides.get(index);
        const baseCurrency =
          (overrides?.currency_of_base_price as string) ??
          product.currency_of_base_price ??
          formData.currency_of_base_price ??
          'USD';
        if (baseCurrency !== quoteCurrency) {
          uniqueBaseCurrencies.add(baseCurrency);
        }
      });

      // Fetch exchange rates for each unique currency pair
      const exchangeRates: Record<string, number> = {};
      for (const baseCurrency of uniqueBaseCurrencies) {
        try {
          const rateData = await exchangeRateService.getRate(baseCurrency, quoteCurrency);
          exchangeRates[baseCurrency] = rateData.rate;
        } catch (error) {
          console.warn(
            `Failed to fetch exchange rate ${baseCurrency}→${quoteCurrency}, using 1.0:`,
            error
          );
          exchangeRates[baseCurrency] = 1.0;
        }
      }

      // Build products with custom_fields
      const productsWithCustomFields = uploadedProducts.map((product, index) => {
        const overrides = productOverrides.get(index);

        const baseCurrency =
          (overrides?.currency_of_base_price as string) ??
          product.currency_of_base_price ??
          formData.currency_of_base_price ??
          'USD';

        const exchangeRate =
          (overrides?.exchange_rate_base_price_to_quote as number) ??
          product.exchange_rate_base_price_to_quote ??
          formData.exchange_rate_base_price_to_quote ??
          (baseCurrency === quoteCurrency ? 1.0 : (exchangeRates[baseCurrency] ?? 1.0));

        const productWithDefaults = {
          ...product,
          currency_of_base_price: baseCurrency,
          exchange_rate_base_price_to_quote: exchangeRate,
          supplier_discount:
            (overrides?.supplier_discount as number) ?? product.supplier_discount ?? 0,
          markup: (overrides?.markup as number) ?? product.markup ?? formData.markup ?? 0,
          supplier_country:
            (overrides?.supplier_country as string) ??
            product.supplier_country ??
            formData.supplier_country ??
            'Турция',
          customs_code:
            (overrides?.customs_code as string) ??
            product.customs_code ??
            formData.customs_code ??
            '',
          import_tariff:
            (overrides?.import_tariff as number) ??
            product.import_tariff ??
            formData.import_tariff ??
            0,
          excise_tax: (overrides?.excise_tax as number) ?? product.excise_tax ?? 0,
          util_fee: (overrides?.util_fee as number) ?? 0,
        };

        return {
          ...productWithDefaults,
          custom_fields: overrides || {},
        };
      });

      const result = await quotesCalcService.calculateQuote({
        customer_id: selectedCustomer,
        contact_id: selectedContact,
        products: productsWithCustomFields,
        variables: variables as CalculationVariables,
        title: `Коммерческое предложение от ${new Date().toLocaleDateString()}`,
        quote_date,
        valid_until,
      });

      if (result.success && result.data) {
        setCalculationResults(result.data);
        const quoteId = result.data.quote_id;
        // Support both idn_quote (new) and quote_number (legacy)
        const quoteIdnOrNumber = result.data.idn_quote || result.data.quote_number;

        console.log('✅ Quote created successfully:', quoteIdnOrNumber);
        console.log('✅ Quote ID for redirect:', quoteId);

        toast.success(`Котировка ${quoteIdnOrNumber} создана!`);

        if (quoteId) {
          console.log('Redirecting to view page:', `/quotes/${quoteId}`);
          setTimeout(() => {
            router.push(`/quotes/${quoteId}`);
          }, 1500);
        } else {
          console.error('❌ Quote ID is undefined, cannot redirect');
          toast.warning('КП создано, но не удалось перейти к просмотру');
        }
      } else {
        const errorText = result.error || 'Неизвестная ошибка';
        toast.error(`Ошибка расчета: ${errorText}`);
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
      // Checkbox selection column - PINNED LEFT
      {
        width: 50,
        pinned: 'left',
        lockPosition: true,
        suppressHeaderMenuButton: true,
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
            valueFormatter: (params: any) => params.value?.toFixed(2) || '',
            valueParser: (params: any) => parseDecimalInput(params.newValue),
          },
          {
            field: 'weight_in_kg',
            headerName: 'Вес (кг)',
            flex: 1,
            minWidth: 90,
            editable: true,
            type: 'numericColumn',
            cellStyle: { backgroundColor: '#fff' },
            valueFormatter: (params: any) => params.value?.toFixed(2) || '-',
            valueParser: (params: any) => parseDecimalInput(params.newValue),
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
              values: ['TRY', 'USD', 'EUR', 'CNY', 'RUB'],
            },
            cellStyle: (params: any) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
          },
          {
            field: 'supplier_country',
            headerName: 'Страна закупки',
            flex: 1,
            minWidth: 110,
            editable: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
              values: supplierCountries.map((c) => c.value),
            },
            cellStyle: (params: any) => ({
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
            cellStyle: (params: any) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
            valueFormatter: (params: any) => params.value?.toFixed(2) || '',
            valueParser: (params: any) => parseDecimalInput(params.newValue),
          },
          {
            field: 'exchange_rate_base_price_to_quote',
            headerName: 'Курс',
            flex: 1,
            minWidth: 90,
            editable: true,
            type: 'numericColumn',
            cellStyle: (params: any) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
            valueFormatter: (params: any) => params.value?.toFixed(4) || '',
            valueParser: (params: any) => parseDecimalInput(params.newValue),
          },
          {
            field: 'customs_code',
            headerName: 'Код ТН ВЭД',
            flex: 1,
            minWidth: 120,
            editable: true,
            cellStyle: (params: any) => ({
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
            cellStyle: (params: any) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
            valueFormatter: (params: any) => params.value?.toFixed(2) || '',
            valueParser: (params: any) => parseDecimalInput(params.newValue),
          },
          {
            field: 'excise_tax',
            headerName: 'Акциз (УЕ КП на тонну)',
            flex: 1,
            minWidth: 150,
            editable: true,
            type: 'numericColumn',
            cellStyle: (params: any) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
            valueFormatter: (params: any) => params.value?.toFixed(2) || '',
            valueParser: (params: any) => parseDecimalInput(params.newValue),
          },
          {
            field: 'util_fee',
            headerName: 'Утилизационный сбор (₽)',
            flex: 1,
            minWidth: 150,
            editable: true,
            type: 'numericColumn',
            cellStyle: (params: any) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
            valueFormatter: (params: any) => params.value?.toFixed(2) || '',
            valueParser: (params: any) => parseDecimalInput(params.newValue),
          },
          {
            field: 'markup',
            headerName: 'Наценка (%)',
            flex: 1,
            minWidth: 100,
            editable: true,
            type: 'numericColumn',
            cellStyle: (params: any) => ({
              backgroundColor: params.value ? '#e6f7ff' : '#f5f5f5',
            }),
            valueFormatter: (params: any) => params.value?.toFixed(2) || '',
            valueParser: (params: any) => parseDecimalInput(params.newValue),
          },
        ],
      },
    ],
    [supplierCountries]
  );

  // Default column properties
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

  // Bulk edit handler for applying value to selected rows
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

  // Open bulk edit modal
  const openBulkEditModal = () => {
    const selectedNodes = gridRef.current?.api.getSelectedNodes();
    if (!selectedNodes || selectedNodes.length === 0) {
      toast.warning('Выберите строки для массового редактирования');
      return;
    }
    setBulkEditModalVisible(true);
  };

  // Apply bulk edit
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

  // Calculate totals for results table
  const calculateTotals = (items: ProductCalculationResult[]) => ({
    quantity: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
    purchase_price_rub: items.reduce((sum, item) => sum + (item.purchase_price_rub || 0), 0),
    logistics_costs: items.reduce((sum, item) => sum + (item.logistics_costs || 0), 0),
    cogs: items.reduce((sum, item) => sum + (item.cogs || 0), 0),
    cogs_with_vat: items.reduce((sum, item) => sum + (item.cogs_with_vat || 0), 0),
    import_duties: items.reduce((sum, item) => sum + (item.import_duties || 0), 0),
    customs_fees: items.reduce((sum, item) => sum + (item.customs_fees || 0), 0),
    financing_costs: items.reduce((sum, item) => sum + (item.financing_costs || 0), 0),
    dm_fee: items.reduce((sum, item) => sum + (item.dm_fee || 0), 0),
    total_cost: items.reduce((sum, item) => sum + (item.total_cost || 0), 0),
    sale_price: items.reduce((sum, item) => sum + (item.sale_price || 0), 0),
    margin: items.reduce((sum, item) => sum + (item.margin || 0), 0),
  });

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push('/quotes')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <h1 className="text-2xl font-semibold">Создать котировку</h1>
          </div>
          {/* Admin Settings - Minimal Horizontal Display */}
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
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Чтобы рассчитать котировку</AlertTitle>
            <AlertDescription>
              {!selectedCustomer && <div>• Выберите клиента из списка ниже</div>}
              {uploadedProducts.length === 0 && (
                <div>• Загрузите файл с товарами (Excel или CSV)</div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Template & Customer Selector - Compact Inline */}
        <div className="bg-muted/50 rounded-lg p-3 flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">Шаблон:</span>
          <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
            <SelectTrigger className="w-[250px] h-8">
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

          <div className="h-6 w-px bg-border mx-2" />

          <span className="text-xs text-muted-foreground">Клиент:</span>
          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger className="w-[250px] h-8">
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

          {selectedCustomer && customerContacts.length > 0 && (
            <>
              <div className="h-6 w-px bg-border mx-2" />
              <span className="text-xs text-muted-foreground">Контакт:</span>
              <Select value={selectedContact} onValueChange={setSelectedContact}>
                <SelectTrigger className="w-[200px] h-8">
                  <SelectValue placeholder="Контактное лицо" />
                </SelectTrigger>
                <SelectContent>
                  {customerContacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                      {contact.position && ` (${contact.position})`}
                      {contact.is_primary && ' ★'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          <div className="h-6 w-px bg-border mx-2" />

          <span className="text-xs text-muted-foreground">Дата КП:</span>
          <Input
            type="date"
            value={formData.quote_date}
            onChange={(e) => {
              const newDate = e.target.value;
              setFormData((prev) => ({
                ...prev,
                quote_date: newDate,
                valid_until: dayjs(newDate).add(30, 'day').format('YYYY-MM-DD'),
              }));
            }}
            className="w-[140px] h-8"
          />

          <span className="text-xs text-muted-foreground">Действительно до:</span>
          <Input
            type="date"
            value={formData.valid_until}
            onChange={(e) => setFormData((prev) => ({ ...prev, valid_until: e.target.value }))}
            className="w-[140px] h-8"
          />
        </div>

        {/* Variables Form Info */}
        <p className="text-sm text-muted-foreground">
          🔧 Параметры котировки по умолчанию - эти значения будут применены ко всем товарам. Вы
          сможете переопределить их для отдельных товаров в таблице.
        </p>

        {/* Form Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 1. Company & Payment Combined Card */}
          <Card className="shadow-sm">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">🏢 Настройки компании и оплата</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {/* Company Settings Section */}
              <div className="text-xs font-semibold">Компания</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Компания-продавец *</Label>
                  <Select
                    value={formData.seller_company}
                    onValueChange={(v: string) =>
                      setFormData((prev) => ({ ...prev, seller_company: v }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Выберите компанию" />
                    </SelectTrigger>
                    <SelectContent>
                      {sellerCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.name}>
                          {company.name}
                          {company.country && ` (${company.country})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Вид КП *</Label>
                  <Select
                    value={formData.offer_sale_type}
                    onValueChange={(v: string) =>
                      setFormData((prev) => ({ ...prev, offer_sale_type: v }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Выберите вид" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="поставка">Поставка</SelectItem>
                      <SelectItem value="транзит">Транзит</SelectItem>
                      <SelectItem value="финтранзит">Финтранзит</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Валюта КП *</Label>
                  <Select
                    value={formData.currency_of_quote}
                    onValueChange={(v: string) =>
                      setFormData((prev) => ({ ...prev, currency_of_quote: v }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Выберите валюту" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RUB">RUB (Рубль)</SelectItem>
                      <SelectItem value="USD">USD (Доллар США)</SelectItem>
                      <SelectItem value="EUR">EUR (Евро)</SelectItem>
                      <SelectItem value="TRY">TRY (Турецкая лира)</SelectItem>
                      <SelectItem value="CNY">CNY (Юань)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Базис поставки *</Label>
                  <Select
                    value={formData.offer_incoterms}
                    onValueChange={(v: string) =>
                      setFormData((prev) => ({ ...prev, offer_incoterms: v }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Выберите базис" />
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
                  <Label className="text-xs">Срок поставки (дни) *</Label>
                  <div className="flex">
                    <Input
                      type="number"
                      min={0}
                      value={formData.delivery_time || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          delivery_time: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="h-8 rounded-r-none"
                    />
                    <span className="inline-flex items-center px-2 bg-muted border border-l-0 rounded-r-md text-xs">
                      дн
                    </span>
                  </div>
                  {deliveryDate && (
                    <Alert
                      variant={vatRate === '22%' ? 'destructive' : 'default'}
                      className="mt-2 py-2"
                    >
                      <AlertDescription className="text-xs">
                        Дата поставки: {deliveryDate.format('DD.MM.YYYY')} • НДС: {vatRate}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Наценка (%)</Label>
                  <div className="flex">
                    <Input
                      type="number"
                      min={0}
                      max={500}
                      value={formData.markup || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          markup: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="h-8 rounded-r-none"
                    />
                    <span className="inline-flex items-center px-2 bg-muted border border-l-0 rounded-r-md text-xs">
                      %
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Terms */}
              <div className="text-xs font-semibold mt-4">Условия оплаты</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Аванс от клиента (%)</Label>
                  <div className="flex">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={formData.advance_from_client || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          advance_from_client: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="h-8 rounded-r-none"
                    />
                    <span className="inline-flex items-center px-2 bg-muted border border-l-0 rounded-r-md text-xs">
                      %
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Дней от получения до оплаты</Label>
                  <div className="flex">
                    <Input
                      type="number"
                      min={0}
                      value={formData.time_to_advance_on_receiving || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          time_to_advance_on_receiving: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="h-8 rounded-r-none"
                    />
                    <span className="inline-flex items-center px-2 bg-muted border border-l-0 rounded-r-md text-xs">
                      дн
                    </span>
                  </div>
                </div>
              </div>

              {/* Advanced Payment Toggle */}
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto text-xs"
                onClick={() => setShowAdvancedPayment(!showAdvancedPayment)}
              >
                {showAdvancedPayment
                  ? '▼ Скрыть дополнительные условия оплаты'
                  : '▶ Показать дополнительные условия оплаты'}
              </Button>

              {showAdvancedPayment && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Дней до аванса</Label>
                    <div className="flex">
                      <Input
                        type="number"
                        min={0}
                        value={formData.time_to_advance || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            time_to_advance: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="h-8 rounded-r-none"
                      />
                      <span className="inline-flex items-center px-2 bg-muted border border-l-0 rounded-r-md text-xs">
                        дн
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Аванс поставщику (%)</Label>
                    <div className="flex">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={formData.advance_to_supplier || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            advance_to_supplier: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="h-8 rounded-r-none"
                      />
                      <span className="inline-flex items-center px-2 bg-muted border border-l-0 rounded-r-md text-xs">
                        %
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Аванс при заборе груза (%)</Label>
                    <div className="flex">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={formData.advance_on_loading || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            advance_on_loading: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="h-8 rounded-r-none"
                      />
                      <span className="inline-flex items-center px-2 bg-muted border border-l-0 rounded-r-md text-xs">
                        %
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Дней от забора до аванса</Label>
                    <div className="flex">
                      <Input
                        type="number"
                        min={0}
                        value={formData.time_to_advance_loading || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            time_to_advance_loading: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="h-8 rounded-r-none"
                      />
                      <span className="inline-flex items-center px-2 bg-muted border border-l-0 rounded-r-md text-xs">
                        дн
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Аванс при отправке в РФ (%)</Label>
                    <div className="flex">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={formData.advance_on_going_to_country_destination || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            advance_on_going_to_country_destination:
                              parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="h-8 rounded-r-none"
                      />
                      <span className="inline-flex items-center px-2 bg-muted border border-l-0 rounded-r-md text-xs">
                        %
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Дней от отправки до аванса</Label>
                    <div className="flex">
                      <Input
                        type="number"
                        min={0}
                        value={formData.time_to_advance_going_to_country_destination || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            time_to_advance_going_to_country_destination:
                              parseInt(e.target.value) || 0,
                          }))
                        }
                        className="h-8 rounded-r-none"
                      />
                      <span className="inline-flex items-center px-2 bg-muted border border-l-0 rounded-r-md text-xs">
                        дн
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Аванс при прохождении таможни (%)</Label>
                    <div className="flex">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={formData.advance_on_customs_clearance || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            advance_on_customs_clearance: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="h-8 rounded-r-none"
                      />
                      <span className="inline-flex items-center px-2 bg-muted border border-l-0 rounded-r-md text-xs">
                        %
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Дней от таможни до аванса</Label>
                    <div className="flex">
                      <Input
                        type="number"
                        min={0}
                        value={formData.time_to_advance_on_customs_clearance || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            time_to_advance_on_customs_clearance: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="h-8 rounded-r-none"
                      />
                      <span className="inline-flex items-center px-2 bg-muted border border-l-0 rounded-r-md text-xs">
                        дн
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* LPR Compensation Toggle */}
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto text-xs mt-4"
                onClick={() => setShowLprCompensation(!showLprCompensation)}
              >
                {showLprCompensation
                  ? '▼ Скрыть вознаграждение ЛПР'
                  : '▶ Показать вознаграждение ЛПР'}
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
                        <SelectItem value="%">Процент</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Размер вознаграждения</Label>
                    <Input
                      type="number"
                      min={0}
                      step={100}
                      value={formData.dm_fee_value || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          dm_fee_value: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="h-8"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Logistics & Customs Card */}
          <Card className="shadow-sm">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">🚚 Логистика и таможня</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {/* Logistics Section */}
              <div className="text-xs font-semibold">Логистика</div>

              {/* Toggle between Total and Detailed */}
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

              {/* Total Logistics Field */}
              {logisticsMode === 'total' && (
                <div className="space-y-1">
                  <Label className="text-xs">Логистика всего</Label>
                  <MonetaryInput
                    defaultCurrency="EUR"
                    placeholder="0.00"
                    value={formData.logistics_total}
                    onChange={handleLogisticsTotalChange}
                  />
                </div>
              )}

              {/* Detailed Logistics Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Поставщик - Хаб (50%)</Label>
                  <MonetaryInput
                    defaultCurrency="EUR"
                    placeholder="0.00"
                    disabled={logisticsMode === 'total'}
                    value={formData.logistics_supplier_hub}
                    onChange={(v) =>
                      v && setFormData((prev) => ({ ...prev, logistics_supplier_hub: v }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Хаб - Таможня РФ (30%)</Label>
                  <MonetaryInput
                    defaultCurrency="EUR"
                    placeholder="0.00"
                    disabled={logisticsMode === 'total'}
                    value={formData.logistics_hub_customs}
                    onChange={(v) =>
                      v && setFormData((prev) => ({ ...prev, logistics_hub_customs: v }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Таможня РФ - Клиент (20%)</Label>
                  <MonetaryInput
                    defaultCurrency="RUB"
                    placeholder="0.00"
                    disabled={logisticsMode === 'total'}
                    value={formData.logistics_customs_client}
                    onChange={(v) =>
                      v && setFormData((prev) => ({ ...prev, logistics_customs_client: v }))
                    }
                  />
                </div>
              </div>

              <hr className="my-4" />

              {/* Brokerage Section Toggle */}
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto text-xs"
                onClick={() => setShowBrokerage(!showBrokerage)}
              >
                {showBrokerage ? '▼ Скрыть брокеридж' : '▶ Показать брокеридж'}
              </Button>

              {showBrokerage && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Брокерские хаб</Label>
                    <MonetaryInput
                      defaultCurrency="EUR"
                      placeholder="0.00"
                      value={formData.brokerage_hub}
                      onChange={(v) => v && setFormData((prev) => ({ ...prev, brokerage_hub: v }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Брокерские РФ</Label>
                    <MonetaryInput
                      defaultCurrency="RUB"
                      placeholder="0.00"
                      value={formData.brokerage_customs}
                      onChange={(v) =>
                        v && setFormData((prev) => ({ ...prev, brokerage_customs: v }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Расходы на СВХ</Label>
                    <MonetaryInput
                      defaultCurrency="RUB"
                      placeholder="0.00"
                      value={formData.warehousing_at_customs}
                      onChange={(v) =>
                        v && setFormData((prev) => ({ ...prev, warehousing_at_customs: v }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Разрешительные документы</Label>
                    <MonetaryInput
                      defaultCurrency="RUB"
                      placeholder="0.00"
                      value={formData.customs_documentation}
                      onChange={(v) =>
                        v && setFormData((prev) => ({ ...prev, customs_documentation: v }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Прочие расходы</Label>
                    <MonetaryInput
                      defaultCurrency="RUB"
                      placeholder="0.00"
                      value={formData.brokerage_extra}
                      onChange={(v) =>
                        v && setFormData((prev) => ({ ...prev, brokerage_extra: v }))
                      }
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Customs Clearance Card */}
          <Card className="shadow-sm">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">🛃 Таможенная очистка</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Значения по умолчанию для таможенной очистки
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Код ТН ВЭД</Label>
                <Input
                  placeholder="8482102009"
                  value={formData.customs_code}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, customs_code: e.target.value }))
                  }
                  className="h-8"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Пошлина (%)</Label>
                  <div className="flex">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={formData.import_tariff || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          import_tariff: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="h-8 rounded-r-none"
                    />
                    <span className="inline-flex items-center px-2 bg-muted border border-l-0 rounded-r-md text-xs">
                      %
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Акциз (за кг)</Label>
                  <MonetaryInput
                    defaultCurrency="RUB"
                    placeholder="0.00"
                    value={formData.excise_tax}
                    onChange={(v) => v && setFormData((prev) => ({ ...prev, excise_tax: v }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* File Upload */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base">📁 Загрузить товары</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
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
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm mb-2">Нажмите или перетащите файл Excel/CSV</p>
              <p className="text-xs text-muted-foreground mb-4">
                Поддерживаются форматы: .xlsx, .xls, .csv
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" asChild>
                  <span>Выбрать файл</span>
                </Button>
              </label>
            </div>

            {uploadedFileName && (
              <div className="mt-4 flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">{uploadedFileName}</span>
                  <Badge variant="secondary">{uploadedProducts.length} товаров</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={handleRemoveFile}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products Grid Section */}
        {uploadedProducts.length > 0 && (
          <Card>
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base">📋 Загруженные товары</CardTitle>
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
            <CardContent className="px-4 pb-4">
              <p className="text-xs text-muted-foreground mb-3">
                💡 Совет: Выберите строки, затем используйте &quot;Массовое редактирование&quot; или
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
                    const rowIndex = event.rowIndex;
                    const field = event.colDef?.field;
                    const newValue = event.newValue;

                    if (rowIndex === null || rowIndex === undefined || !field) return;

                    // Track this cell as manually edited
                    const cellKey = `${rowIndex}-${field}`;
                    setEditedCells((prev) => new Set(prev).add(cellKey));

                    // Store the override value
                    setProductOverrides((prev) => {
                      const newMap = new Map(prev);
                      const overrides = newMap.get(rowIndex) || {};
                      overrides[field] = newValue;
                      newMap.set(rowIndex, overrides);
                      return newMap;
                    });

                    // Update product data in state
                    setUploadedProducts((prevProducts) => {
                      const updatedProducts = [...prevProducts];
                      if (rowIndex !== null && rowIndex !== undefined) {
                        updatedProducts[rowIndex] = event.data as Product;
                      }
                      return updatedProducts;
                    });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Calculate and Clear Buttons */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <Button size="lg" className="w-full" onClick={handleCalculate} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-2" />
              )}
              Рассчитать котировку
            </Button>
            <Button variant="outline" size="lg" className="w-full" onClick={handleClearVariables}>
              <XCircle className="h-4 w-4 mr-2" />
              Очистить все переменные
            </Button>
            {(!selectedCustomer || uploadedProducts.length === 0) && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Перед расчетом проверьте:</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5 mt-2">
                    {!selectedCustomer && <li>Выберите клиента из списка</li>}
                    {uploadedProducts.length === 0 && <li>Загрузите файл с товарами</li>}
                    <li>Заполните все обязательные поля (отмечены красным при пропуске)</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        {calculationResults && (
          <Card>
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                📊 Результаты - {calculationResults.idn_quote || calculationResults.quote_number}
              </CardTitle>
              <Badge variant="default" className="text-sm">
                Итого: ₽{calculationResults.total_amount?.toFixed(2)}
              </Badge>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xs text-muted-foreground mb-4">
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
                      <th className="text-right py-2 px-2 font-medium">С/с+НДС</th>
                      <th className="text-right py-2 px-2 font-medium">Пошлина</th>
                      <th className="text-right py-2 px-2 font-medium">Акциз+Утиль</th>
                      <th className="text-right py-2 px-2 font-medium">Финансир</th>
                      <th className="text-right py-2 px-2 font-medium">Вознагр</th>
                      <th className="text-right py-2 px-2 font-medium">Итого СБС</th>
                      <th className="text-right py-2 px-2 font-medium">Продажа</th>
                      <th className="text-right py-2 px-2 font-medium">Маржа</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(calculationResults.items || []).map(
                      (item: ProductCalculationResult, idx: number) => (
                        <tr
                          key={item.product_code || item.product_name || idx}
                          className="border-b"
                        >
                          <td className="py-2 px-2 max-w-[200px] truncate">{item.product_name}</td>
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
                          <td className="py-2 px-2 text-right">{item.cogs_with_vat?.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right">{item.import_duties?.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right">{item.customs_fees?.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right">
                            {item.financing_costs?.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right">{item.dm_fee?.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right font-semibold">
                            {item.total_cost?.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right font-semibold">
                            {item.sale_price?.toFixed(2)}
                          </td>
                          <td
                            className={`py-2 px-2 text-right ${item.margin && item.margin > 0 ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {item.margin?.toFixed(2)}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                  <tfoot>
                    {calculationResults.items && calculationResults.items.length > 0 && (
                      <tr className="bg-muted font-semibold">
                        <td className="py-2 px-2">ИТОГО СБС</td>
                        <td className="py-2 px-2 text-right">
                          {calculateTotals(calculationResults.items).quantity}
                        </td>
                        <td className="py-2 px-2 text-right">—</td>
                        <td className="py-2 px-2 text-right">—</td>
                        <td className="py-2 px-2 text-right">
                          {calculateTotals(calculationResults.items).purchase_price_rub.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {calculateTotals(calculationResults.items).logistics_costs.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {calculateTotals(calculationResults.items).cogs.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {calculateTotals(calculationResults.items).cogs_with_vat.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {calculateTotals(calculationResults.items).import_duties.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {calculateTotals(calculationResults.items).customs_fees.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {calculateTotals(calculationResults.items).financing_costs.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {calculateTotals(calculationResults.items).dm_fee.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {calculateTotals(calculationResults.items).total_cost.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {calculateTotals(calculationResults.items).sale_price.toFixed(2)}
                        </td>
                        <td
                          className={`py-2 px-2 text-right ${calculateTotals(calculationResults.items).margin > 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {calculateTotals(calculationResults.items).margin.toFixed(2)}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

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
                  ) : bulkEditField === 'supplier_country' ? (
                    <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите страну" />
                      </SelectTrigger>
                      <SelectContent>
                        {supplierCountries.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : bulkEditField === 'customs_code' ? (
                    <Input
                      value={bulkEditValue}
                      onChange={(e) => setBulkEditValue(e.target.value)}
                      placeholder="Введите код ТН ВЭД"
                      onKeyDown={(e) => e.key === 'Enter' && applyBulkEdit()}
                    />
                  ) : (
                    <Input
                      type="number"
                      value={bulkEditValue}
                      onChange={(e) => setBulkEditValue(e.target.value)}
                      placeholder="Введите числовое значение"
                      min={0}
                      step={bulkEditField.includes('rate') ? 0.0001 : 0.01}
                      onKeyDown={(e) => e.key === 'Enter' && applyBulkEdit()}
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
                      id={colId}
                      checked={isVisible}
                      onCheckedChange={(checked: boolean) => {
                        gridRef.current?.api?.setColumnsVisible([colId], !!checked);
                        setColumnVisibilityRefresh((prev) => prev + 1);
                      }}
                    />
                    <Label htmlFor={colId} className="text-sm cursor-pointer">
                      {headerName}
                    </Label>
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="mode-new"
                      name="template-mode"
                      checked={templateSaveMode === 'new'}
                      onChange={() => setTemplateSaveMode('new')}
                    />
                    <Label htmlFor="mode-new" className="cursor-pointer">
                      Создать новый шаблон
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="mode-update"
                      name="template-mode"
                      checked={templateSaveMode === 'update'}
                      onChange={() => setTemplateSaveMode('update')}
                      disabled={templates.length === 0}
                    />
                    <Label
                      htmlFor="mode-update"
                      className={`cursor-pointer ${templates.length === 0 ? 'text-muted-foreground' : ''}`}
                    >
                      Обновить существующий шаблон
                    </Label>
                  </div>
                </div>
              </div>

              {templateSaveMode === 'new' && (
                <div className="space-y-2">
                  <Label>Название нового шаблона</Label>
                  <Input
                    value={templateNewName}
                    onChange={(e) => setTemplateNewName(e.target.value)}
                    placeholder="Введите название"
                    onKeyDown={(e) => e.key === 'Enter' && performTemplateSave()}
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
      </div>
    </MainLayout>
  );
}
