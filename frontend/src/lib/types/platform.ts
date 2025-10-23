/**
 * Multi-Industry Quotation Platform Types
 * Flexible type definitions for various industry use cases
 */

// ============================================================================
// CORE PLATFORM TYPES
// ============================================================================

export type Industry =
  | 'b2b_import'
  | 'ecommerce'
  | 'manufacturing'
  | 'distribution'
  | 'services'
  | 'custom';

export type UserRole =
  | 'admin'
  | 'sales_manager'
  | 'procurement_manager'
  | 'customs_manager'
  | 'logistics_manager'
  | 'sourcing_manager'
  | 'fulfillment_manager'
  | 'marketing_manager'
  | 'production_manager'
  | 'materials_manager'
  | 'quality_manager'
  | 'finance_manager'
  | 'department_manager'
  | 'director'
  | 'custom_role';

export type Currency = 'RUB' | 'CNY' | 'USD' | 'EUR' | 'GBP' | 'JPY';

export type QuoteStatus =
  | 'draft'
  | 'procurement_pending'
  | 'customs_pending'
  | 'logistics_pending'
  | 'sourcing_pending'
  | 'fulfillment_pending'
  | 'production_pending'
  | 'materials_pending'
  | 'quality_pending'
  | 'sales_completion'
  | 'approval_pending'
  | 'approved'
  | 'rejected'
  | 'sent'
  | 'accepted'
  | 'expired';

// ============================================================================
// ORGANIZATION & USER TYPES
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  industry: Industry;
  country: string;
  settings: OrganizationSettings;
  subscription_tier: 'free' | 'basic' | 'professional' | 'enterprise';
  created_at: string;
  updated_at: string;
}

export interface OrganizationSettings {
  default_currency: Currency;
  default_vat_rate: number;
  workflow_template_id?: string;
  formula_template_id?: string;
  custom_fields: CustomField[];
  file_templates: FileTemplate[];
  approval_thresholds: ApprovalThreshold[];
  industry_specific: IndustrySpecificSettings;
}

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'date' | 'boolean' | 'file';
  required: boolean;
  options?: string[]; // For select type
  validation?: FieldValidation;
  roles: UserRole[]; // Which roles can edit this field
}

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  custom_validator?: string;
}

export interface FileTemplate {
  id: string;
  name: string;
  type: 'excel' | 'csv';
  columns: ColumnMapping[];
  industry: Industry;
  role: UserRole;
}

export interface ColumnMapping {
  column_name: string;
  field_name: string;
  required: boolean;
  data_type: 'string' | 'number' | 'date' | 'boolean';
  validation?: FieldValidation;
}

export interface ApprovalThreshold {
  currency: Currency;
  amount: number;
  required_roles: UserRole[];
  approval_type: 'sequential' | 'parallel';
}

export interface IndustrySpecificSettings {
  // B2B Import specific
  customs_integration?: boolean;
  default_incoterms?: string;
  origin_countries?: string[];

  // E-commerce specific
  marketplace_integrations?: string[];
  shipping_classes?: string[];

  // Manufacturing specific
  production_lines?: string[];
  quality_standards?: string[];

  // Distribution specific
  warehouse_locations?: string[];
  distribution_channels?: string[];

  // Services specific
  service_categories?: string[];
  billing_models?: string[];
}

export interface ExtendedUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organization_id: string;
  specialization_brands?: string[];
  industry_expertise?: Industry[];
  custom_permissions?: string[];
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// QUOTE & PRODUCT TYPES
// ============================================================================

export interface Quote {
  id: string;
  quote_number: string;
  organization_id: string;
  customer_id: string;
  created_by: string;
  status: QuoteStatus;
  industry: Industry;
  currency: Currency;

  // Financial totals
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;

  // Workflow tracking
  current_step: string;
  workflow_template_id: string;
  role_assignments: RoleAssignment[];

  // Formula and calculation
  formula_template_id: string;
  calculation_variables: Record<string, unknown>;
  price_breakdown: PriceBreakdown;

  // Metadata
  valid_until: string;
  notes?: string;
  tags?: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';

  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  id: string;
  quote_id: string;

  // Universal core fields
  name: string;
  description?: string;
  quantity: number;
  base_price?: number;
  final_price?: number;

  // Dynamic industry-specific fields
  custom_fields: Record<string, unknown>;

  // Multi-role processing data
  role_inputs: Record<string, RoleInput>;

  // Calculation data
  calculation_inputs: Record<string, unknown>;
  price_calculation: ItemPriceCalculation;

  created_at: string;
  updated_at: string;
}

export interface RoleInput {
  user_id: string;
  user_name: string;
  data: Record<string, unknown>;
  status: 'pending' | 'in_progress' | 'completed' | 'needs_revision';
  submitted_at?: string;
  version: number;
  comments?: string;
  attachments?: FileAttachment[];
}

export interface FileAttachment {
  id: string;
  filename: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  uploaded_at: string;
  url: string;
}

export interface RoleAssignment {
  role: UserRole;
  assigned_to?: string;
  assigned_by: string;
  status: 'pending' | 'in_progress' | 'completed';
  due_date?: string;
  assigned_at: string;
  completed_at?: string;
  brand_filter?: string[]; // For procurement managers
}

