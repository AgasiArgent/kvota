/**
 * Industry Templates for Multi-Industry Quotation Platform
 * Pre-configured workflows, formulas, and field configurations
 */

import {
  Industry,
  WorkflowTemplate,
  FormulaTemplate,
  CustomField,
  ApprovalThreshold,
  IndustrySpecificSettings,
} from '@/lib/types/platform';

// ============================================================================
// B2B IMPORT INDUSTRY TEMPLATE
// ============================================================================

export const B2B_IMPORT_WORKFLOW: WorkflowTemplate = {
  id: 'b2b-import-workflow',
  name: 'B2B Import Workflow',
  description: 'Complete workflow for B2B import quotations with customs and logistics',
  industry: 'b2b_import',
  is_default: true,
  organization_id: undefined,
  created_by: 'system',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  steps: [
    {
      id: 'product-upload',
      order: 1,
      name: 'Product List Upload',
      description: 'Sales manager uploads product list with brands, part numbers, and quantities',
      role: 'sales_manager',
      required_fields: ['brand', 'part_number', 'name', 'quantity'],
      dependencies: [],
      auto_assign: true,
      estimated_duration: 2,
      sla_deadline: 24,
    },
    {
      id: 'procurement-pricing',
      order: 2,
      name: 'Procurement Pricing',
      description: 'Procurement managers add pricing, weight, volume, and pickup details',
      role: 'procurement_manager',
      required_fields: ['price', 'weight_kg', 'volume_m3', 'pickup_city', 'pickup_address'],
      dependencies: ['product-upload'],
      auto_assign: true,
      assignment_rules: {
        type: 'brand_match',
        criteria: { match_field: 'brand' },
        fallback_assignment: 'manual',
      },
      estimated_duration: 8,
      sla_deadline: 48,
    },
    {
      id: 'customs-classification',
      order: 3,
      name: 'Customs Classification',
      description: 'Customs manager adds HS codes and import duty rates',
      role: 'customs_manager',
      required_fields: ['hs_code', 'customs_duty_rate', 'origin_country'],
      dependencies: ['product-upload'],
      auto_assign: true,
      estimated_duration: 4,
      sla_deadline: 24,
    },
    {
      id: 'logistics-planning',
      order: 4,
      name: 'Logistics Planning',
      description: 'Logistics manager plans route and calculates shipping costs',
      role: 'logistics_manager',
      required_fields: ['route', 'logistics_cost', 'estimated_delivery_days'],
      dependencies: ['procurement-pricing', 'customs-classification'],
      auto_assign: true,
      estimated_duration: 6,
      sla_deadline: 48,
    },
    {
      id: 'sales-completion',
      order: 5,
      name: 'Sales Finalization',
      description: 'Sales manager adds markup, payment terms, and finalizes quote',
      role: 'sales_manager',
      required_fields: ['markup_percentage', 'payment_terms', 'upfront_percentage'],
      dependencies: ['logistics-planning'],
      auto_assign: false,
      estimated_duration: 2,
      sla_deadline: 12,
    },
  ],
};

export const B2B_IMPORT_FORMULA: FormulaTemplate = {
  id: 'b2b-import-formula',
  name: 'B2B Import Pricing Formula',
  description: 'Complete pricing calculation for B2B imports including all costs and margins',
  industry: 'b2b_import',
  is_default: true,
  organization_id: undefined,
  created_by: 'system',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  formula:
    '(procurement_cost + logistics_cost + (procurement_cost * customs_duty_rate / 100)) * (1 + markup_percentage / 100) * (1 + vat_rate / 100)',
  variables: [
    {
      name: 'procurement_cost',
      display_name: 'Procurement Cost',
      description: 'Cost of goods from supplier',
      type: 'currency',
      source: 'role_input',
      source_path: 'procurement_manager.price',
      required: true,
      unit: 'currency',
    },
    {
      name: 'logistics_cost',
      display_name: 'Logistics Cost',
      description: 'Transportation and shipping costs',
      type: 'currency',
      source: 'role_input',
      source_path: 'logistics_manager.logistics_cost',
      required: true,
      unit: 'currency',
    },
    {
      name: 'customs_duty_rate',
      display_name: 'Customs Duty Rate',
      description: 'Import duty percentage',
      type: 'percentage',
      source: 'role_input',
      source_path: 'customs_manager.customs_duty_rate',
      required: true,
      unit: '%',
    },
    {
      name: 'markup_percentage',
      display_name: 'Markup Percentage',
      description: 'Profit margin percentage',
      type: 'percentage',
      source: 'user_input',
      default_value: 20,
      required: true,
      validation: { min: 0, max: 100 },
      unit: '%',
    },
    {
      name: 'vat_rate',
      display_name: 'VAT Rate',
      description: 'Value Added Tax rate',
      type: 'percentage',
      source: 'system_config',
      default_value: 20,
      required: true,
      unit: '%',
    },
  ],
  example_calculation: {
    scenario_name: 'Electronics Import from China',
    inputs: {
      procurement_cost: 1000,
      logistics_cost: 200,
      customs_duty_rate: 15,
      markup_percentage: 25,
      vat_rate: 20,
    },
    expected_output: 1800,
    breakdown_steps: [
      'Base cost: 1000 + 200 = 1200',
      'Customs duty: 1000 × 15% = 150',
      'Total cost: 1200 + 150 = 1350',
      'With markup: 1350 × 1.25 = 1687.50',
      'With VAT: 1687.50 × 1.20 = 2025.00',
    ],
  },
};

