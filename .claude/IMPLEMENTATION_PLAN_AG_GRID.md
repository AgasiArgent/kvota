# Implementation Plan: Quote Creation Page Restructure with ag-Grid

**Project:** B2B Quotation Platform
**Feature:** Excel-like Quote Creation with ag-Grid
**Status:** Phase 1 - Documentation & Setup
**Started:** 2025-10-19
**Estimated Total Time:** 8.5 hours

---

## Overview

Restructure `/home/novi/quotation-app/frontend/src/app/quotes/create/page.tsx` to provide Excel-like editing experience using ag-Grid Community edition.

### Key Goals
1. ✅ Excel-style copy/paste from spreadsheets
2. ✅ Column groups (collapsible/expandable)
3. ✅ Bulk edit via column header dropdowns
4. ✅ Color-coded cells showing override status
5. ✅ Quote-level defaults with product-level overrides
6. ✅ SKU and Brand tracking for analytics

### Why ag-Grid?
- Free & open source (Community edition)
- Excellent React 19 + TypeScript support
- Built for financial applications
- Excel-like copy/paste out of the box
- Better performance than custom solution
- 2-3 hours to implement vs 8-10 hours custom

---

## Phase 1: Documentation & Setup ✅ IN PROGRESS

**Time Estimate:** 30 minutes
**Status:** IN PROGRESS

### Tasks

#### 1.1 Create Documentation Files ✅ IN PROGRESS
- [x] Create `/home/novi/quotation-app/.claude/README.md`
- [ ] Create `/home/novi/quotation-app/.claude/IMPLEMENTATION_PLAN_AG_GRID.md` (this file)
- [ ] Update `/home/novi/quotation-app/.claude/VARIABLES_CLASSIFICATION.md` (add SKU, Brand)

**Files to Create:**
```
.claude/
├── README.md ✅
├── IMPLEMENTATION_PLAN_AG_GRID.md ← current file
├── VARIABLES_CLASSIFICATION.md (update)
└── Variables_specification_notion.md (existing)
```

#### 1.2 Install ag-Grid Dependencies
```bash
cd /home/novi/quotation-app/frontend
npm install ag-grid-react ag-grid-community
```

**Expected Output:**
```
+ ag-grid-react@32.x.x
+ ag-grid-community@32.x.x
```

#### 1.3 Verify Installation
- Check `package.json` includes ag-grid packages
- No conflicts with existing dependencies (React 19, TypeScript, Ant Design)

---

## Phase 2: Quote-Level Defaults Section

**Time Estimate:** 1.5 hours
**Status:** NOT STARTED

### Overview

Create collapsible card section above products table that contains quote-level default values. These defaults cascade to all products unless overridden per product.

### Page Structure
```
[File Upload] (existing)
[Customer Selection] (existing)
[Template Selector] (existing)

↓ NEW SECTION ↓

[Quote-Level Defaults - 6 Collapsible Cards]
  Card 1: Компания (Company Settings)
  Card 2: Финансовые параметры (Financial Parameters)
  Card 3: Логистика (Logistics)
  Card 4: Условия оплаты (Payment Terms)
  Card 5: Таможня и брокераж (Customs & Clearance)
  Card 6: Значения по умолчанию для товаров (Product Defaults)

[Admin Settings Info Box] (read-only, links to /settings/calculation)

↓ EXISTING (to be replaced) ↓

[Products Table with ag-Grid]
[Calculate Button]
[Results Table]
```

### Tasks

#### 2.1 Create State for Quote Defaults (30 min)
**File:** `frontend/src/app/quotes/create/page.tsx`

