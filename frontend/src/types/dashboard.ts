/**
 * Dashboard Constructor Type Definitions
 * For TASK-009: Dashboard constructor with SmartLead integration
 * Created: 2025-12-22
 */

// ============================================================================
// ENUMS
// ============================================================================

export type WidgetType = 'kpi' | 'chart' | 'table' | 'filter';

export type ChartType = 'line' | 'bar' | 'pie' | 'area';

export type DataSourceType = 'smartlead' | 'manual' | 'aggregate';

export type AggregationType = 'sum' | 'avg' | 'max' | 'min' | 'count';

export type CampaignDataSource = 'smartlead' | 'manual';

// ============================================================================
// CAMPAIGN METRICS
// ============================================================================

export interface CampaignMetrics {
  // Raw counts
  sent_count: number;
  open_count: number;
  unique_open_count: number;
  click_count: number;
  unique_click_count: number;
  reply_count: number;
  bounce_count: number;
  unsubscribed_count: number;

  // Lead status (from SmartLead)
  interested_count: number;
  not_started_count: number;
  in_progress_count: number;
  completed_count: number;
  blocked_count: number;
  paused_count: number;
  stopped_count: number;
  total_leads: number;

  // CRM Categories (from SmartLead lead_category_id)
  positive_count?: number;
  meeting_request_count?: number;

  // Calculated rates (percentage)
  open_rate?: number;
  click_rate?: number;
  reply_rate?: number;
  bounce_rate?: number;
  positive_rate?: number;
  meeting_to_positive_rate?: number;
}

// ============================================================================
// CAMPAIGN DATA
// ============================================================================

export interface CampaignDataCreate {
  campaign_name: string;
  metrics?: CampaignMetrics;
  period_start?: string;
  period_end?: string;
  source?: CampaignDataSource;
  campaign_id?: string;
}

export interface CampaignDataUpdate {
  campaign_name?: string;
  metrics?: CampaignMetrics;
  period_start?: string;
  period_end?: string;
}

