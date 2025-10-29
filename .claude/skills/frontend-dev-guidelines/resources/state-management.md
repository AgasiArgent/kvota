# State Management Patterns

**Last Updated:** 2025-10-29

Guide for choosing the right state management approach in Next.js 15 + React 19 + Ant Design + ag-Grid applications.

---

## Decision Tree

```
Is it form data?
├─ YES → Use Ant Design Form (Form.useForm())
└─ NO → Is it grid/table data?
    ├─ YES → Use ag-Grid State (rowData + gridRef)
    └─ NO → Is it local to one component?
        ├─ YES → Use useState
        └─ NO → Is it shared across components?
            ├─ YES → Use React Context (or parent state + props)
            └─ NO → Use useState

Quick Reference:
- Form fields: Ant Design Form ✅
- Grid data: ag-Grid State ✅
- UI toggles (modals, loading): useState ✅
- Shared data (user profile, theme): Context ✅
```

---

## 1. useState - Local Component State

**Use for:**
- UI state (modals, loading indicators, toggles)
- Data fetched from APIs (lists, single objects)
- Selection state (selected items, active tab)
- Temporary UI state (expanded sections, filters)

### Examples from Quote Creation Page

```typescript
'use client';

import { useState } from 'react';

export default function CreateQuotePage() {
  // Loading states
  const [loading, setLoading] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);

  // Data from APIs
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [templates, setTemplates] = useState<VariableTemplate[]>([]);
  const [uploadedProducts, setUploadedProducts] = useState<Product[]>([]);
  const [calculationResults, setCalculationResults] = useState<any>(null);

  // Selection state
  const [selectedCustomer, setSelectedCustomer] = useState<string | undefined>();
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>();
  const [selectedContact, setSelectedContact] = useState<string | undefined>();

  // UI toggles
  const [bulkEditModalVisible, setBulkEditModalVisible] = useState(false);
  const [columnChooserVisible, setColumnChooserVisible] = useState(false);
  const [showAdvancedPayment, setShowAdvancedPayment] = useState(false);

  // Mode/configuration state
  const [logisticsMode, setLogisticsMode] = useState<'total' | 'detailed'>('detailed');

  // ...component logic
}
```

### Pattern: Fetching Data on Mount

```typescript
const [customers, setCustomers] = useState<Customer[]>([]);

useEffect(() => {
  const loadCustomers = async () => {
    const result = await customerService.listCustomers();
    if (result.success && result.data) {
      setCustomers(result.data.customers);
    }
  };

  loadCustomers();
}, []); // Empty deps = run once on mount
```

### Pattern: Dependent State

```typescript
const [selectedCustomer, setSelectedCustomer] = useState<string | undefined>();
const [customerContacts, setCustomerContacts] = useState<any[]>([]);

// Load contacts when customer changes
useEffect(() => {
  if (selectedCustomer) {
    loadCustomerContacts(selectedCustomer);
  } else {
    setCustomerContacts([]);
  }
}, [selectedCustomer]); // Re-run when selectedCustomer changes
```

---

## 2. Ant Design Form - Form State Management

**Use for:**
- All form inputs (text, numbers, dates, selects)
- Form validation
- Submission handling
- Default values from API

### Basic Setup

```typescript
import { Form, Input, InputNumber, DatePicker, Select } from 'antd';
import type { CalculationVariables } from '@/lib/api/quotes-calc-service';

const [form] = Form.useForm<CalculationVariables>();

<Form
  form={form}
  layout="vertical"
  onFinish={handleSubmit}
>
  <Form.Item label="Валюта КП" name="currency_of_quote">
    <Select>
      <Option value="USD">USD</Option>
      <Option value="RUB">RUB</Option>
    </Select>
  </Form.Item>

  <Form.Item label="Срок поставки (дней)" name="delivery_days">
    <InputNumber min={1} />
  </Form.Item>
</Form>
```

### Pattern: Setting Initial/Default Values

```typescript
// On mount - set defaults
useEffect(() => {
  const defaultVars = quotesCalcService.getDefaultVariables();
  form.setFieldsValue({
    ...defaultVars,
    quote_date: dayjs(),
    valid_until: dayjs().add(30, 'day'),
  });
}, []);
```

### Pattern: Syncing State with Form

```typescript
const [selectedCustomer, setSelectedCustomer] = useState<string | undefined>();

// When external state changes, update form
useEffect(() => {
  if (selectedCustomer) {
    form.setFieldsValue({ customer_id: selectedCustomer } as any);
  }
}, [selectedCustomer, form]);
```

### Pattern: Getting Form Values

```typescript
// Get all values
const values = form.getFieldsValue();

// Get specific field
const currency = form.getFieldValue('currency_of_quote');

// Submit handler receives values
const handleSubmit = async (values: CalculationVariables) => {
  console.log('Form values:', values);
  // ... submit to API
};
```

### Pattern: Form Validation

```typescript
// Validate all fields
try {
  await form.validateFields();
  // All fields valid
} catch (error) {
  // Show validation errors
  message.error('Пожалуйста, заполните все обязательные поля');
}

// Validation rules in Form.Item
<Form.Item
  label="Название товара"
  name="product_name"
  rules={[
    { required: true, message: 'Обязательное поле' },
    { min: 3, message: 'Минимум 3 символа' }
  ]}
>
  <Input />
</Form.Item>
```

### Pattern: Resetting Form

```typescript
// Reset all fields to initial values
form.resetFields();

// Reset specific fields
form.resetFields(['currency_of_quote', 'delivery_days']);
```