Add state management:
```typescript
interface QuoteDefaults {
  // Company Settings
  seller_company: string;
  offer_sale_type: string;
  offer_incoterms: string;

  // Financial Parameters
  currency_of_quote: string;
  markup: number;
  dm_fee_type: string;
  dm_fee_value: number;

  // Logistics
  delivery_time: number;
  logistics_supplier_hub: number;
  logistics_hub_customs: number;
  logistics_customs_client: number;

  // Payment Terms
  advance_from_client: number;
  advance_to_supplier: number;
  time_to_advance: number;
  advance_on_loading: number;
  time_to_advance_loading: number;
  advance_on_going_to_country_destination: number;
  time_to_advance_going_to_country_destination: number;
  advance_on_customs_clearance: number;
  time_to_advance_on_customs_clearance: number;
  time_to_advance_on_receiving: number;

  // Customs & Clearance
  brokerage_hub: number;
  brokerage_customs: number;
  warehousing_at_customs: number;
  customs_documentation: number;
  brokerage_extra: number;
  util_fee: number;

  // Product Defaults
  currency_of_base_price: string;
  supplier_country: string;
  supplier_discount: number;
  exchange_rate_base_price_to_quote: number;
  customs_code: string;
  import_tariff: number;
  excise_tax: number;
}

const [quoteDefaults, setQuoteDefaults] = useState<QuoteDefaults>({
  seller_company: 'МАСТЕР БЭРИНГ ООО',
  currency_of_quote: 'RUB',
  // ... other defaults
});
```

#### 2.2 Create Collapsible Cards UI (45 min)

Use Ant Design Collapse component:
```tsx
<Collapse defaultActiveKey={['company', 'financial']}>
  <Panel header="Компания" key="company">
    <Form layout="vertical">
      <Form.Item label="Компания-продавец">
        <Select
          value={quoteDefaults.seller_company}
          onChange={(val) => setQuoteDefaults(prev => ({...prev, seller_company: val}))}
        >
          <Option value="МАСТЕР БЭРИНГ ООО">МАСТЕР БЭРИНГ ООО</Option>
          {/* ... other companies */}
        </Select>
      </Form.Item>
      {/* ... other company fields */}
    </Form>
  </Panel>

  <Panel header="Финансовые параметры" key="financial">
    {/* Financial fields */}
  </Panel>

  {/* ... other panels */}
</Collapse>
```

#### 2.3 Create Admin Settings Info Box (15 min)

Read-only display with link to admin page:
```tsx
<Card
  size="small"
  title="Административные настройки"
  extra={user.role === 'admin' && <Button href="/settings/calculation">Изменить</Button>}
>
  <Descriptions column={1} size="small">
    <Descriptions.Item label="Резерв на курсовую разницу">
      {adminSettings.rate_forex_risk}%
    </Descriptions.Item>
    <Descriptions.Item label="Комиссия финансового агента">
      {adminSettings.rate_fin_comm}%
    </Descriptions.Item>
    <Descriptions.Item label="Годовая процентная ставка">
      {(adminSettings.rate_loan_interest_daily * 365 * 100).toFixed(2)}%
    </Descriptions.Item>
  </Descriptions>
</Card>
```

#### 2.4 Load Admin Settings on Mount (15 min)

Fetch admin settings from API:
```typescript
useEffect(() => {
  const loadAdminSettings = async () => {
    const response = await calculationSettingsService.getSettings();
    if (response.success && response.data) {
      setAdminSettings(response.data);
    }
  };
  loadAdminSettings();
}, []);
```

---

## Phase 3: ag-Grid Products Table

**Time Estimate:** 2.5 hours
**Status:** NOT STARTED

### Overview

Replace Ant Design Table with ag-Grid for Excel-like editing experience.

### Column Structure

#### Always Visible Columns
```typescript
{
  headerName: '',
  field: 'checkbox',
  checkboxSelection: true,
  headerCheckboxSelection: true,
  width: 50,
  pinned: 'left'
},
{
  headerName: 'Артикул',
  field: 'sku',
  editable: true,
  width: 150,
  pinned: 'left'
},
{
  headerName: 'Бренд',
  field: 'brand',
  editable: true,
  width: 120,
  pinned: 'left'
},
{
  headerName: 'Наименование',
  field: 'product_name',
  editable: true,
  width: 250,
  pinned: 'left'
},
{
  headerName: 'Кол-во',
  field: 'quantity',
  editable: true,
  width: 100,
  type: 'numericColumn'
},
{
  headerName: 'Цена с VAT',
  field: 'base_price_vat',
  editable: true,
  width: 120,
  type: 'numericColumn'
},
{
  headerName: 'Вес (кг)',
  field: 'weight_in_kg',
  editable: true,
  width: 100,
  type: 'numericColumn'
}
```

#### Column Groups (Collapsible)