export interface CampaignData {
  id: string;
  organization_id: string;
  source: CampaignDataSource;
  campaign_id?: string;
  campaign_name: string;
  metrics: CampaignMetrics;
  period_start?: string;
  period_end?: string;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// WIDGET DATA SOURCE
// ============================================================================

export interface WidgetDataSource {
  type: DataSourceType;
  campaign_ids?: string[];
  metric: string;
  aggregation?: AggregationType;
  date_range?: {
    start?: string;
    end?: string;
  };
}

// ============================================================================
// WIDGET POSITION
// ============================================================================

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ============================================================================
// WIDGET CONFIGURATIONS (Type-specific)
// ============================================================================

export interface KPIWidgetConfig {
  format: 'number' | 'percent' | 'currency';
  show_trend: boolean;
  trend_period: 'day' | 'week' | 'month';
  decimal_places: number;
  prefix?: string;
  suffix?: string;
}

export interface ChartWidgetConfig {
  chart_type: ChartType;
  colors?: string[];
  show_legend: boolean;
  show_labels: boolean;
  stacked: boolean;
  x_axis_label?: string;
  y_axis_label?: string;
}

export interface TableWidgetConfig {
  columns: string[];
  sortable: boolean;
  paginated: boolean;
  page_size: number;
}

export interface FilterWidgetConfig {
  filter_type: 'date_range' | 'campaign_select' | 'multi_select';
  target_widgets?: string[];
  default_value?: unknown;
}

export type WidgetConfig =
  | KPIWidgetConfig
  | ChartWidgetConfig
  | TableWidgetConfig
  | FilterWidgetConfig;

// ============================================================================
// DASHBOARD WIDGET
// ============================================================================

export interface DashboardWidgetCreate {
  widget_type: WidgetType;
  title: string;
  config: WidgetConfig | Record<string, unknown>;
  data_source: WidgetDataSource;
  position?: WidgetPosition;
  dashboard_id?: string;
}

export interface DashboardWidgetUpdate {
  title?: string;
  config?: WidgetConfig | Record<string, unknown>;
  data_source?: WidgetDataSource;
  position?: WidgetPosition;
}

export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  widget_type: WidgetType;
  title: string;
  config: WidgetConfig | Record<string, unknown>;
  data_source: WidgetDataSource;
  position: WidgetPosition;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// DASHBOARD
// ============================================================================

export interface DashboardCreate {
  name: string;
  description?: string;
  widgets?: DashboardWidgetCreate[];
}

export interface DashboardUpdate {
  name?: string;
  description?: string;
  layout?: WidgetPosition[];
}

export interface DashboardSummary {
  id: string;
  name: string;
  description?: string;
  widget_count: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface Dashboard {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  layout: WidgetPosition[];
  widgets: DashboardWidget[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SMARTLEAD SYNC MODELS
// ============================================================================

export interface SmartLeadCampaign {
  id: string;
  name: string;
  status?: string;
  created_at?: string;
}

export interface SmartLeadSyncRequest {
  campaign_ids?: string[];
  force_refresh?: boolean;
}

export interface SmartLeadSyncResult {
  synced_count: number;
  failed_count: number;
  campaigns: CampaignData[];
  errors: string[];
  synced_at: string;
}

// ============================================================================
// API RESPONSE MODELS
// ============================================================================

export interface DashboardListResponse {
  dashboards: DashboardSummary[];
  total: number;
}

export interface CampaignDataListResponse {
  campaigns: CampaignData[];
  total: number;
}

export interface WidgetDataResponse {
  widget_id: string;
  data: unknown;
  fetched_at: string;
  cache_ttl: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format campaign metric value based on type
 */
export function formatMetricValue(value: number, isRate: boolean = false): string {
  if (isRate) {
    return `${value.toFixed(2)}%`;
  }
  return value.toLocaleString('ru-RU');
}

/**
 * Get display label for widget type
 */
export function getWidgetTypeLabel(type: WidgetType): string {
  const labels: Record<WidgetType, string> = {
    kpi: 'KPI карточка',
    chart: 'График',
    table: 'Таблица',
    filter: 'Фильтр',
  };
  return labels[type];
}

/**
 * Get display label for chart type
 */
export function getChartTypeLabel(type: ChartType): string {
  const labels: Record<ChartType, string> = {
    line: 'Линейный',
    bar: 'Столбчатый',
    pie: 'Круговой',
    area: 'Площадной',
  };
  return labels[type];
}

/**
 * Get display label for data source type
 */
export function getDataSourceLabel(type: CampaignDataSource): string {
  const labels: Record<CampaignDataSource, string> = {
    smartlead: 'SmartLead API',
    manual: 'Ручной ввод',
  };
  return labels[type];
}

/**
 * Default widget position
 */
export function getDefaultWidgetPosition(): WidgetPosition {
  return { x: 0, y: 0, w: 4, h: 3 };
}

/**
 * Default KPI widget config
 */
export function getDefaultKPIConfig(): KPIWidgetConfig {
  return {
    format: 'number',
    show_trend: true,
    trend_period: 'week',
    decimal_places: 0,
  };
}

/**
 * Default chart widget config
 */
export function getDefaultChartConfig(): ChartWidgetConfig {
  return {
    chart_type: 'bar',
    show_legend: true,
    show_labels: true,
    stacked: false,
  };
}

/**
 * Default table widget config
 */
export function getDefaultTableConfig(): TableWidgetConfig {
  return {
    columns: [],
    sortable: true,
    paginated: true,
    page_size: 10,
  };
}

/**
 * Default filter widget config
 */
export function getDefaultFilterConfig(): FilterWidgetConfig {
  return {
    filter_type: 'date_range',
  };
}

/**
 * Empty campaign metrics
 */
export function getEmptyCampaignMetrics(): CampaignMetrics {
  return {
    sent_count: 0,
    open_count: 0,
    unique_open_count: 0,
    click_count: 0,
    unique_click_count: 0,
    reply_count: 0,
    bounce_count: 0,
    unsubscribed_count: 0,
    interested_count: 0,
    not_started_count: 0,
    in_progress_count: 0,
    completed_count: 0,
    blocked_count: 0,
    paused_count: 0,
    stopped_count: 0,
    total_leads: 0,
    positive_count: 0,
    meeting_request_count: 0,
  };
}

/**
 * Available metric fields for widgets
 */
export const AVAILABLE_METRICS = [
  { field: 'total_leads', label: 'Всего лидов', isRate: false },
  { field: 'reply_count', label: 'Ответов', isRate: false },
  { field: 'reply_rate', label: 'Конверсия (Reply Rate)', isRate: true },
  { field: 'positive_count', label: 'Позитивных', isRate: false },
  { field: 'meeting_request_count', label: 'Запросов встреч', isRate: false },
  { field: 'sent_count', label: 'Отправлено писем', isRate: false },
  { field: 'open_count', label: 'Открытий', isRate: false },
  { field: 'unique_open_count', label: 'Уникальных открытий', isRate: false },
  { field: 'click_count', label: 'Кликов', isRate: false },
  { field: 'unique_click_count', label: 'Уникальных кликов', isRate: false },
  { field: 'bounce_count', label: 'Отказов', isRate: false },
  { field: 'unsubscribed_count', label: 'Отписок', isRate: false },
  { field: 'interested_count', label: 'Заинтересованных', isRate: false },
  { field: 'open_rate', label: 'Open Rate', isRate: true },
  { field: 'click_rate', label: 'Click Rate', isRate: true },
  { field: 'bounce_rate', label: 'Bounce Rate', isRate: true },
] as const;
