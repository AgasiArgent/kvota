# Frontend - Next.js + React Patterns

**Stack:** Next.js 15.5 (App Router) + React 19 + TypeScript + Ant Design + ag-Grid

---

## Next.js 15 App Router Patterns

### File Structure

```
src/app/
├── page.tsx              # Homepage (/)
├── layout.tsx            # Root layout with providers
├── quotes/
│   ├── page.tsx          # List page (/quotes)
│   ├── create/page.tsx   # Create page (/quotes/create)
│   └── [id]/page.tsx     # Detail page (/quotes/123)
└── settings/
    └── calculation/page.tsx
```

### Server vs Client Components

**Default: Server Components** (no 'use client')

- Use for static content, data fetching
- Better performance, smaller bundles

**Client Components** (add 'use client' at top)

- Required for: useState, useEffect, event handlers, browser APIs
- Required for: Ant Design components (they use React context)
- Required for: ag-Grid (interactive table)

### Example Pattern

```typescript
'use client';

import { useState } from 'react';
import { Card, Form, Input, Button } from 'antd';

export default function MyPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Component logic
}
```

---

## Ant Design Patterns

### Form Handling

```typescript
import { Form, Input, InputNumber, Select } from 'antd';

const [form] = Form.useForm();

// Get values
const values = form.getFieldsValue();

// Set values
form.setFieldsValue({ field_name: value });

// Reset
form.resetFields();

// Validation
await form.validateFields();
```

### Common Components

- `Card` - Containers with title and actions
- `Form.Item` - Form fields with validation
- `Select` - Dropdowns
- `InputNumber` - Number inputs with step/min/max
- `DatePicker` - Date selection
- `Table` - Basic tables (use ag-Grid for complex tables)
- `Modal` - Dialogs
- `message` - Toast notifications

### Russian Text

All user-facing text in Russian:

```typescript
<Form.Item label="Валюта КП" name="currency_of_quote">
  <Select>
    <Option value="USD">USD</Option>
    <Option value="RUB">RUB</Option>
  </Select>
</Form.Item>
```

---

## ag-Grid Patterns

### Basic Setup

```typescript
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const [rowData, setRowData] = useState<Product[]>([]);
const [columnDefs] = useState<ColDef[]>([
  { field: 'name', headerName: 'Название' },
  { field: 'quantity', headerName: 'Кол-во', editable: true }
]);

<div className="ag-theme-alpine" style={{ height: 600 }}>
  <AgGridReact
    rowData={rowData}
    columnDefs={columnDefs}
    onCellValueChanged={onCellValueChanged}
  />
</div>
```

### Excel-like Features

```typescript
defaultColDef={{
  sortable: true,
  filter: true,
  resizable: true
}}
enableRangeSelection={true}
enableCellTextSelection={true}
rowSelection="multiple"
```

### Column Groups

```typescript
{
  headerName: 'Product Info',
  children: [
    { field: 'sku', headerName: 'Артикул' },
    { field: 'brand', headerName: 'Бренд' }
  ]
}
```

### Cell Styling (Gray/Blue for Defaults/Overrides)

```typescript
cellStyle: (params) => {
  if (!params.value) {
    return { backgroundColor: '#f5f5f5' }; // Gray - empty (using default)
  }
  return { backgroundColor: '#e6f7ff' }; // Blue - filled (override)
};
```

---

## API Client Patterns

### Service Files

Location: `src/lib/api/*-service.ts`

Pattern:

```typescript
import { createClient } from '@/lib/supabase/client';

export async function fetchQuotes() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error('Not authenticated');

  const response = await fetch('http://localhost:8000/api/quotes', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}
```

### TypeScript Interfaces

Define types matching backend Pydantic models:

```typescript
export interface Product {
  sku?: string;
  brand?: string;
  name: string;
  base_price_vat: number;
  quantity: number;
  weight_in_kg?: number;
  // ... overrides
  currency_of_base_price?: string;
  supplier_country?: string;
}

export interface QuoteRequest {
  quote_defaults: QuoteDefaults;
  products: Product[];
}
```

---

## State Management

### Simple State - useState

```typescript
const [products, setProducts] = useState<Product[]>([]);
const [loading, setLoading] = useState(false);
```

### Form State - Ant Design Form

```typescript
const [form] = Form.useForm();
// Form manages its own state
```

### Grid State - ag-Grid

```typescript
const gridRef = useRef<AgGridReact>(null);

// Get selected rows
const selected = gridRef.current?.api.getSelectedRows();

// Update cells programmatically
gridRef.current?.api.applyTransaction({ update: [updatedRow] });
```

---

## Common Patterns

### File Upload

```typescript
import { Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

<Upload.Dragger
  accept=".xlsx,.csv"
  customRequest={async ({ file }) => {
    const formData = new FormData();
    formData.append('file', file);
    // Upload to API
  }}
>
  <p className="ant-upload-drag-icon">
    <InboxOutlined />
  </p>
  <p>Перетащите файл или нажмите для выбора</p>
</Upload.Dragger>
```

### Loading States

```typescript
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true);
  try {
    await apiCall();
    message.success('Успешно');
  } catch (error) {
    message.error('Ошибка');
  } finally {
    setLoading(false);
  }
};

<Button loading={loading} onClick={handleSubmit}>
  Сохранить
</Button>
```

### Error Handling

```typescript
try {
  const result = await apiCall();
} catch (error) {
  if (error instanceof Error) {
    message.error(error.message);
  } else {
    message.error('Произошла ошибка');
  }
}
```

---

## Styling

### Tailwind CSS

```typescript
<div className="max-w-7xl mx-auto p-6">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    // Content
  </div>
</div>
```

### Ant Design Theming

Configured in `src/app/layout.tsx` via AntdRegistry

### ag-Grid Themes

```typescript
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

<div className="ag-theme-alpine">
  <AgGridReact ... />
</div>
```

---

## Development Commands

```bash
cd /home/novi/quotation-app/frontend

npm run dev        # Start dev server (already running on :3000)
npm run build      # Production build
npm install <pkg>  # Add dependency
npm run lint       # ESLint
```

---

## Exchange Rates Display

The sidebar shows live exchange rates for key currencies (USD, EUR, TRY, CNY).

**Component:** `src/components/layout/ExchangeRates.tsx`

**Features:**

- Auto-refresh every 30 minutes
- Manual refresh button
- Dark theme styling
- Collapsible with sidebar

**API Route:** `src/app/api/exchange-rates/[from]/[to]/route.ts`

- Proxies requests to backend
- Handles authentication
- Returns rate data

**Usage in MainLayout:**

```typescript
// Shows when sidebar is expanded
{!collapsed && <ExchangeRates />}
```

**Styling:**

- Background: `rgba(255, 255, 255, 0.04)` (subtle highlight)
- Text: Russian labels ("Курсы валют ЦБ РФ")
- Updates: Shows last update time in tooltip

---

## Common Gotchas

1. **'use client' required for Ant Design** - All Ant Design components need client-side rendering
2. **ag-Grid height required** - Must set explicit height (e.g., 600px) or grid won't show
3. **Supabase session for API calls** - Always get session and pass Bearer token
4. **Form initial values** - Set via `initialValues` prop, not `setFieldsValue` in render
5. **ag-Grid cell updates** - Use `onCellValueChanged` event, then update state

---

## File Naming Conventions

- Pages: `page.tsx` (Next.js 15 requirement)
- Layouts: `layout.tsx`
- Components: `PascalCase.tsx`
- Services: `kebab-case-service.ts`
- Utilities: `kebab-case.ts`
