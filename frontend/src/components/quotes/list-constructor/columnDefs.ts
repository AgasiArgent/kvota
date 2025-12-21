/**
 * Column Definitions for Quote List Constructor
 *
 * TASK-008: Quote List Constructor with Department Presets
 *
 * These definitions map to the backend list_query_builder.py columns.
 * Each column has:
 * - field: Backend column key
 * - headerName: Russian display name
 * - width: Default column width
 * - type: Column type for formatting
 * - category: Grouping for column picker UI
 */

import { ColDef, ValueFormatterParams } from 'ag-grid-community';

// =============================================================================
// Types
// =============================================================================

export interface ColumnDefinition extends ColDef {
  field: string;
  headerName: string;
  category: ColumnCategory;
  description?: string;
}

export type ColumnCategory =
  | 'identity'
  | 'manager'
  | 'customer'
  | 'financials'
  | 'delivery'
  | 'variables'
  | 'calculations'
  | 'derived';

// =============================================================================
// Formatters
// =============================================================================

const currencyFormatters = new Map<string, Intl.NumberFormat>();

const getCurrencyFormatter = (currency: string) => {
  if (!currencyFormatters.has(currency)) {
    currencyFormatters.set(
      currency,
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    );
  }
  return currencyFormatters.get(currency)!;
};

export const formatCurrency = (value: number | null | undefined, currency = 'USD'): string => {
  if (value === null || value === undefined) return '—';
  return getCurrencyFormatter(currency).format(value);
};

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU');
};

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