**Group 1: Базовые данные товара**
```typescript
{
  headerName: 'Базовые данные товара',
  children: [
    {
      headerName: 'Валюта',
      field: 'currency_of_base_price',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['USD', 'EUR', 'CNY', 'RUB', 'AED']
      },
      cellClass: (params) => getCellOverrideClass(params, 'currency_of_base_price')
    },
    {
      headerName: 'Страна поставщика',
      field: 'supplier_country',
      editable: true,
      cellClass: (params) => getCellOverrideClass(params, 'supplier_country')
    },
    {
      headerName: 'Скидка (%)',
      field: 'supplier_discount',
      editable: true,
      type: 'numericColumn',
      cellClass: (params) => getCellOverrideClass(params, 'supplier_discount')
    },
    {
      headerName: 'Курс',
      field: 'exchange_rate_base_price_to_quote',
      editable: true,
      type: 'numericColumn',
      cellClass: (params) => getCellOverrideClass(params, 'exchange_rate_base_price_to_quote')
    }
  ]
}
```

**Group 2: Таможня и налоги**
```typescript
{
  headerName: 'Таможня и налоги',
  children: [
    {
      headerName: 'Код ТН ВЭД',
      field: 'customs_code',
      editable: true,
      cellClass: (params) => getCellOverrideClass(params, 'customs_code')
    },
    {
      headerName: 'Пошлина (%)',
      field: 'import_tariff',
      editable: true,
      type: 'numericColumn',
      cellClass: (params) => getCellOverrideClass(params, 'import_tariff')
    },
    {
      headerName: 'Акциз',
      field: 'excise_tax',
      editable: true,
      type: 'numericColumn',
      cellClass: (params) => getCellOverrideClass(params, 'excise_tax')
    }
  ]
}
```

**Group 3: Финансовые**
```typescript
{
  headerName: 'Финансовые',
  children: [
    {
      headerName: 'Наценка (%)',
      field: 'markup',
      editable: true,
      type: 'numericColumn',
      cellClass: (params) => getCellOverrideClass(params, 'markup')
    }
  ]
}
```

**Group 4: Логистика**
```typescript
{
  headerName: 'Логистика',
  children: [
    {
      headerName: 'Срок поставки (дн)',
      field: 'delivery_time',
      editable: true,
      type: 'numericColumn',
      cellClass: (params) => getCellOverrideClass(params, 'delivery_time')
    }
  ]
}
```

**Group 5: Условия**
```typescript
{
  headerName: 'Условия',
  children: [
    {
      headerName: 'Аванс поставщику (%)',
      field: 'advance_to_supplier',
      editable: true,
      type: 'numericColumn',
      cellClass: (params) => getCellOverrideClass(params, 'advance_to_supplier')
    }
  ]
}
```

### Tasks

#### 3.1 Install and Import ag-Grid (15 min)

```typescript
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
```

#### 3.2 Create Column Definitions (30 min)

Create separate file for column config:
**File:** `frontend/src/app/quotes/create/agGridColumns.ts`

```typescript
import { ColDef, ColGroupDef } from 'ag-grid-community';

export const getQuoteProductColumns = (
  quoteDefaults: QuoteDefaults,
  onBulkEdit: (field: string) => void
): (ColDef | ColGroupDef)[] => {
  return [
    // Always visible columns
    // ... column definitions from above
  ];
};
```

#### 3.3 Create Product Row Interface (15 min)

```typescript
interface ProductRow {
  id: string;
  sku: string;
  brand: string;
  product_name: string;
  quantity: number;
  base_price_vat: number;
  weight_in_kg: number;

  // Override tracking
  overrides: {
    [key: string]: {
      value: any;
      overridden_by: string;
      overridden_by_name?: string;
      overridden_at: string;
    }
  };

  // Variable values (with defaults from quote)
  currency_of_base_price: string;
  supplier_country: string;
  supplier_discount: number;
  exchange_rate_base_price_to_quote: number;
  customs_code: string;
  import_tariff: number;
  excise_tax: number;
  markup: number;
  delivery_time: number;
  advance_to_supplier: number;
}
```

#### 3.4 Implement ag-Grid Component (45 min)

