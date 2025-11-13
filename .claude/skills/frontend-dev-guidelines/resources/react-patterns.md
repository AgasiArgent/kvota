# React 19 + Next.js 15.5 Patterns

**Last Updated:** 2025-10-29
**Project:** B2B Quotation Platform
**Stack:** Next.js 15.5 (App Router) + React 19 + TypeScript

---

## 1. 'use client' Requirement

### When to Use

**ALWAYS add `'use client'` directive when:**
- Using React hooks (useState, useEffect, useCallback, useMemo)
- Handling events (onClick, onChange, onSubmit)
- Using browser APIs (window, document, localStorage)
- Using Ant Design components (they require React context)
- Using ag-Grid (interactive data table)
- Using dynamic imports with loading states

### When NOT to Use

**Server Components (default - no directive needed):**
- Static content rendering
- Data fetching at build time
- SEO-optimized pages
- Performance-critical initial loads

### Example Pattern

```typescript
'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Form, Input, Button, Card, App } from 'antd';
import { useRouter } from 'next/navigation';

export default function MyPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  // Component logic with hooks
  useEffect(() => {
    // Side effects
  }, []);

  return (
    <Card title="My Page">
      <Form form={form}>
        {/* Content */}
      </Form>
    </Card>
  );
}
```

**⚠️ Critical:** Place `'use client'` at the **very first line** (before imports).

---

## 2. Component Structure

### Functional Component Pattern

**Standard structure:**
```typescript
'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { /* Ant Design imports */ } from 'antd';
import { /* Icons */ } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { /* Type imports */ } from '@/lib/api/*-service';

export default function FeaturePage() {
  // 1. Router and refs
  const router = useRouter();
  const gridRef = useRef<any>(null);

  // 2. Form instances
  const [form] = Form.useForm();
  const { message } = App.useApp();

  // 3. State hooks
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DataType[]>([]);

  // 4. Effects
  useEffect(() => {
    loadInitialData();
  }, []);

  // 5. Memoized values
  const memoizedValue = useMemo(() => {
    return expensiveCalculation(data);
  }, [data]);

  // 6. Callbacks
  const handleSubmit = useCallback(async (values: FormValues) => {
    setLoading(true);
    try {
      await apiCall(values);
      message.success('Успешно');
    } catch (error) {
      message.error('Ошибка');
    } finally {
      setLoading(false);
    }
  }, [message]);

  // 7. Helper functions
  const loadInitialData = async () => {
    // Load data
  };

  // 8. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

**Key Points:**
- ✅ Use functional components (no class components)
- ✅ Group hooks logically (refs → forms → state → effects → memos → callbacks)
- ✅ Define helper functions before render
- ✅ No inline functions in JSX (define handlers separately)
- ✅ TypeScript: explicit types for props, state, and return values

---

## 3. Hooks

### useState - Simple State

```typescript
// Primitive values
const [loading, setLoading] = useState(false);
const [count, setCount] = useState(0);

// Objects with type safety
const [user, setUser] = useState<User | null>(null);

// Arrays
const [products, setProducts] = useState<Product[]>([]);

// Update patterns
setProducts([...products, newProduct]); // Add
setProducts(products.filter(p => p.id !== id)); // Remove
setProducts(products.map(p => p.id === id ? updated : p)); // Update
```

### useEffect - Side Effects

```typescript
// Run once on mount
useEffect(() => {
  loadInitialData();
}, []);

// Run when dependency changes
useEffect(() => {
  if (selectedCustomer) {
    loadCustomerContacts(selectedCustomer);
  }
}, [selectedCustomer]);

// Cleanup pattern
useEffect(() => {
  const timer = setInterval(() => {
    // Do something
  }, 1000);

  return () => {
    clearInterval(timer); // Cleanup on unmount
  };
}, []);

// Multiple effects (separate concerns)
useEffect(() => {
  loadCustomers();
}, []);

useEffect(() => {
  loadTemplates();
}, []);
```

**⚠️ Rules:**
- Always include dependencies in dependency array
- Don't omit dependencies (ESLint will warn)
- Cleanup with return function for subscriptions/timers

### useRef - DOM References & Mutable Values

```typescript
// DOM reference (ag-Grid instance)
const gridRef = useRef<any>(null);

// Access grid API
const selectedRows = gridRef.current?.api.getSelectedRows();
gridRef.current?.api.applyTransaction({ update: [updatedRow] });

// Mutable value (doesn't trigger re-render)
const renderCount = useRef(0);
renderCount.current += 1;
```

### useMemo - Expensive Calculations

```typescript
// Memoize computed values
const filteredProducts = useMemo(() => {
  return products.filter(p => p.quantity > 0);
}, [products]);