---

## 3. ag-Grid State - Grid Data and Selection

**Use for:**
- Table/grid data (products, items, rows)
- Column definitions
- Grid API access (selection, filters, export)

### Basic Setup

```typescript
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const gridRef = useRef<AgGridReact>(null);
const [rowData, setRowData] = useState<Product[]>([]);
const [columnDefs] = useState<ColDef[]>([
  { field: 'sku', headerName: 'Артикул', editable: true },
  { field: 'name', headerName: 'Название', editable: true },
  { field: 'quantity', headerName: 'Кол-во', editable: true }
]);

<div className="ag-theme-alpine" style={{ height: 600 }}>
  <AgGridReact
    ref={gridRef}
    rowData={rowData}
    columnDefs={columnDefs}
    onCellValueChanged={handleCellChange}
    rowSelection="multiple"
  />
</div>
```

### Pattern: Updating Row Data

```typescript
// Update cell when user edits
const handleCellChange = (event: any) => {
  const updatedProducts = [...rowData];
  updatedProducts[event.node.rowIndex] = event.data;
  setRowData(updatedProducts);
};

// Add new row
const addProduct = () => {
  const newProduct: Product = {
    sku: '',
    name: '',
    quantity: 1,
    base_price_vat: 0
  };
  setRowData([...rowData, newProduct]);
};

// Remove selected rows
const deleteSelected = () => {
  const selectedRows = gridRef.current?.api.getSelectedRows() || [];
  const remaining = rowData.filter(p => !selectedRows.includes(p));
  setRowData(remaining);
};
```

### Pattern: Grid API Access

```typescript
// Get selected rows
const selected = gridRef.current?.api.getSelectedRows() || [];

// Get all row data
const allData = gridRef.current?.api.getModel().getRowNode(0)?.data;

// Export to CSV
gridRef.current?.api.exportDataAsCsv({
  fileName: 'products.csv'
});

// Apply transaction (efficient updates)
gridRef.current?.api.applyTransaction({
  add: [newProduct],
  update: [updatedProduct],
  remove: [deletedProduct]
});
```

### Pattern: Column Visibility

```typescript
// Toggle column visibility
const toggleColumn = (field: string, visible: boolean) => {
  gridRef.current?.api.setColumnsVisible([field], visible);
};

// Get all columns
const allColumns = gridRef.current?.api.getAllColumns();
```

---

## 4. React Context - Shared State

**Use for:**
- User authentication state
- Theme/dark mode
- Organization settings
- Shared data across multiple pages

### Example: Auth Context (Not in quote creation, but common pattern)

```typescript
// contexts/AuthContext.tsx
import { createContext, useContext, useState } from 'react';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string) => {
    // ... login logic
    setUser(loggedInUser);
  };

  const logout = async () => {
    // ... logout logic
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// Usage in components
const { user, logout } = useAuth();
```

---

## Pros/Cons Summary

### useState
✅ Simple, no boilerplate
✅ Works for most local state
✅ Easy to debug
❌ Re-renders component on change
❌ Not suitable for complex forms

### Ant Design Form
✅ Built-in validation
✅ Handles form submission
✅ Preserves state during re-renders
✅ Works with all Ant Design inputs
❌ Learning curve for API
❌ Not for non-form state

### ag-Grid State
✅ Handles large datasets efficiently
✅ Built-in selection, filtering, sorting
✅ Grid API for advanced operations
❌ More complex than simple tables
❌ Requires explicit height

### React Context
✅ Avoids prop drilling
✅ Global state access
❌ Over-use causes unnecessary re-renders
❌ More boilerplate than useState

---

## Anti-Patterns to Avoid

❌ **DON'T store form data in useState AND Ant Form**
```typescript
// BAD - double state
const [formData, setFormData] = useState({});
const [form] = Form.useForm();
// Pick ONE approach
```

❌ **DON'T use Context for local state**
```typescript
// BAD - overkill for single component
<ThemeContext.Provider value={{ modalOpen }}>
// GOOD - just use useState
const [modalOpen, setModalOpen] = useState(false);
```

❌ **DON'T mutate state directly**
```typescript
// BAD - mutates array
products.push(newProduct);
setProducts(products);

// GOOD - creates new array
setProducts([...products, newProduct]);
```

❌ **DON'T forget dependencies in useEffect**
```typescript
// BAD - missing selectedCustomer in deps
useEffect(() => {
  loadContacts(selectedCustomer);
}, []); // Will only run once!

// GOOD
useEffect(() => {
  loadContacts(selectedCustomer);
}, [selectedCustomer]); // Re-runs when selectedCustomer changes
```

---

## Quick Checklist

**Before adding state, ask:**

1. ☐ Is this form data? → Use Ant Design Form
2. ☐ Is this grid/table data? → Use ag-Grid State
3. ☐ Is this shared across components? → Use Context or lift state up
4. ☐ Is this local UI state? → Use useState
5. ☐ Do I need validation? → Use Ant Design Form
6. ☐ Do I need persistence? → useState + localStorage or API

**When updating state, remember:**

1. ☐ Never mutate state directly (use spread operator)
2. ☐ Batch updates when possible (React 18+ auto-batches)
3. ☐ Use functional updates for state based on previous state
4. ☐ Clean up subscriptions/timers in useEffect return function

---

## Further Reading

- Ant Design Form API: https://ant.design/components/form
- ag-Grid React: https://www.ag-grid.com/react-data-grid/
- React useState: https://react.dev/reference/react/useState
- React Context: https://react.dev/reference/react/useContext