export interface ItemPriceCalculation {
  formula_used: string;
  variables: Record<string, number>;
  steps: CalculationStep[];
  final_price: number;
  breakdown: Record<string, number>;
  calculated_at: string;
  calculated_by: string;
}

export interface CalculationStep {
  step: number;
  description: string;
  formula: string;
  inputs: Record<string, number>;
  result: number;
}

export interface PriceBreakdown {
  items_subtotal: number;
  role_costs: Record<string, number>; // procurement_cost, logistics_cost, etc.
  markup_amount: number;
  markup_percentage: number;
  vat_amount: number;
  vat_rate: number;
  total: number;
  currency: Currency;
}

// ============================================================================
// WORKFLOW & FORMULA TYPES
// ============================================================================

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  industry: Industry;
  steps: WorkflowStep[];
  is_default: boolean;
  organization_id?: string; // null for global templates
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: string;
  order: number;
  name: string;
  description: string;
  role: UserRole;
  required_fields: string[];
  dependencies: string[]; // IDs of steps that must be completed first
  auto_assign: boolean;
  assignment_rules?: AssignmentRule;
  estimated_duration?: number; // in hours
  sla_deadline?: number; // in hours
}

export interface AssignmentRule {
  type: 'brand_match' | 'skill_match' | 'workload_balance' | 'manual';
  criteria: Record<string, unknown>;
  fallback_assignment?: string; // user_id for fallback
}

export interface FormulaTemplate {
  id: string;
  name: string;
  description: string;
  industry: Industry;
  formula: string;
  variables: FormulaVariable[];
  example_calculation: ExampleCalculation;
  is_default: boolean;
  organization_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FormulaVariable {
  name: string;
  display_name: string;
  description: string;
  type: 'number' | 'percentage' | 'currency' | 'calculated';
  source: 'user_input' | 'role_input' | 'system_config' | 'external_api';
  source_path?: string; // e.g., 'roleInput.procurement.price'
  default_value?: number;
  required: boolean;
  validation?: FieldValidation;
  unit?: string;
}

export interface ExampleCalculation {
  scenario_name: string;
  inputs: Record<string, number>;
  expected_output: number;
  breakdown_steps: string[];
}

// ============================================================================
// INDUSTRY-SPECIFIC TYPES
// ============================================================================

// B2B Import specific types
export interface B2BImportData {
  brand: string;
  part_number: string;
  article?: string;
  origin_country: string;
  hs_code?: string;
  customs_duty_rate?: number;
  weight_kg?: number;
  volume_m3?: number;
  pickup_city?: string;
  pickup_address?: string;
  incoterms?: string;
  supplier_info?: SupplierInfo;
}

export interface SupplierInfo {
  name: string;
  country: string;
  contact_person?: string;
  email?: string;
  phone?: string;
}

// E-commerce specific types
export interface EcommerceData {
  sku: string;
  category: string;
  subcategory?: string;
  marketplace?: string;
  shipping_class: string;
  dimensions?: ProductDimensions;
  supplier_sku?: string;
  minimum_order_quantity?: number;
  lead_time_days?: number;
}

export interface ProductDimensions {
  length_cm: number;
  width_cm: number;
  height_cm: number;
  weight_g: number;
}

// Manufacturing specific types
export interface ManufacturingData {
  part_code: string;
  material_type: string;
  specification: string;
  production_line?: string;
  labor_hours?: number;
  machine_time_hours?: number;
  material_cost?: number;
  overhead_allocation?: number;
  quality_grade?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface SearchFilters {
  search?: string;
  industry?: Industry;
  status?: QuoteStatus;
  currency?: Currency;
  date_from?: string;
  date_to?: string;
  customer_id?: string;
  created_by?: string;
  tags?: string[];
  min_amount?: number;
  max_amount?: number;
  priority?: string;
}

// ============================================================================
// FORM & UI TYPES
// ============================================================================

export interface FormField {
  name: string;
  label: string;
  type:
    | 'text'
    | 'number'
    | 'select'
    | 'textarea'
    | 'date'
    | 'checkbox'
    | 'file'
    | 'currency'
    | 'percentage';
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: FieldValidation;
  dependency?: FieldDependency;
  grid_col?: number; // For layout (1-12)
}

export interface FieldDependency {
  field: string;
  condition: 'equals' | 'not_equals' | 'greater_than' | 'less_than';
  value: unknown;
  action: 'show' | 'hide' | 'require' | 'disable';
}

export interface TabConfig {
  key: string;
  label: string;
  icon?: string;
  fields: FormField[];
  role?: UserRole;
  disabled?: boolean;
}

// ============================================================================
// NOTIFICATION & INTEGRATION TYPES
// ============================================================================

export interface NotificationSettings {
  email_enabled: boolean;
  in_app_enabled: boolean;
  slack_webhook?: string;
  notification_triggers: NotificationTrigger[];
}

export interface NotificationTrigger {
  event: string;
  roles: UserRole[];
  template: string;
  delay_minutes?: number;
}

export interface ExternalIntegration {
  id: string;
  name: string;
  type: 'erp' | 'accounting' | 'marketplace' | 'shipping' | 'customs' | 'currency';
  config: Record<string, unknown>;
  enabled: boolean;
  last_sync?: string;
}