// Memoize column definitions (ag-Grid)
const columnDefs = useMemo<ColDef[]>(() => [
  { field: 'name', headerName: 'Название' },
  { field: 'quantity', headerName: 'Кол-во' }
], []); // Empty deps = compute once
```

**⚠️ Use when:**
- Expensive calculations (filtering, sorting, transformations)
- Preventing child component re-renders (pass memoized props)
- ag-Grid column definitions (prevents infinite re-renders)

### useCallback - Memoized Functions

```typescript
// Memoize event handlers
const handleSubmit = useCallback(async (values: FormValues) => {
  setLoading(true);
  try {
    await apiCall(values);
    message.success('Успешно');
  } catch (error) {
    message.error('Ошибка');
  } finally {
    setLoading(false);
  }
}, [message]); // Include dependencies

// Pass to child components (prevents unnecessary re-renders)
<ChildComponent onSave={handleSubmit} />
```

**⚠️ Use when:**
- Passing functions to child components
- Functions used in useEffect dependencies
- Event handlers with complex logic

---

## 4. Suspense - Loading States (React 19)

### Dynamic Import with Suspense

```typescript
import dynamic from 'next/dynamic';
import { Spin } from 'antd';

// Lazy load ag-Grid (saves ~300KB initial bundle)
const AgGridReact = dynamic(
  async () => {
    const { AgGridReact } = await import('ag-grid-react');
    const { ModuleRegistry, AllCommunityModule } = await import('ag-grid-community');

    // Register modules when loaded
    ModuleRegistry.registerModules([AllCommunityModule]);

    return AgGridReact;
  },
  {
    loading: () => <Spin size="large" tip="Загрузка таблицы..." />,
    ssr: false, // Disable SSR for client-only component
  }
);
```

### Component-Level Loading States

```typescript
export default function MyPage() {
  const [loading, setLoading] = useState(false);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" tip="Загрузка данных..." />
      </div>
    );
  }

  return <div>{/* Content */}</div>;
}
```

---

## 5. Error Boundaries - Error Handling

### Try/Catch Pattern (Standard)

```typescript
const handleSubmit = async (values: FormValues) => {
  setLoading(true);
  try {
    const result = await apiCall(values);
    message.success('Успешно сохранено');
    router.push('/quotes');
  } catch (error) {
    // Type-safe error handling
    if (error instanceof Error) {
      message.error(error.message);
    } else {
      message.error('Произошла неизвестная ошибка');
    }
    console.error('Submit error:', error);
  } finally {
    setLoading(false);
  }
};
```

### Form Validation Errors

```typescript
const handleSubmit = async () => {
  try {
    // Validate form first
    const values = await form.validateFields();
    await apiCall(values);
    message.success('Успешно');
  } catch (error) {
    if (error instanceof Error) {
      // API error
      message.error(error.message);
    } else {
      // Validation error (Ant Design)
      message.error('Проверьте правильность заполнения формы');
    }
  }
};
```

### Error Boundary Component (React 19)

```typescript
'use client';

import { Component, ReactNode } from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="500"
          title="Произошла ошибка"
          subTitle={this.state.error?.message}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              Перезагрузить страницу
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}
```

---

## 6. Server vs Client Components

### Server Components (Default)

**No `'use client'` directive:**
```typescript
// src/app/about/page.tsx
export default function AboutPage() {
  return (
    <div>
      <h1>О компании</h1>
      <p>Статическое содержимое</p>
    </div>
  );
}
```

**Benefits:**
- ✅ Smaller client bundle (no JavaScript)
- ✅ Better SEO (server-rendered HTML)
- ✅ Faster initial load (no hydration)
- ✅ Direct database access (no API needed)

**Use for:**
- Static content pages
- Landing pages
- Documentation
- Marketing pages

### Client Components

**With `'use client'` directive:**
```typescript
'use client';

import { useState } from 'react';

export default function InteractivePage() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  );
}
```

**Use for:**
- Forms with validation
- Interactive UI (buttons, dropdowns, modals)
- Real-time updates (WebSocket, polling)
- Browser APIs (localStorage, window events)
- Third-party libraries (Ant Design, ag-Grid)

### Hybrid Approach

**Server Component wrapping Client Components:**
```typescript
// src/app/dashboard/page.tsx (Server Component)
import { fetchStats } from '@/lib/api';
import StatsCard from '@/components/StatsCard'; // Client Component

export default async function DashboardPage() {
  const stats = await fetchStats(); // Server-side fetch

  return (
    <div>
      <h1>Dashboard</h1>
      <StatsCard stats={stats} /> {/* Client Component */}
    </div>
  );
}
```

```typescript
// src/components/StatsCard.tsx (Client Component)
'use client';