export const B2B_IMPORT_FIELDS: CustomField[] = [
  {
    id: 'brand',
    name: 'brand',
    type: 'text',
    required: true,
    roles: ['sales_manager'],
  },
  {
    id: 'part_number',
    name: 'part_number',
    type: 'text',
    required: true,
    roles: ['sales_manager'],
  },
  {
    id: 'origin_country',
    name: 'origin_country',
    type: 'select',
    required: true,
    options: ['China', 'Germany', 'USA', 'Japan', 'South Korea'],
    roles: ['customs_manager'],
  },
  {
    id: 'hs_code',
    name: 'hs_code',
    type: 'text',
    required: true,
    validation: { pattern: '^\\d{4,10}$' },
    roles: ['customs_manager'],
  },
  {
    id: 'weight_kg',
    name: 'weight_kg',
    type: 'number',
    required: true,
    validation: { min: 0 },
    roles: ['procurement_manager'],
  },
  {
    id: 'volume_m3',
    name: 'volume_m3',
    type: 'number',
    required: true,
    validation: { min: 0 },
    roles: ['procurement_manager'],
  },
];

// ============================================================================
// E-COMMERCE INDUSTRY TEMPLATE
// ============================================================================

export const ECOMMERCE_WORKFLOW: WorkflowTemplate = {
  id: 'ecommerce-workflow',
  name: 'E-commerce Pricing Workflow',
  description: 'Optimized workflow for e-commerce product pricing and sourcing',
  industry: 'ecommerce',
  is_default: true,
  organization_id: undefined,
  created_by: 'system',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  steps: [
    {
      id: 'product-research',
      order: 1,
      name: 'Product Research',
      description: 'Sales manager researches products and creates initial listing',
      role: 'sales_manager',
      required_fields: ['sku', 'category', 'marketplace', 'target_price'],
      dependencies: [],
      auto_assign: true,
      estimated_duration: 3,
      sla_deadline: 24,
    },
    {
      id: 'sourcing',
      order: 2,
      name: 'Product Sourcing',
      description: 'Sourcing manager finds suppliers and negotiates prices',
      role: 'sourcing_manager',
      required_fields: ['supplier_price', 'minimum_order_quantity', 'lead_time_days'],
      dependencies: ['product-research'],
      auto_assign: true,
      estimated_duration: 12,
      sla_deadline: 72,
    },
    {
      id: 'fulfillment-planning',
      order: 3,
      name: 'Fulfillment Planning',
      description: 'Fulfillment manager calculates shipping and handling costs',
      role: 'fulfillment_manager',
      required_fields: ['shipping_cost', 'handling_fee', 'storage_cost'],
      dependencies: ['sourcing'],
      auto_assign: true,
      estimated_duration: 4,
      sla_deadline: 24,
    },
    {
      id: 'marketing-optimization',
      order: 4,
      name: 'Marketing Optimization',
      description: 'Marketing manager sets competitive pricing and promotional strategy',
      role: 'marketing_manager',
      required_fields: ['competitor_price', 'promotional_strategy', 'advertising_cost'],
      dependencies: ['fulfillment-planning'],
      auto_assign: true,
      estimated_duration: 6,
      sla_deadline: 48,
    },
  ],
};