```tsx
const [productData, setProductData] = useState<ProductRow[]>([]);
const gridRef = useRef<AgGridReact>(null);

const defaultColDef: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  enableCellChangeFlash: true,
};

const onCellValueChanged = (event: CellValueChangedEvent) => {
  // Track that this cell was overridden
  const field = event.colDef.field;
  const productId = event.data.id;

  // Update overrides tracking
  setProductData(prev => prev.map(row => {
    if (row.id === productId) {
      return {
        ...row,
        overrides: {
          ...row.overrides,
          [field]: {
            value: event.newValue,
            overridden_by: currentUser.id,
            overridden_by_name: currentUser.full_name,
            overridden_at: new Date().toISOString()
          }
        }
      };
    }
    return row;
  }));
};

return (
  <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
    <AgGridReact
      ref={gridRef}
      rowData={productData}
      columnDefs={getQuoteProductColumns(quoteDefaults, handleBulkEdit)}
      defaultColDef={defaultColDef}
      enableRangeSelection={true}
      enableFillHandle={true}
      onCellValueChanged={onCellValueChanged}
      rowSelection="multiple"
      suppressRowClickSelection={true}
      enableClipboard={true}
      undoRedoCellEditing={true}
    />
  </div>
);
```

#### 3.5 Theme ag-Grid to Match Ant Design (30 min)

Create custom CSS file:
**File:** `frontend/src/app/quotes/create/agGridTheme.css`

```css
.ag-theme-alpine {
  --ag-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  --ag-font-size: 14px;
  --ag-header-background-color: #fafafa;
  --ag-header-foreground-color: rgba(0, 0, 0, 0.85);
  --ag-border-color: #f0f0f0;
  --ag-row-hover-color: #e6f7ff;
  --ag-selected-row-background-color: #e6f7ff;
}

/* Cell override classes */
.cell-default {
  color: #8c8c8c;
  font-style: italic;
}

.cell-user-override {
  color: #1890ff;
  font-weight: 600;
}

.cell-admin-override {
  color: #ff4d4f;
  font-weight: 600;
  cursor: help;
}
```

#### 3.6 Enable Excel Copy/Paste (15 min)

Already enabled by default with `enableClipboard={true}`, but test:
- Copy from Excel → Paste to ag-Grid (Ctrl+V)
- Copy from ag-Grid → Paste to Excel (Ctrl+C)
- Range selection with mouse drag
- Fill handle (drag corner to copy values down)

---

## Phase 4: Bulk Edit & Color Coding

**Time Estimate:** 2 hours
**Status:** NOT STARTED

### Overview

Implement bulk edit functionality via column header dropdowns and color-coded cells showing override status.

### Tasks

#### 4.1 Create Column Header Menu Component (45 min)

Custom header component with bulk edit menu:
**File:** `frontend/src/app/quotes/create/BulkEditHeaderComponent.tsx`

```tsx
import React from 'react';
import { IHeaderParams } from 'ag-grid-community';
import { Dropdown, Menu } from 'antd';
import { EditOutlined, ReloadOutlined } from '@ant-design/icons';

interface BulkEditHeaderProps extends IHeaderParams {
  onBulkEdit: (field: string) => void;
  onResetToDefaults: (field: string) => void;
}

export const BulkEditHeaderComponent: React.FC<BulkEditHeaderProps> = (props) => {
  const { displayName, column, onBulkEdit, onResetToDefaults } = props;

  const menu = (
    <Menu>
      <Menu.Item
        key="bulk-edit"
        icon={<EditOutlined />}
        onClick={() => onBulkEdit(column.getColId())}
      >
        Редактировать выбранные...
      </Menu.Item>
      <Menu.Item
        key="reset"
        icon={<ReloadOutlined />}
        onClick={() => onResetToDefaults(column.getColId())}
      >
        Сбросить к значениям по умолчанию
      </Menu.Item>
    </Menu>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <span>{displayName}</span>
      <Dropdown overlay={menu} trigger={['click']}>
        <EditOutlined style={{ cursor: 'pointer', marginLeft: 8 }} />
      </Dropdown>
    </div>
  );
};
```

#### 4.2 Create Bulk Edit Modal (45 min)

**File:** `frontend/src/app/quotes/create/BulkEditModal.tsx`

