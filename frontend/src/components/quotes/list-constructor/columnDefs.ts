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
    headerName: 'Номер КП',
    description: 'Уникальный номер коммерческого предложения',
    category: 'identity',
    width: 140,
    pinned: 'left',
  },
  {
    field: 'idn_quote',
    headerName: 'Идентификатор КП',
    description: 'Уникальный идентификатор сделки (IDN)',
    category: 'identity',
    width: 200,
  },
  {
    field: 'created_at',
    headerName: 'Дата создания',
    description: 'Дата и время создания КП',
    category: 'identity',
    width: 150,
    valueFormatter: (params: ValueFormatterParams) => formatDateTime(params.value),
  },
  {
    field: 'updated_at',
    headerName: 'Дата изменения',
    description: 'Дата и время последнего изменения КП',
    category: 'identity',
    width: 150,
    valueFormatter: (params: ValueFormatterParams) => formatDateTime(params.value),
  },
  {
    field: 'workflow_state',
    headerName: 'Статус согласования',
    description: 'Текущий этап согласования КП (черновик, на согласовании, утверждено)',
    category: 'identity',
    width: 150,
  },
  {
    field: 'status',
    headerName: 'Статус КП',
    description: 'Статус коммерческого предложения',
    category: 'identity',
    width: 120,
  },

  // -------------------------------------------------------------------------
  // MANAGER & APPROVALS
  // -------------------------------------------------------------------------
  {
    field: 'manager_name',
    headerName: 'Менеджер',
    description: 'Ответственный менеджер по продажам',
    category: 'manager',
    width: 180,
  },
  {
    field: 'manager_email',
    headerName: 'Email менеджера',
    description: 'Электронная почта менеджера',
    category: 'manager',
    width: 200,
  },
  {
    field: 'financial_reviewed_at',
    headerName: 'Дата согласования',
    description: 'Дата финансового согласования КП',
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
    description: 'Наименование заказчика (покупателя)',
    category: 'customer',
    width: 250,
    flex: 1,
    minWidth: 180,
  },
  {
    field: 'customer_inn',
    headerName: 'ИНН заказчика',
    description: 'ИНН заказчика',
    category: 'customer',
    width: 140,
  },
  {
    field: 'customer_company_type',
    headerName: 'Форма заказчика',
    description: 'Организационно-правовая форма заказчика (ООО, АО, ИП)',
    category: 'customer',
    width: 130,
  },

  // -------------------------------------------------------------------------
  // QUOTE FINANCIALS
  // -------------------------------------------------------------------------
  {
    field: 'currency',
    headerName: 'Валюта КП',
    description: 'Валюта коммерческого предложения',
    category: 'financials',
    width: 100,
  },
  {
    field: 'total_with_vat_quote',
    headerName: 'Сумма с НДС',
    description: 'Итого сумма продажи с НДС в валюте КП',
    category: 'financials',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) =>
      formatCurrency(params.value, params.data?.currency || 'USD'),
  },
  {
    field: 'total_with_vat_usd',
    headerName: 'Сумма в USD',
    description: 'Итого сумма продажи с НДС в USD эквиваленте',
    category: 'financials',
    width: 140,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'total_profit_usd',
    headerName: 'Прибыль в USD',
    description: 'Гросс профит (маржа) в USD эквиваленте',
    category: 'financials',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'total_quantity',
    headerName: 'Количество',
    description: 'Общее количество позиций в КП',
    category: 'financials',
    width: 120,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatNumber(params.value),
  },
  {
    field: 'total_weight_kg',
    headerName: 'Общий вес (кг)',
    description: 'Общий вес всех позиций в килограммах',
    category: 'financials',
    width: 130,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatNumber(params.value, 2),
  },

  // -------------------------------------------------------------------------
  // DELIVERY & PAYMENT
  // -------------------------------------------------------------------------
  {
    field: 'delivery_terms',
    headerName: 'Базис поставки',
    description: 'Условия поставки по Incoterms (EXW, DAP, DDP и др.)',
    category: 'delivery',
    width: 130,
  },
  {
    field: 'delivery_days',
    headerName: 'Срок поставки (дни)',
    description: 'Срок поставки товара в днях после получения аванса от клиента',
    category: 'delivery',
    width: 150,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatNumber(params.value),
  },
  {
    field: 'delivery_city',
    headerName: 'Город доставки',
    description: 'Город доставки в РФ (вводится менеджером по продажам)',
    category: 'delivery',
    width: 150,
  },
  {
    field: 'cargo_type',
    headerName: 'Тип груза',
    description: 'Тип контейнера/перевозки: FCL (цельный), LCL (сборный), AIR, RAIL',
    category: 'delivery',
    width: 120,
  },
  {
    field: 'pickup_countries',
    headerName: 'Страны забора груза',
    description: 'Страны, откуда забирается груз (агрегация по всем позициям)',
    category: 'delivery',
    width: 180,
  },
  {
    field: 'supplier_payment_countries',
    headerName: 'Страны оплаты поставщику',
    description: 'Страны, в которых производится оплата поставщикам',
    category: 'delivery',
    width: 200,
  },
  {
    field: 'production_time_range',
    headerName: 'Срок производства',
    description: 'Диапазон сроков производства по всем позициям (мин-макс дней)',
    category: 'delivery',
    width: 160,
  },
  {
    field: 'payment_terms',
    headerName: 'Условия оплаты клиента',
    description: 'Описание условий расчетов с заказчиком',
    category: 'delivery',
    width: 200,
  },
  {
    field: 'purchasing_companies_list',
    headerName: 'Компании закупки',
    description: 'Наши юр. лица, через которые идет оплата поставщикам',
    category: 'delivery',
    width: 180,
  },

  // -------------------------------------------------------------------------
  // CALCULATION VARIABLES
  // -------------------------------------------------------------------------
  {
    field: 'seller_company',
    headerName: 'Организация-продавец',
    description: 'Юридическое лицо, от которого идет контрактация',
    category: 'variables',
    width: 200,
  },
  {
    field: 'offer_sale_type',
    headerName: 'Тип сделки',
    description: 'Тип сделки: поставка, транзит, финтранзит, экспорт',
    category: 'variables',
    width: 130,
  },
  {
    field: 'client_advance_percent',
    headerName: 'Аванс клиента (%)',
    description: 'Размер аванса от клиента в процентах',
    category: 'variables',
    width: 160,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatPercent(params.value),
  },
  {
    field: 'supplier_advance_percent',
    headerName: 'Аванс поставщику (%)',
    description: 'Размер аванса поставщику в процентах',
    category: 'variables',
    width: 180,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatPercent(params.value),
  },
  {
    field: 'time_to_advance_on_receiving',
    headerName: 'Дней до финальной оплаты',
    description: 'Срок финальной оплаты после поставки в днях',
    category: 'variables',
    width: 200,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatNumber(params.value),
  },
  {
    field: 'logistics_supplier_hub',
    headerName: 'Логистика: поставщик → хаб',
    description: 'Стоимость логистики от поставщика до хаба (EUR)',
    category: 'variables',
    width: 200,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'EUR'),
  },
  {
    field: 'logistics_hub_customs',
    headerName: 'Логистика: хаб → таможня',
    description: 'Стоимость логистики от хаба до таможни (EUR)',
    category: 'variables',
    width: 200,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'EUR'),
  },
  {
    field: 'logistics_customs_client',
    headerName: 'Логистика: таможня → клиент',
    description: 'Стоимость логистики от таможни до клиента (RUB)',
    category: 'variables',
    width: 210,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'RUB'),
  },

  // -------------------------------------------------------------------------
  // CALCULATION SUMMARIES
  // -------------------------------------------------------------------------
  {
    field: 'calc_ak16_final_price_total_quote',
    headerName: 'Сумма без НДС',
    description: 'Сумма продажи без НДС в валюте КП',
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
    description: 'Сумма закупки в валюте КП без НДС',
    category: 'calculations',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_bj11_total_financing_cost',
    headerName: 'Стоимость финансирования',
    description: 'Итого стоимость финансирования (стоимость денег)',
    category: 'calculations',
    width: 200,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_bl5_credit_sales_interest',
    headerName: 'Комиссия за рассрочку',
    description: 'Комиссия за предоставление рассрочки клиенту',
    category: 'calculations',
    width: 190,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_bh3_client_advance',
    headerName: 'Аванс от клиента',
    description: 'Сумма аванса от заказчика при подписании спецификации',
    category: 'calculations',
    width: 170,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) =>
      formatCurrency(params.value, params.data?.currency || 'USD'),
  },
  {
    field: 'calc_supplier_advance_total',
    headerName: 'Аванс поставщику',
    description: 'Размер аванса поставщику',
    category: 'calculations',
    width: 170,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_purchase_with_vat_usd_total',
    headerName: 'Закупка с НДС',
    description: 'Сумма закупки с учетом НДС в USD',
    category: 'calculations',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_ah13_forex_risk_reserve_total',
    headerName: 'Резерв на курсовую разницу',
    description: 'Резерв на отрицательную курсовую разницу',
    category: 'calculations',
    width: 220,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_ai13_financial_agent_fee_total',
    headerName: 'Комиссия финансового агента',
    description: 'Комиссия финансового агента за сделку',
    category: 'calculations',
    width: 230,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_ab13_cogs_total',
    headerName: 'Себестоимость товара',
    description: 'Итого себестоимость товара без НДС',
    category: 'calculations',
    width: 180,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_y13_customs_duty_total',
    headerName: 'Таможенная пошлина',
    description: 'Сумма таможенной пошлины',
    category: 'calculations',
    width: 180,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_z13_excise_tax_total',
    headerName: 'Акцизный сбор',
    description: 'Сумма акцизного сбора',
    category: 'calculations',
    width: 140,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_an13_sales_vat_total',
    headerName: 'НДС с продаж',
    description: 'Сумма НДС с продаж',
    category: 'calculations',
    width: 140,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_ao13_import_vat_total',
    headerName: 'НДС при импорте',
    description: 'НДС при импорте в РФ (вычитаемый)',
    category: 'calculations',
    width: 160,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_ap13_net_vat_payable_total',
    headerName: 'НДС к уплате',
    description: 'НДС к уплате за вычетом импортного НДС',
    category: 'calculations',
    width: 150,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_aq13_transit_commission_total',
    headerName: 'Комиссия за транзит',
    description: 'Комиссия за транзит через третьи страны',
    category: 'calculations',
    width: 180,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_ag13_dm_fee_total',
    headerName: 'Вознаграждение ЛПР',
    description: 'Вознаграждение лицу, принимающему решение (откат)',
    category: 'calculations',
    width: 180,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_internal_margin_total',
    headerName: 'Внутренняя наценка',
    description: 'Внутренняя наценка (разница AY16 - S16)',
    category: 'calculations',
    width: 180,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_tax_turkey_total',
    headerName: 'Налог на прибыль (Турция)',
    description: 'Налог на прибыль в Турции от внутренней наценки',
    category: 'calculations',
    width: 210,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'calc_tax_russia_total',
    headerName: 'Налог на прибыль (Россия)',
    description: 'Налог на прибыль в России от оставшейся прибыли',
    category: 'calculations',
    width: 210,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },

  // -------------------------------------------------------------------------
  // NEW QUOTE FIELDS
  // -------------------------------------------------------------------------
  {
    field: 'document_folder_link',
    headerName: 'Ссылка на папку документов',
    description: 'Ссылка на папку с документами по сделке',
    category: 'identity',
    width: 220,
  },
  {
    field: 'spec_sign_date',
    headerName: 'Дата подписания спецификации',
    description: 'Дата подписания спецификации с заказчиком',
    category: 'identity',
    width: 230,
    valueFormatter: (params: ValueFormatterParams) => formatDate(params.value),
  },

  // -------------------------------------------------------------------------
  // DERIVED FIELDS
  // -------------------------------------------------------------------------
  {
    field: 'logistics_eu_tr',
    headerName: 'Логистика ЕС + Турция',
    description: 'Сумма логистики ЕС и Турция (поставщик-хаб + хаб-таможня)',
    category: 'derived',
    width: 190,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'EUR'),
  },
  {
    field: 'logistics_total',
    headerName: 'Итого логистика',
    description: 'Полная стоимость логистики включая все участки',
    category: 'derived',
    width: 160,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'tax_total_tr_rf',
    headerName: 'Налог Турция + Россия',
    description: 'Сумма налогов на прибыль в Турции и России',
    category: 'derived',
    width: 190,
    type: 'rightAligned',
    cellClass: 'font-mono-numbers',
    valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value, 'USD'),
  },
  {
    field: 'week_number',
    headerName: 'Номер недели',
    description: 'Номер недели года по дате создания КП',
    category: 'derived',
    width: 130,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatNumber(params.value),
  },
  {
    field: 'month_number',
    headerName: 'Месяц',
    description: 'Номер месяца по дате создания КП',
    category: 'derived',
    width: 90,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatNumber(params.value),
  },
  {
    field: 'year_number',
    headerName: 'Год',
    description: 'Год по дате создания КП',
    category: 'derived',
    width: 80,
    type: 'rightAligned',
    valueFormatter: (params: ValueFormatterParams) => formatNumber(params.value),
  },
  {
    field: 'is_current_week',
    headerName: 'Текущая неделя',
    description: 'Флаг: КП создано на текущей неделе',
    category: 'derived',
    width: 150,
    valueFormatter: (params: ValueFormatterParams) => (params.value ? 'Да' : 'Нет'),
  },
  {
    field: 'is_current_month',
    headerName: 'Текущий месяц',
    description: 'Флаг: КП создано в текущем месяце',
    category: 'derived',
    width: 150,
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