export const ECOMMERCE_FORMULA: FormulaTemplate = {
  id: 'ecommerce-formula',
  name: 'E-commerce Pricing Formula',
  description: 'Competitive pricing formula for e-commerce products',
  industry: 'ecommerce',
  is_default: true,
  organization_id: undefined,
  created_by: 'system',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  formula:
    '(supplier_price + shipping_cost + handling_fee + storage_cost + advertising_cost) * (1 + markup_percentage / 100) * (1 + platform_fee / 100)',
  variables: [
    {
      name: 'supplier_price',
      display_name: 'Supplier Price',
      description: 'Cost from supplier',
      type: 'currency',
      source: 'role_input',
      source_path: 'sourcing_manager.supplier_price',
      required: true,
      unit: 'currency',
    },
    {
      name: 'shipping_cost',
      display_name: 'Shipping Cost',
      description: 'Cost to ship to customer',
      type: 'currency',
      source: 'role_input',
      source_path: 'fulfillment_manager.shipping_cost',
      required: true,
      unit: 'currency',
    },
    {
      name: 'platform_fee',
      display_name: 'Platform Fee',
      description: 'Marketplace commission percentage',
      type: 'percentage',
      source: 'system_config',
      default_value: 15,
      required: true,
      unit: '%',
    },
    {
      name: 'markup_percentage',
      display_name: 'Markup Percentage',
      description: 'Profit margin percentage',
      type: 'percentage',
      source: 'user_input',
      default_value: 30,
      required: true,
      validation: { min: 0, max: 200 },
      unit: '%',
    },
  ],
  example_calculation: {
    scenario_name: 'Electronics on Amazon',
    inputs: {
      supplier_price: 50,
      shipping_cost: 8,
      handling_fee: 2,
      storage_cost: 1,
      advertising_cost: 5,
      markup_percentage: 40,
      platform_fee: 15,
    },
    expected_output: 106.82,
    breakdown_steps: [
      'Total costs: 50 + 8 + 2 + 1 + 5 = 66',
      'With markup: 66 × 1.40 = 92.40',
      'With platform fee: 92.40 × 1.15 = 106.26',
    ],
  },
};

// ============================================================================
// MANUFACTURING INDUSTRY TEMPLATE
// ============================================================================

export const MANUFACTURING_WORKFLOW: WorkflowTemplate = {
  id: 'manufacturing-workflow',
  name: 'Manufacturing Cost Workflow',
  description: 'Production cost calculation workflow for manufactured products',
  industry: 'manufacturing',
  is_default: true,
  organization_id: undefined,
  created_by: 'system',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  steps: [
    {
      id: 'product-specification',
      order: 1,
      name: 'Product Specification',
      description: 'Sales manager defines product specifications and requirements',
      role: 'sales_manager',
      required_fields: ['part_code', 'specification', 'quantity', 'quality_grade'],
      dependencies: [],
      auto_assign: true,
      estimated_duration: 4,
      sla_deadline: 24,
    },
    {
      id: 'materials-planning',
      order: 2,
      name: 'Materials Planning',
      description: 'Materials manager calculates material requirements and costs',
      role: 'materials_manager',
      required_fields: ['material_cost', 'material_type', 'waste_percentage'],
      dependencies: ['product-specification'],
      auto_assign: true,
      estimated_duration: 6,
      sla_deadline: 48,
    },
    {
      id: 'production-planning',
      order: 3,
      name: 'Production Planning',
      description: 'Production manager estimates labor and machine time',
      role: 'production_manager',
      required_fields: ['labor_hours', 'machine_hours', 'production_line', 'setup_time'],
      dependencies: ['materials-planning'],
      auto_assign: true,
      estimated_duration: 8,
      sla_deadline: 48,
    },
    {
      id: 'quality-assessment',
      order: 4,
      name: 'Quality Assessment',
      description: 'Quality manager adds quality control and testing costs',
      role: 'quality_manager',
      required_fields: ['quality_control_cost', 'testing_hours', 'certification_cost'],
      dependencies: ['production-planning'],
      auto_assign: true,
      estimated_duration: 4,
      sla_deadline: 24,
    },
  ],
};

export const MANUFACTURING_FORMULA: FormulaTemplate = {
  id: 'manufacturing-formula',
  name: 'Manufacturing Cost Formula',
  description: 'Complete cost calculation for manufactured products',
  industry: 'manufacturing',
  is_default: true,
  organization_id: undefined,
  created_by: 'system',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  formula:
    '(material_cost + (labor_hours * labor_rate) + (machine_hours * machine_rate) + quality_control_cost + overhead_allocation) * (1 + markup_percentage / 100)',
  variables: [
    {
      name: 'material_cost',
      display_name: 'Material Cost',
      description: 'Raw material costs',
      type: 'currency',
      source: 'role_input',
      source_path: 'materials_manager.material_cost',
      required: true,
      unit: 'currency',
    },
    {
      name: 'labor_hours',
      display_name: 'Labor Hours',
      description: 'Required labor time',
      type: 'number',
      source: 'role_input',
      source_path: 'production_manager.labor_hours',
      required: true,
      unit: 'hours',
    },
    {
      name: 'labor_rate',
      display_name: 'Labor Rate',
      description: 'Cost per labor hour',
      type: 'currency',
      source: 'system_config',
      default_value: 25,
      required: true,
      unit: 'currency/hour',
    },
    {
      name: 'machine_hours',
      display_name: 'Machine Hours',
      description: 'Required machine time',
      type: 'number',
      source: 'role_input',
      source_path: 'production_manager.machine_hours',
      required: true,
      unit: 'hours',
    },
    {
      name: 'machine_rate',
      display_name: 'Machine Rate',
      description: 'Cost per machine hour',
      type: 'currency',
      source: 'system_config',
      default_value: 50,
      required: true,
      unit: 'currency/hour',
    },
  ],
  example_calculation: {
    scenario_name: 'Custom Metal Part',
    inputs: {
      material_cost: 200,
      labor_hours: 8,
      labor_rate: 25,
      machine_hours: 4,
      machine_rate: 50,
      quality_control_cost: 50,
      overhead_allocation: 100,
      markup_percentage: 35,
    },
    expected_output: 743.5,
    breakdown_steps: [
      'Material cost: 200',
      'Labor cost: 8 × 25 = 200',
      'Machine cost: 4 × 50 = 200',
      'Quality control: 50',
      'Overhead: 100',
      'Total cost: 200 + 200 + 200 + 50 + 100 = 750',
      'With markup: 750 × 1.35 = 1012.50',
    ],
  },
};