```tsx
import React, { useState } from 'react';
import { Modal, Checkbox, InputNumber, Select, Form, Space, Typography } from 'antd';

interface BulkEditModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (selectedRows: string[], newValue: any) => void;
  field: string;
  fieldLabel: string;
  products: ProductRow[];
  quoteDefault: any;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  visible,
  onClose,
  onApply,
  field,
  fieldLabel,
  products,
  quoteDefault
}) => {
  const [selectedRows, setSelectedRows] = useState<string[]>(products.map(p => p.id));
  const [newValue, setNewValue] = useState(quoteDefault);

  const handleApply = () => {
    onApply(selectedRows, newValue);
    onClose();
  };

  return (
    <Modal
      title={`Массовое редактирование: ${fieldLabel}`}
      open={visible}
      onOk={handleApply}
      onCancel={onClose}
      width={600}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Typography.Text strong>Новое значение:</Typography.Text>
          <Form layout="vertical" style={{ marginTop: 8 }}>
            <Form.Item>
              <InputNumber
                value={newValue}
                onChange={setNewValue}
                style={{ width: '100%' }}
                placeholder={`По умолчанию: ${quoteDefault}`}
              />
            </Form.Item>
          </Form>
        </div>

        <div>
          <Space direction="horizontal" style={{ marginBottom: 8 }}>
            <Typography.Text strong>Выберите товары ({selectedRows.length} из {products.length}):</Typography.Text>
            <a onClick={() => setSelectedRows(products.map(p => p.id))}>Выбрать все</a>
            <a onClick={() => setSelectedRows([])}>Снять выделение</a>
          </Space>

          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {products.map(product => (
              <Checkbox
                key={product.id}
                checked={selectedRows.includes(product.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedRows(prev => [...prev, product.id]);
                  } else {
                    setSelectedRows(prev => prev.filter(id => id !== product.id));
                  }
                }}
                style={{ display: 'block', marginBottom: 8 }}
              >
                <Space>
                  <span>{product.product_name}</span>
                  <Typography.Text type="secondary">
                    Текущее: {product[field]}
                  </Typography.Text>
                </Space>
              </Checkbox>
            ))}
          </div>
        </div>

        <Typography.Text type="secondary">
          Предпросмотр: {selectedRows.length} товаров будут изменены
        </Typography.Text>
      </Space>
    </Modal>
  );
};
```

#### 4.3 Implement Color Coding Function (15 min)

```typescript
const getCellOverrideClass = (params: CellClassParams, field: string): string => {
  const productRow = params.data as ProductRow;
  const override = productRow.overrides?.[field];

  if (!override) {
    // Using quote default
    return 'cell-default';
  }

  if (override.overridden_by === currentUser.id) {
    // Current user overrode this value
    return 'cell-user-override';
  }

  // Another user (admin/manager) overrode this value
  return 'cell-admin-override';
};
```

#### 4.4 Add Tooltip for Admin Overrides (15 min)

```typescript
const cellRendererParams = {
  tooltipValueGetter: (params: ITooltipParams) => {
    const productRow = params.data as ProductRow;
    const field = params.colDef.field!;
    const override = productRow.overrides?.[field];

    if (override && override.overridden_by !== currentUser.id) {
      return `Изменено: ${override.overridden_by_name || override.overridden_by}\nДата: ${new Date(override.overridden_at).toLocaleString('ru-RU')}`;
    }

    return null;
  }
};
```

---

## Phase 5: Backend Updates

**Time Estimate:** 1.5 hours
**Status:** NOT STARTED

### Overview

Update backend to support product-level variable overrides and SKU/Brand tracking.

### Tasks

#### 5.1 Database Migration for SKU/Brand (20 min)

**File:** `backend/migrations/009_add_sku_brand.sql`

```sql
-- Add SKU and Brand columns to quote_items
ALTER TABLE quote_items
ADD COLUMN IF NOT EXISTS sku TEXT,
ADD COLUMN IF NOT EXISTS brand TEXT;

-- Add overrides tracking columns
ALTER TABLE quote_items
ADD COLUMN IF NOT EXISTS variable_overrides JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_override_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_override_at TIMESTAMP WITH TIME ZONE;

-- Create index on SKU and Brand for analytics
CREATE INDEX IF NOT EXISTS idx_quote_items_sku ON quote_items(sku);
CREATE INDEX IF NOT EXISTS idx_quote_items_brand ON quote_items(brand);

-- Add comment
COMMENT ON COLUMN quote_items.variable_overrides IS 'JSON object tracking which variables were overridden at product level: {field_name: {value, overridden_by, overridden_at}}';
```