import { useState } from 'react';
import { Card } from 'antd';

export default function StatsCard({ stats }: { stats: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card onClick={() => setExpanded(!expanded)}>
      {/* Interactive content */}
    </Card>
  );
}
```

**Benefits:**
- ✅ Server-side data fetching (faster, direct DB access)
- ✅ Client-side interactivity (where needed)
- ✅ Smaller client bundles (only interactive parts)

---

## Best Practices

### 1. Hook Dependencies

**Always include dependencies:**
```typescript
// ❌ WRONG: Missing dependency
useEffect(() => {
  console.log(user.name);
}, []);

// ✅ CORRECT: Include dependency
useEffect(() => {
  console.log(user.name);
}, [user.name]);

// ✅ CORRECT: Stable reference with useCallback
const loadData = useCallback(() => {
  // Load data
}, []);

useEffect(() => {
  loadData();
}, [loadData]);
```

### 2. Avoid Inline Functions

```typescript
// ❌ WRONG: Inline function (creates new function on every render)
<Button onClick={() => handleClick(id)}>Click</Button>

// ✅ CORRECT: Use useCallback
const handleButtonClick = useCallback(() => {
  handleClick(id);
}, [id]);

<Button onClick={handleButtonClick}>Click</Button>
```

### 3. Cleanup useEffect

```typescript
// ✅ CORRECT: Cleanup subscriptions
useEffect(() => {
  const interval = setInterval(() => {
    fetchUpdates();
  }, 5000);

  return () => {
    clearInterval(interval); // Cleanup on unmount
  };
}, []);
```

### 4. Type Safety

```typescript
// ✅ CORRECT: Explicit types
const [user, setUser] = useState<User | null>(null);
const [products, setProducts] = useState<Product[]>([]);

// ✅ CORRECT: Type guards
if (user !== null) {
  console.log(user.name); // TypeScript knows user is not null
}
```

### 5. Performance Optimization

```typescript
// ✅ Use React.memo for expensive child components
const ProductCard = React.memo(({ product }: { product: Product }) => {
  return <div>{product.name}</div>;
});

// ✅ Use useMemo for expensive calculations
const sortedProducts = useMemo(() => {
  return products.sort((a, b) => a.name.localeCompare(b.name));
}, [products]);

// ✅ Use useCallback for event handlers passed to children
const handleSave = useCallback(() => {
  saveData();
}, []);
```

---

## Common Patterns from Project

### Form Handling with Ant Design

```typescript
const [form] = Form.useForm<CalculationVariables>();

// Get values
const values = form.getFieldsValue();

// Set values
form.setFieldsValue({ field_name: value });

// Validate and submit
const handleSubmit = async () => {
  try {
    const values = await form.validateFields();
    await apiCall(values);
    form.resetFields();
    message.success('Успешно');
  } catch (error) {
    message.error('Ошибка валидации');
  }
};
```

### ag-Grid Integration

```typescript
const gridRef = useRef<any>(null);
const [rowData, setRowData] = useState<Product[]>([]);

const columnDefs = useMemo<ColDef[]>(() => [
  { field: 'name', headerName: 'Название', editable: true },
  { field: 'quantity', headerName: 'Кол-во', editable: true }
], []);

const onCellValueChanged = useCallback((params: any) => {
  const updated = [...rowData];
  updated[params.node.rowIndex] = params.data;
  setRowData(updated);
}, [rowData]);

<div className="ag-theme-alpine" style={{ height: 600 }}>
  <AgGridReact
    ref={gridRef}
    rowData={rowData}
    columnDefs={columnDefs}
    onCellValueChanged={onCellValueChanged}
  />
</div>
```

### API Calls with Loading States

```typescript
const [loading, setLoading] = useState(false);
const { message } = App.useApp();

const loadData = async () => {
  setLoading(true);
  try {
    const data = await apiService.fetchData();
    setData(data);
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Ошибка загрузки');
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  loadData();
}, []);
```

---

## Summary

**Key Takeaways:**
1. ✅ Always use `'use client'` for interactive components and Ant Design
2. ✅ Follow consistent component structure (hooks → effects → handlers → render)
3. ✅ Use appropriate hooks (useState, useEffect, useMemo, useCallback)
4. ✅ Handle errors with try/catch and user-friendly messages
5. ✅ Prefer Server Components for static content, Client Components for interactivity
6. ✅ Optimize performance with memoization and cleanup
7. ✅ Type safety with TypeScript for all state and props
8. ✅ No inline functions in JSX (define handlers separately)
9. ✅ Always include dependencies in useEffect/useCallback
10. ✅ Cleanup subscriptions and timers in useEffect return function