// ============================================================================
// APPROVAL THRESHOLDS BY INDUSTRY
// ============================================================================

export const B2B_IMPORT_THRESHOLDS: ApprovalThreshold[] = [
  {
    currency: 'RUB',
    amount: 500000,
    required_roles: ['finance_manager'],
    approval_type: 'sequential',
  },
  {
    currency: 'RUB',
    amount: 1000000,
    required_roles: ['finance_manager', 'department_manager'],
    approval_type: 'sequential',
  },
  {
    currency: 'RUB',
    amount: 5000000,
    required_roles: ['finance_manager', 'department_manager', 'director'],
    approval_type: 'sequential',
  },
];

export const ECOMMERCE_THRESHOLDS: ApprovalThreshold[] = [
  {
    currency: 'USD',
    amount: 1000,
    required_roles: ['marketing_manager'],
    approval_type: 'parallel',
  },
  {
    currency: 'USD',
    amount: 5000,
    required_roles: ['marketing_manager', 'finance_manager'],
    approval_type: 'sequential',
  },
];

export const MANUFACTURING_THRESHOLDS: ApprovalThreshold[] = [
  {
    currency: 'USD',
    amount: 10000,
    required_roles: ['production_manager'],
    approval_type: 'sequential',
  },
  {
    currency: 'USD',
    amount: 50000,
    required_roles: ['production_manager', 'quality_manager'],
    approval_type: 'parallel',
  },
  {
    currency: 'USD',
    amount: 100000,
    required_roles: ['production_manager', 'quality_manager', 'director'],
    approval_type: 'sequential',
  },
];

// ============================================================================
// INDUSTRY SETTINGS
// ============================================================================

export const B2B_IMPORT_SETTINGS: IndustrySpecificSettings = {
  customs_integration: true,
  default_incoterms: 'CIF',
  origin_countries: ['China', 'Germany', 'USA', 'Japan', 'South Korea', 'Italy', 'Turkey'],
};

export const ECOMMERCE_SETTINGS: IndustrySpecificSettings = {
  marketplace_integrations: ['Amazon', 'eBay', 'Shopify', 'Wildberries', 'Ozon'],
  shipping_classes: ['Standard', 'Express', 'Premium', 'Overnight'],
};

export const MANUFACTURING_SETTINGS: IndustrySpecificSettings = {
  production_lines: ['Line A', 'Line B', 'Line C', 'Custom Line'],
  quality_standards: ['ISO 9001', 'ISO 14001', 'AS9100', 'TS 16949'],
};

// ============================================================================
// TEMPLATE COLLECTION
// ============================================================================

export const INDUSTRY_TEMPLATES = {
  b2b_import: {
    workflow: B2B_IMPORT_WORKFLOW,
    formula: B2B_IMPORT_FORMULA,
    fields: B2B_IMPORT_FIELDS,
    thresholds: B2B_IMPORT_THRESHOLDS,
    settings: B2B_IMPORT_SETTINGS,
  },
  ecommerce: {
    workflow: ECOMMERCE_WORKFLOW,
    formula: ECOMMERCE_FORMULA,
    fields: [],
    thresholds: ECOMMERCE_THRESHOLDS,
    settings: ECOMMERCE_SETTINGS,
  },
  manufacturing: {
    workflow: MANUFACTURING_WORKFLOW,
    formula: MANUFACTURING_FORMULA,
    fields: [],
    thresholds: MANUFACTURING_THRESHOLDS,
    settings: MANUFACTURING_SETTINGS,
  },
};

export function getIndustryTemplate(industry: Industry) {
  return INDUSTRY_TEMPLATES[industry as keyof typeof INDUSTRY_TEMPLATES];
}

export function getAllIndustryTemplates() {
  return INDUSTRY_TEMPLATES;
}