#### 5.2 Update Pydantic Models (30 min)

**File:** `backend/routes/quotes_calc.py`

```python
class QuoteItemCreate(BaseModel):
    """Quote item with product-level data"""
    product_name: str
    sku: Optional[str] = None
    brand: Optional[str] = None
    quantity: int = Field(..., gt=0)
    base_price_vat: Decimal = Field(..., gt=0)
    weight_in_kg: Decimal = Field(default=0, ge=0)

    # Product-level variables (can override quote defaults)
    currency_of_base_price: Optional[str] = None
    supplier_country: Optional[str] = None
    supplier_discount: Optional[Decimal] = None
    exchange_rate_base_price_to_quote: Optional[Decimal] = None
    customs_code: Optional[str] = None
    import_tariff: Optional[Decimal] = None
    excise_tax: Optional[Decimal] = None
    markup: Optional[Decimal] = None
    delivery_time: Optional[int] = None
    advance_to_supplier: Optional[Decimal] = None

    # Override tracking
    variable_overrides: Optional[Dict[str, Any]] = Field(default_factory=dict)


class QuoteCalculationRequest(BaseModel):
    """Complete quote calculation request"""
    customer_id: str

    # Quote-level defaults
    quote_defaults: QuoteDefaults

    # Product items (with potential overrides)
    items: List[QuoteItemCreate]
```

#### 5.3 Update Calculation Logic (40 min)

**File:** `backend/routes/quotes_calc.py`

```python
def merge_quote_and_product_variables(
    quote_defaults: QuoteDefaults,
    product_item: QuoteItemCreate
) -> Dict[str, Any]:
    """
    Merge quote-level defaults with product-level overrides
    Product-level values take precedence over quote defaults
    """
    merged = {}

    # List of variables that can be both quote-level and product-level
    override_fields = [
        'currency_of_base_price',
        'supplier_country',
        'supplier_discount',
        'exchange_rate_base_price_to_quote',
        'customs_code',
        'import_tariff',
        'excise_tax',
        'markup',
        'delivery_time',
        'advance_to_supplier'
    ]

    for field in override_fields:
        product_value = getattr(product_item, field, None)
        quote_value = getattr(quote_defaults, field, None)

        # Use product value if set, otherwise use quote default
        merged[field] = product_value if product_value is not None else quote_value

    return merged

@router.post("/calculate", response_model=QuoteCalculationResponse)
async def calculate_quote(
    request: QuoteCalculationRequest,
    user: User = Depends(get_current_user)
):
    """Calculate quote with product-level overrides support"""

    # Get admin settings
    admin_settings = await get_organization_admin_settings(user)

    results = []
    for item in request.items:
        # Merge quote defaults with product overrides
        variables = merge_quote_and_product_variables(
            request.quote_defaults,
            item
        )

        # Add admin settings
        variables['rate_forex_risk'] = admin_settings.rate_forex_risk
        variables['rate_fin_comm'] = admin_settings.rate_fin_comm
        variables['rate_loan_interest_daily'] = admin_settings.rate_loan_interest_daily

        # Run calculation
        calc_result = calculate_product_financials(
            quantity=item.quantity,
            base_price_vat=item.base_price_vat,
            weight_in_kg=item.weight_in_kg,
            **variables
        )

        results.append({
            'product_name': item.product_name,
            'sku': item.sku,
            'brand': item.brand,
            'quantity': item.quantity,
            **calc_result,
            'variable_overrides': item.variable_overrides
        })

    return QuoteCalculationResponse(items=results)
```

---

## Phase 6: Testing & Polish

**Time Estimate:** 1 hour
**Status:** NOT STARTED

### Test Cases

#### 6.1 Excel Copy/Paste (15 min)
- [ ] Open Excel, copy 5 rows × 3 columns
- [ ] Paste into ag-Grid products table
- [ ] Verify all values pasted correctly
- [ ] Copy from ag-Grid, paste to Excel
- [ ] Verify round-trip works