export const formatNumber = (value: number | null | undefined, decimals = 0): string => {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// =============================================================================
// Column Definitions
// =============================================================================

export const ALL_COLUMNS: ColumnDefinition[] = [
  // -------------------------------------------------------------------------
  // IDENTITY & DATES
  // -------------------------------------------------------------------------
  {
    field: 'quote_number',
    headerName: '№ КП',
    category: 'identity',
    width: 140,
    pinned: 'left',
  },
  {
    field: 'idn_quote',
    headerName: 'IDN КП',
    category: 'identity',
    width: 200,
  },
  {
    field: 'created_at',
    headerName: 'Дата создания',
    category: 'identity',
    width: 150,
    valueFormatter: (params: ValueFormatterParams) => formatDateTime(params.value),
  },
  {
    field: 'updated_at',
    headerName: 'Изменено',
    category: 'identity',
    width: 150,
    valueFormatter: (params: ValueFormatterParams) => formatDateTime(params.value),
  },
  {
    field: 'workflow_state',
    headerName: 'Статус',
    category: 'identity',
    width: 150,
  },
  {
    field: 'status',
    headerName: 'Статус КП',
    category: 'identity',
    width: 120,
  },

  // -------------------------------------------------------------------------
  // MANAGER & APPROVALS
  // -------------------------------------------------------------------------
  {
    field: 'manager_name',
    headerName: 'Менеджер',
    category: 'manager',
    width: 180,
  },
  {
    field: 'manager_email',
    headerName: 'Email менеджера',
    category: 'manager',
    width: 200,
  },
  {
    field: 'financial_reviewed_at',
    headerName: 'Дата согласования',
    category: 'manager',
    width: 160,
    valueFormatter: (params: ValueFormatterParams) => formatDateTime(params.value),
  },

  // -------------------------------------------------------------------------
  // CUSTOMER
  // -------------------------------------------------------------------------
  {
    field: 'customer_name',
    headerName: 'Заказчик',
    category: 'customer',
    width: 250,
    flex: 1,
    minWidth: 180,
  },
  {
    field: 'customer_inn',
    headerName: 'ИНН заказчика',
    category: 'customer',
    width: 140,
  },
  {
    field: 'customer_company_type',
    headerName: 'Форма заказчика',
    category: 'customer',
    width: 130,
  },

  // -------------------------------------------------------------------------
  // QUOTE FINANCIALS
  // -------------------------------------------------------------------------
  {
    field: 'currency',
    headerName: 'Валюта',
    category: 'financials',
    width: 90,
  },
  {
    field: 'total_with_vat_quote',
    headerName: 'Сумма с НДС',
    category: 'financials',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) =>
      formatCurrency(params.value, params.data?.currency || 'USD'),
  },
  {
    field: 'total_with_vat_usd',
    headerName: 'Сумма USD',
    category: 'financials',
    width: 140,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'total_profit_usd',
    headerName: 'Прибыль USD',
    category: 'financials',
    width: 140,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'total_quantity',
    headerName: 'Кол-во',
    category: 'financials',
    width: 100,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatNumber(params.value),
  },
  {
    field: 'total_weight_kg',
    headerName: 'Вес (кг)',
    category: 'financials',
    width: 110,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatNumber(params.value, 2),
  },

  // -------------------------------------------------------------------------
  // DELIVERY & PAYMENT
  // -------------------------------------------------------------------------
  {
    field: 'delivery_terms',
    headerName: 'Базис поставки',
    category: 'delivery',
    width: 130,
  },
  {
    field: 'delivery_days',
    headerName: 'Срок (дни)',
    category: 'delivery',
    width: 110,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatNumber(params.value),
  },
  {
    field: 'payment_terms',
    headerName: 'Условия оплаты',
    category: 'delivery',
    width: 200,
  },

  // -------------------------------------------------------------------------
  // CALCULATION VARIABLES
  // -------------------------------------------------------------------------
  {
    field: 'seller_company',
    headerName: 'Орг-продавец',
    category: 'variables',
    width: 180,
  },
  {
    field: 'offer_sale_type',
    headerName: 'Тип сделки',
    category: 'variables',
    width: 130,
  },
  {
    field: 'client_advance_percent',
    headerName: 'Аванс клиента %',
    category: 'variables',
    width: 140,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatPercent(params.value),
  },
  {
    field: 'supplier_advance_percent',
    headerName: 'Аванс пост-ку %',
    category: 'variables',
    width: 150,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatPercent(params.value),
  },
  {
    field: 'time_to_advance_on_receiving',
    headerName: 'Дни до оплаты',
    category: 'variables',
    width: 140,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatNumber(params.value),
  },
  {
    field: 'logistics_supplier_hub',
    headerName: 'Логист. пост-хаб',
    category: 'variables',
    width: 150,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'EUR'),
  },
  {
    field: 'logistics_hub_customs',
    headerName: 'Логист. хаб-там.',
    category: 'variables',
    width: 150,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'EUR'),
  },
  {
    field: 'logistics_customs_client',
    headerName: 'Логист. там-клиент',
    category: 'variables',
    width: 160,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'RUB'),
  },

  // -------------------------------------------------------------------------
  // CALCULATION SUMMARIES
  // -------------------------------------------------------------------------
  {
    field: 'calc_ak16_final_price_total_quote',
    headerName: 'Сумма без НДС',
    category: 'calculations',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) =>
      formatCurrency(params.value, params.data?.currency || 'USD'),
  },
  {
    field: 'calc_s13_sum_purchase_prices',
    headerName: 'Сумма закупки',
    category: 'calculations',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_bj11_total_financing_cost',
    headerName: 'Стоим. финанс.',
    category: 'calculations',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_bl5_credit_sales_interest',
    headerName: 'Комис. рассрочки',
    category: 'calculations',
    width: 160,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_bh3_client_advance',
    headerName: 'Аванс клиента',
    category: 'calculations',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) =>
      formatCurrency(params.value, params.data?.currency || 'USD'),
  },
  {
    field: 'calc_supplier_advance_total',
    headerName: 'Аванс пост-ку',
    category: 'calculations',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_purchase_with_vat_usd_total',
    headerName: 'Закупка с НДС',
    category: 'calculations',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_ah13_forex_risk_reserve_total',
    headerName: 'Резерв курс. разн.',
    category: 'calculations',
    width: 160,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_ai13_financial_agent_fee_total',
    headerName: 'Комис. фин. агента',
    category: 'calculations',
    width: 170,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_ab13_cogs_total',
    headerName: 'Себестоимость',
    category: 'calculations',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_y13_customs_duty_total',
    headerName: 'Пошлина',
    category: 'calculations',
    width: 130,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_z13_excise_tax_total',
    headerName: 'Акциз',
    category: 'calculations',
    width: 120,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_an13_sales_vat_total',
    headerName: 'НДС с продаж',
    category: 'calculations',
    width: 140,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_ao13_import_vat_total',
    headerName: 'Импортный НДС',
    category: 'calculations',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_ap13_net_vat_payable_total',
    headerName: 'НДС к уплате',
    category: 'calculations',
    width: 140,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_aq13_transit_commission_total',
    headerName: 'Комис. транзит',
    category: 'calculations',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_ag13_dm_fee_total',
    headerName: 'Вознагражд. ЛПР',
    category: 'calculations',
    width: 160,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_internal_margin_total',
    headerName: 'Внутр. наценка',
    category: 'calculations',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_tax_turkey_total',
    headerName: 'Налог Турция',
    category: 'calculations',
    width: 140,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_tax_russia_total',
    headerName: 'Налог Россия',
    category: 'calculations',
    width: 140,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },

  // -------------------------------------------------------------------------
  // NEW QUOTE FIELDS
  // -------------------------------------------------------------------------
  {
    field: 'document_folder_link',
    headerName: 'Ссылка на папку',
    category: 'identity',
    width: 200,
  },
  {
    field: 'spec_sign_date',
    headerName: 'Дата подписания',
    category: 'identity',
    width: 150,
    valueFormatter: (params: ValueFormatterParams) => formatDate(params.value),
  },

  // -------------------------------------------------------------------------
  // DERIVED FIELDS
  // -------------------------------------------------------------------------
  {
    field: 'logistics_eu_tr',
    headerName: 'Логистика ЕС+ТР',
    category: 'derived',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'EUR'),
  },
  {
    field: 'logistics_total',
    headerName: 'Итого логистика',
    category: 'derived',
    width: 160,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'tax_total_tr_rf',
    headerName: 'Налог ТР+РФ',
    category: 'derived',
    width: 140,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'week_number',
    headerName: '№ недели',
    category: 'derived',
    width: 100,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatNumber(params.value),
  },
  {
    field: 'month_number',
    headerName: 'Месяц',
    category: 'derived',
    width: 90,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatNumber(params.value),
  },
  {
    field: 'year_number',
    headerName: 'Год',
    category: 'derived',
    width: 80,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatNumber(params.value),
  },
  {
    field: 'is_current_week',
    headerName: 'Текущ. неделя',
    category: 'derived',
    width: 130,
    valueFormatter: (params: ValueFormatterParams) => (params.value ? 'Да' : 'Нет'),
  },
  {
    field: 'is_current_month',
    headerName: 'Текущ. месяц',
    category: 'derived',
    width: 130,
    valueFormatter: (params: ValueFormatterParams) => (params.value ? 'Да' : 'Нет'),
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get columns by category
 */
export const getColumnsByCategory = (category: ColumnCategory): ColumnDefinition[] => {
  return ALL_COLUMNS.filter((col) => col.category === category);
};

/**
 * Get column definition by field name
 */
export const getColumnByField = (field: string): ColumnDefinition | undefined => {
  return ALL_COLUMNS.find((col) => col.field === field);
};

/**
 * Build ag-Grid ColDef array from field names
 */
export const buildColDefs = (fields: string[]): ColDef[] => {
  const result: ColDef[] = [];

  for (const field of fields) {
    const colDef = getColumnByField(field);
    if (colDef) {
      // Return a clean ColDef without our custom properties
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { category, description, ...cleanColDef } = colDef;
      result.push(cleanColDef as ColDef);
    }
  }

  return result;
};

/**
 * Category labels in Russian
 */
export const CATEGORY_LABELS: Record<ColumnCategory, string> = {
  identity: 'Идентификация',
  manager: 'Менеджер',
  customer: 'Заказчик',
  financials: 'Финансы',
  delivery: 'Доставка',
  variables: 'Переменные',
  calculations: 'Расчеты',
  derived: 'Вычисляемые',
};

/**
 * Default columns for Sales preset
 */
export const SALES_PRESET_COLUMNS = [
  'quote_number',
  'customer_name',
  'manager_name',
  'total_with_vat_quote',
  'total_with_vat_usd',
  'total_profit_usd',
  'workflow_state',
  'created_at',
];

/**
 * Default columns for Logistics preset
 */
export const LOGISTICS_PRESET_COLUMNS = [
  'quote_number',
  'customer_name',
  'delivery_terms',
  'delivery_days',
  'logistics_supplier_hub',
  'logistics_hub_customs',
  'logistics_customs_client',
  'logistics_total',
  'total_weight_kg',
  'workflow_state',
];

/**
 * Default columns for Accounting preset
 */
export const ACCOUNTING_PRESET_COLUMNS = [
  'quote_number',
  'customer_name',
  'customer_inn',
  'currency',
  'total_with_vat_quote',
  'calc_an13_sales_vat_total',
  'calc_ao13_import_vat_total',
  'calc_ap13_net_vat_payable_total',
  'calc_y13_customs_duty_total',
  'workflow_state',
];

/**
 * Default columns for Management preset
 */
export const MANAGEMENT_PRESET_COLUMNS = [
  'quote_number',
  'customer_name',
  'manager_name',
  'total_with_vat_usd',
  'total_profit_usd',
  'calc_internal_margin_total',
  'tax_total_tr_rf',
  'week_number',
  'workflow_state',
  'financial_reviewed_at',
];