#### 6.2 Bulk Edit (15 min)
- [ ] Click gear icon on "Наценка" column
- [ ] Select "Редактировать выбранные"
- [ ] Select 5 products from modal
- [ ] Enter new markup value: 20%
- [ ] Apply
- [ ] Verify only selected 5 products updated
- [ ] Verify cells turned blue (user override)

#### 6.3 Color Coding (15 min)
- [ ] Upload products, all cells should be gray (using defaults)
- [ ] Edit one cell, verify it turns blue
- [ ] Simulate admin override, verify cell turns red
- [ ] Hover over red cell, verify tooltip shows admin name/date

#### 6.4 Quote Calculation (15 min)
- [ ] Fill quote defaults
- [ ] Upload 3 products
- [ ] Override markup for product 2 only
- [ ] Click calculate
- [ ] Verify:
  - Product 1 uses quote default markup
  - Product 2 uses overridden markup
  - Product 3 uses quote default markup
  - Calculation results are correct

---

## Success Criteria Checklist

- [ ] ag-Grid installed and themed to match Ant Design
- [ ] Quote-level defaults section with 6 collapsible cards works
- [ ] Admin settings info box displays current values
- [ ] Products table shows SKU, Brand, Name, Qty, Price, Weight (always visible)
- [ ] Column groups (5 groups) can be collapsed/expanded
- [ ] Excel copy/paste works in both directions
- [ ] Bulk edit modal accessible via column header gear icon
- [ ] Bulk edit correctly updates selected products
- [ ] Color coding works: gray (default), blue (user), red (admin)
- [ ] Tooltips show override information for admin overrides
- [ ] Backend accepts product-level overrides
- [ ] Calculations use merged quote defaults + product overrides
- [ ] SKU and Brand stored in database for analytics

---

## Files Modified

### Frontend
- ✅ `/home/novi/quotation-app/.claude/README.md` (created)
- ⏳ `/home/novi/quotation-app/.claude/IMPLEMENTATION_PLAN_AG_GRID.md` (this file)
- ⏳ `/home/novi/quotation-app/.claude/VARIABLES_CLASSIFICATION.md` (update)
- ⏳ `/home/novi/quotation-app/frontend/package.json` (ag-grid deps)
- ⏳ `/home/novi/quotation-app/frontend/src/app/quotes/create/page.tsx` (major restructure)
- ⏳ `/home/novi/quotation-app/frontend/src/app/quotes/create/agGridColumns.ts` (new)
- ⏳ `/home/novi/quotation-app/frontend/src/app/quotes/create/BulkEditHeaderComponent.tsx` (new)
- ⏳ `/home/novi/quotation-app/frontend/src/app/quotes/create/BulkEditModal.tsx` (new)
- ⏳ `/home/novi/quotation-app/frontend/src/app/quotes/create/agGridTheme.css` (new)

### Backend
- ⏳ `/home/novi/quotation-app/backend/migrations/009_add_sku_brand.sql` (new)
- ⏳ `/home/novi/quotation-app/backend/routes/quotes_calc.py` (update models, calc logic)

---

## Progress Tracking

**Phase 1:** ⏳ IN PROGRESS (33% complete)
**Phase 2:** ⬜ NOT STARTED
**Phase 3:** ⬜ NOT STARTED
**Phase 4:** ⬜ NOT STARTED
**Phase 5:** ⬜ NOT STARTED
**Phase 6:** ⬜ NOT STARTED

**Overall Progress:** 5% complete

---

## Notes & Decisions

### Why ag-Grid Over Custom Solution?
- Saves 5-6 hours of development time
- Battle-tested library used by banks and financial institutions
- Excel-like features work out of the box
- Better TypeScript support than building custom
- Active community and documentation

### Why Column Header Bulk Edit vs Excel-Style Cell Selection?
- Simpler to implement (30 min vs 2-3 hours)
- Good enough for 80% of use cases
- Can add true cell selection later if needed
- More intuitive for non-Excel power users

### Color Coding Rationale
- **Gray:** Visual hint that value comes from quote default (can be changed)
- **Blue:** Shows user they customized this specific product
- **Red:** Warning that admin/manager set this (higher authority)
- **Tooltip:** Transparency about who made changes and when

---

**Last Updated:** 2025-10-19
**Next Review:** After Phase 1 completion
