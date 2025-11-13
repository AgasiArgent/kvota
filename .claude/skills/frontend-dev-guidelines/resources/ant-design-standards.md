# Ant Design v5 Standards & Best Practices

**Created:** 2025-10-29 21:15 UTC
**Purpose:** Comprehensive Ant Design v5 patterns, migration guide, and common gotchas
**Tech Stack:** Ant Design 5.27.4 + React 19 + Next.js 15
**Source:** Real production code from quotation-app frontend

---

## Table of Contents

1. [Form Patterns](#1-form-patterns)
2. [Ant Design v5 Migration Guide](#2-ant-design-v5-migration-guide)
3. [Common Components Reference](#3-common-components-reference)
4. [Theming & Configuration](#4-theming--configuration)
5. [When to Use Ant Design vs ag-Grid](#5-when-to-use-ant-design-vs-ag-grid)
6. [Russian Localization](#6-russian-localization)

---

## 1. Form Patterns

### 1.1 Basic Form Setup

```typescript
'use client';

import { Form, Input, Select, Button, message } from 'antd';
import { useState } from 'react';

const [form] = Form.useForm();
const [loading, setLoading] = useState(false);

// Get form values
const values = form.getFieldsValue();

// Set form values
form.setFieldsValue({ field_name: value });

// Reset form
form.resetFields();

// Validate all fields
try {
  await form.validateFields();
} catch (error) {
  message.error('Пожалуйста, заполните все обязательные поля');
}
```

### 1.2 Required Field Validation

**Pattern from production code:**

```typescript
<Form.Item
  name="customer_id"
  label="Клиент"
  rules={[{ required: true, message: 'Пожалуйста, выберите клиента' }]}
>
  <Select placeholder="Выберите клиента" />
</Form.Item>
```

**Key points:**
- ✅ Always include `rules` prop for required fields
- ✅ Use Russian error messages: "Пожалуйста, выберите/укажите/заполните..."
- ✅ Validation shows red border around field + error text below
- ✅ Submit button should validate all fields before submission

**Validation feedback visual:**
- Red border on invalid field
- Red error message text below field
- Form submission blocked until all required fields valid

### 1.3 Validation Rules Examples

```typescript
// Required field
rules={[{ required: true, message: 'Выберите клиента' }]}

// Required with custom validator
rules={[
  { required: true, message: 'Укажите цену' },
  {
    validator: (_, value) => {
      if (value && value > 0) return Promise.resolve();
      return Promise.reject(new Error('Цена должна быть больше 0'));
    }
  }
]}

// Email validation
rules={[
  { required: true, message: 'Введите email' },
  { type: 'email', message: 'Некорректный email' }
]}

// Pattern validation (INN)
rules={[
  { pattern: /^\d{10}$/, message: 'ИНН должен содержать 10 цифр' }
]}
```

### 1.4 Form Submission Pattern

**Production pattern from quote creation page:**

```typescript
const handleSubmit = async () => {
  // Step 1: Validate form fields
  try {
    await form.validateFields();
  } catch (error) {
    message.error('Пожалуйста, заполните все обязательные поля');
    // Scroll to first error
    const errorField = document.querySelector('.ant-form-item-has-error');
    if (errorField) {
      errorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  // Step 2: Custom validation (not in form)
  if (!selectedCustomer) {
    message.error('Выберите клиента');
    return;
  }

  // Step 3: Submit to API
  setLoading(true);
  try {
    const formValues = form.getFieldsValue();
    const result = await apiService.create(formValues);

    if (result.success) {
      message.success('Успешно сохранено');
      router.push(`/quotes/${result.data.id}`);
    } else {
      // Handle validation errors from backend
      const errorText = result.error || 'Неизвестная ошибка';
      if (errorText.includes('\n') || errorText.length > 100) {
        // Show long errors in modal
        Modal.error({
          title: 'Ошибка сохранения',
          content: (
            <div>
              {errorText.split('\n').map((line, idx) => (
                <div key={idx}>• {line}</div>
              ))}
            </div>
          )
        });
      } else {
        message.error(errorText);
      }
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Ошибка');
  } finally {
    setLoading(false);
  }
};
```

### 1.5 Initial Values

```typescript
// Set initial values on mount
useEffect(() => {
  form.setFieldsValue({
    quote_date: dayjs(),
    valid_until: dayjs().add(30, 'day'),
    currency: 'USD'
  });
}, []);

// Or use initialValues prop
<Form
  form={form}
  initialValues={{
    quote_date: dayjs(),
    currency: 'USD'
  }}
>
```

**⚠️ Warning:** Do NOT use `setFieldsValue` inside render function. Use `useEffect` or `initialValues` prop.

### 1.6 Form Layout

```typescript
// Vertical layout (labels above fields) - DEFAULT
<Form layout="vertical">
  <Form.Item label="Название" name="name">
    <Input />
  </Form.Item>
</Form>

// Horizontal layout (labels beside fields)
<Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
  <Form.Item label="Название" name="name">
    <Input />
  </Form.Item>
</Form>

// Inline layout (fields in one row)
<Form layout="inline">
  <Form.Item label="Название" name="name">
    <Input />
  </Form.Item>
  <Form.Item label="Email" name="email">
    <Input />
  </Form.Item>
</Form>
```

### 1.7 Compact Form Styling

**Production pattern:**

```typescript
// Compact form CSS
const compactFormStyles = `
  .compact-form .ant-form-item {
    margin-bottom: 12px;
  }
  .compact-form .ant-form-item-label > label {
    font-size: 12px;
    height: auto;
  }
`;

<style dangerouslySetInnerHTML={{ __html: compactFormStyles }} />

<Form form={form} className="compact-form" layout="vertical">
  <Form.Item label="Компания-продавец" name="seller_company">
    <Select size="small" />
  </Form.Item>
</Form>
```

---

## 2. Ant Design v5 Migration Guide

### 2.1 Critical Deprecated APIs (MUST FIX)

These deprecated APIs cause UI bugs and must be migrated:

#### ❌ Dropdown `overlay` → ✅ `menu`

**Old (Deprecated):**
```typescript
const menu = (
  <Menu>
    <Menu.Item key="1">Редактировать</Menu.Item>
    <Menu.Item key="2">Удалить</Menu.Item>
  </Menu>
);

<Dropdown overlay={menu}>
  <Button>Действия</Button>
</Dropdown>
```

**New (v5):**
```typescript
const menuItems = [
  { key: '1', label: 'Редактировать' },
  { key: '2', label: 'Удалить' }
];

<Dropdown menu={{ items: menuItems }}>
  <Button>Действия</Button>
</Dropdown>
```

**Why it matters:** ⚠️ **BLOCKS EXPORT UI** - Dropdown doesn't work properly with deprecated `overlay` prop.

**Location in codebase:** `frontend/src/app/quotes/[id]/page.tsx:414` (BUG-040)

---

#### ❌ Button `type="ghost"` → ✅ `type="default" variant="outlined"`

**Old:**
```typescript
<Button type="ghost">Отменить</Button>
```

**New:**
```typescript
<Button type="default" variant="outlined">Отменить</Button>
```

---

#### ❌ Card `bordered` → ✅ `variant="outlined"`

**Old:**
```typescript
<Card bordered={true}>Content</Card>
```

**New:**
```typescript
<Card variant="outlined">Content</Card>
```

---

#### ❌ Select `dropdownMatchSelectWidth` → ✅ `popupMatchSelectWidth`

**Old:**
```typescript
<Select dropdownMatchSelectWidth={false} />
```

**New:**
```typescript
<Select popupMatchSelectWidth={false} />
```

---

### 2.2 Menu API Migration

**Old (Menu children):**
```typescript
<Menu>
  <Menu.Item key="1">
    <EditOutlined />
    Редактировать
  </Menu.Item>
  <Menu.Item key="2" danger>
    <DeleteOutlined />
    Удалить
  </Menu.Item>
</Menu>
```

**New (items array):**
```typescript
const items = [
  {
    key: '1',
    icon: <EditOutlined />,
    label: 'Редактировать'
  },
  {
    key: '2',
    icon: <DeleteOutlined />,
    label: 'Удалить',
    danger: true
  }
];

<Menu items={items} />
```

**Location in codebase:** `frontend/src/app/quotes/[id]/page.tsx:230-259`

---

### 2.3 Static Message API → App Context

**Old (Static import - still works but deprecated):**
```typescript
import { message } from 'antd';

message.success('Успешно сохранено');
message.error('Ошибка');
```

**New (App component context - recommended):**
```typescript
import { App } from 'antd';

function MyComponent() {
  const { message } = App.useApp();

  const handleSubmit = () => {
    message.success('Успешно сохранено');
  };
}

// Wrap app in App component (in layout.tsx)
export default function RootLayout({ children }) {
  return (
    <ConfigProvider>
      <App>
        {children}
      </App>
    </ConfigProvider>
  );
}
```

**Note:** Static API still works in v5 but will be removed in v6. Migration recommended but not urgent.

---

### 2.4 Migration Priority

**Priority 1 (URGENT - Blocks UI):**
- ⚠️ Dropdown `overlay` → `menu` (BUG-040 - blocks export dropdown)

**Priority 2 (HIGH - Console warnings):**
- Card `bordered` → `variant`
- Menu children → items array
- Button `type="ghost"` → `type="default" variant="outlined"`

**Priority 3 (LOW - Future compatibility):**
- Static message → App context
- Select `dropdownMatchSelectWidth` → `popupMatchSelectWidth`

**Total effort:** 2-3 hours for all deprecated APIs

**See:** MASTER_BUG_INVENTORY.md BUG-034, BUG-040 for tracked issues

---

### 2.5 React 19 Compatibility Warning

**Current setup:**
- React: 19.1.0
- Ant Design: 5.27.4 (officially supports React 16-18)

**Warning shown:**
```
Warning: [antd: compatible] antd v5 support React is 16 ~ 18.
see https://u.ant.design/v5-for-19 for compatible.
```

**Impact:**
- ✅ Application works fine in practice
- ⚠️ Not officially supported by Ant Design
- ⚠️ May have edge case bugs
- ⚠️ Future Ant Design updates might break compatibility

**Options:**
1. **Downgrade to React 18** (safer, stable)
2. **Wait for Ant Design React 19 support** (keep warnings)
3. **Continue with warnings** (current approach - works but unsupported)

**Decision needed:** Team discussion required

**See:** MASTER_BUG_INVENTORY.md BUG-043, TECHNICAL_DEBT.md:1918-1941

---

## 3. Common Components Reference

### 3.1 Form Components

#### Select (Dropdowns)

```typescript
// Basic select
<Form.Item label="Валюта" name="currency">
  <Select placeholder="Выберите валюту">
    <Select.Option value="USD">USD</Select.Option>
    <Select.Option value="EUR">EUR</Select.Option>
    <Select.Option value="RUB">RUB</Select.Option>
  </Select>
</Form.Item>

// With search
<Form.Item label="Клиент" name="customer_id">
  <Select
    showSearch
    placeholder="Выберите клиента"
    optionFilterProp="children"
    filterOption={(input, option) =>
      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
    }
    options={customers.map(c => ({
      label: `${c.name} (${c.inn})`,
      value: c.id
    }))}
  />
</Form.Item>

// With allowClear
<Select allowClear placeholder="Выберите..." />

// With loading state
<Select loading={loadingCustomers} placeholder="Загрузка..." />

// Small size (compact UI)
<Select size="small" />
```

#### Input & InputNumber

```typescript
// Text input
<Form.Item label="Название" name="name">
  <Input placeholder="Введите название" />
</Form.Item>

// Number input
<Form.Item label="Количество" name="quantity">
  <InputNumber
    min={0}
    max={999999}
    step={1}
    placeholder="0"
    style={{ width: '100%' }}
  />
</Form.Item>

// Number with addon
<InputNumber
  addonAfter="кг"
  min={0}
  placeholder="0"
/>

// Text area
<Input.TextArea
  rows={4}
  placeholder="Введите комментарий"
/>
```

#### DatePicker

```typescript
import dayjs from 'dayjs';

<Form.Item label="Дата КП" name="quote_date">
  <DatePicker
    format="YYYY-MM-DD"
    placeholder="Выберите дату"
    style={{ width: '100%' }}
  />
</Form.Item>

// Russian locale (set in layout.tsx)
import ruRU from 'antd/lib/locale/ru_RU';
<ConfigProvider locale={ruRU}>
```

#### Upload

```typescript
import { Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

const { Dragger } = Upload;

<Dragger
  accept=".xlsx,.csv"
  maxCount={1}
  showUploadList={{
    showRemoveIcon: true,
    removeIcon: <CloseCircleOutlined />
  }}
  customRequest={async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      onSuccess?.(data);
    } catch (error) {
      onError?.(error as Error);
    }
  }}
  onChange={(info) => {
    if (info.file.status === 'done') {
      message.success('Файл загружен');
    } else if (info.file.status === 'error') {
      message.error('Ошибка загрузки');
    }
  }}
>
  <p className="ant-upload-drag-icon">
    <InboxOutlined />
  </p>
  <p className="ant-upload-text">Перетащите файл или нажмите для выбора</p>
  <p className="ant-upload-hint">Поддерживаются форматы: XLSX, CSV</p>
</Dragger>
```

---

### 3.2 Layout Components

#### Card

```typescript
// Basic card
<Card title="Настройки компании">
  <p>Контент карточки</p>
</Card>

// Small size (compact UI)
<Card
  title="🏢 Настройки компании"
  size="small"
  style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
  styles={{ body: { padding: '12px' } }}
>
  Content
</Card>

// With actions
<Card
  title="Котировка №123"
  extra={
    <Space>
      <Button type="primary">Редактировать</Button>
      <Button>Экспорт</Button>
    </Space>
  }
>
  Content
</Card>
```

#### Row & Col (Grid)

```typescript
import { Row, Col } from 'antd';

// Basic grid
<Row gutter={[16, 16]}>
  <Col xs={24} lg={12}>
    <Card>Left card</Card>
  </Col>
  <Col xs={24} lg={12}>
    <Card>Right card</Card>
  </Col>
</Row>

// Compact grid (production pattern)
<Row gutter={[12, 8]}>
  <Col span={12}>
    <Form.Item label="Поле 1" name="field1">
      <Input />
    </Form.Item>
  </Col>
  <Col span={12}>
    <Form.Item label="Поле 2" name="field2">
      <Input />
    </Form.Item>
  </Col>
</Row>

// Responsive breakpoints
<Col xs={24} sm={12} md={8} lg={6} xl={4}>
  // xs: mobile (<576px) - full width
  // sm: tablet (≥576px) - half width
  // md: small desktop (≥768px) - 1/3 width
  // lg: desktop (≥992px) - 1/4 width
  // xl: large desktop (≥1200px) - 1/6 width
</Col>
```

---

### 3.3 Feedback Components

#### Message (Toasts)

```typescript
import { message } from 'antd';

// Success
message.success('Успешно сохранено');

// Error
message.error('Ошибка при сохранении');

// Warning
message.warning('Внимание: изменения не сохранены');

// Info
message.info('Данные загружаются...');

// Loading (with promise)
const hide = message.loading('Сохранение...', 0);
await apiCall();
hide();
message.success('Сохранено');

// With duration
message.success('Сохранено', 3); // 3 seconds
```

#### Modal

```typescript
import { Modal } from 'antd';

// Confirmation dialog
Modal.confirm({
  title: 'Удалить котировку?',
  content: 'Это действие нельзя отменить',
  okText: 'Удалить',
  cancelText: 'Отмена',
  okType: 'danger',
  onOk: async () => {
    await deleteQuote(id);
    message.success('Котировка удалена');
  }
});

// Success modal
Modal.success({
  title: 'Котировка создана',
  content: 'КП №123 успешно создано'
});

// Error modal (for long error messages)
Modal.error({
  title: 'Ошибка расчета',
  content: (
    <div>
      {errors.map((error, idx) => (
        <div key={idx}>• {error}</div>
      ))}
    </div>
  )
});

// Form modal
const [modalOpen, setModalOpen] = useState(false);

<Modal
  title="Редактировать клиента"
  open={modalOpen}
  onOk={handleSubmit}
  onCancel={() => setModalOpen(false)}
  okText="Сохранить"
  cancelText="Отмена"
>
  <Form form={form}>
    <Form.Item label="Название" name="name">
      <Input />
    </Form.Item>
  </Form>
</Modal>
```

#### Alert

```typescript
import { Alert } from 'antd';

// Warning alert (production pattern)
{!selectedCustomer || uploadedProducts.length === 0 && (
  <Alert
    message="⚠️ Внимание"
    description="Выберите клиента и загрузите файл с продуктами"
    type="warning"
    showIcon
    closable
    style={{ marginBottom: 16 }}
  />
)}

// Success
<Alert message="Успешно сохранено" type="success" />

// Error
<Alert message="Ошибка загрузки" type="error" showIcon />

// Info
<Alert
  message="Информация"
  description="Данные загружаются, подождите..."
  type="info"
/>
```

#### Spin (Loading)

```typescript
import { Spin } from 'antd';

// Basic spinner
<Spin />

// With text
<Spin tip="Загрузка данных..." />

// Large size
<Spin size="large" tip="Загрузка..." />

// Wrap content
<Spin spinning={loading}>
  <Card>Content that shows when loading=false</Card>
</Spin>
```

---

### 3.4 Data Display Components

#### Table (Ant Design)

**⚠️ Use ag-Grid for complex tables (10+ columns, editable cells, Excel-like features)**

```typescript
import { Table } from 'antd';

// Basic table
const columns = [
  { title: 'Название', dataIndex: 'name', key: 'name' },
  { title: 'Цена', dataIndex: 'price', key: 'price' },
  {
    title: 'Действия',
    key: 'actions',
    render: (_, record) => (
      <Space>
        <Button size="small" onClick={() => edit(record)}>
          Редактировать
        </Button>
        <Button size="small" danger onClick={() => delete(record.id)}>
          Удалить
        </Button>
      </Space>
    )
  }
];

<Table
  dataSource={data}
  columns={columns}
  rowKey="id"
  loading={loading}
  pagination={{ pageSize: 10 }}
/>
```

**When to use Ant Design Table vs ag-Grid:**
- ✅ Ant Design Table: Simple lists (3-5 columns), read-only data, basic sorting/filtering
- ✅ ag-Grid: Excel-like editing, 10+ columns, complex calculations, pinned columns, column groups

---

### 3.5 Navigation Components

#### Dropdown

**⚠️ Use new `menu` API, not deprecated `overlay`**

```typescript
import { Dropdown, Button } from 'antd';
import { DownOutlined } from '@ant-design/icons';

const menuItems = [
  {
    key: '1',
    label: 'Экспорт PDF'
  },
  {
    key: '2',
    label: 'Экспорт Excel'
  },
  {
    type: 'divider'
  },
  {
    key: '3',
    label: 'Удалить',
    danger: true
  }
];

<Dropdown
  menu={{
    items: menuItems,
    onClick: ({ key }) => {
      if (key === '1') exportPDF();
      if (key === '2') exportExcel();
      if (key === '3') deleteQuote();
    }
  }}
>
  <Button>
    Действия <DownOutlined />
  </Button>
</Dropdown>
```

---

## 4. Theming & Configuration

### 4.1 Global Theme Configuration

**Location:** `frontend/src/app/layout.tsx`

```typescript
import { ConfigProvider } from 'antd';
import ruRU from 'antd/lib/locale/ru_RU';

// Russian B2B theme configuration
const antdTheme = {
  token: {
    colorPrimary: '#1890ff',      // Primary blue
    colorSuccess: '#52c41a',      // Success green
    colorWarning: '#faad14',      // Warning orange
    colorError: '#ff4d4f',        // Error red
    colorInfo: '#1890ff',         // Info blue
    borderRadius: 6,              // Rounded corners
    wireframe: false,             // Modern style
    fontSize: 14,                 // Base font size
    fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  components: {
    Button: {
      borderRadius: 6,
      controlHeight: 36
    },
    Input: {
      borderRadius: 6,
      controlHeight: 36
    },
    Select: {
      borderRadius: 6,
      controlHeight: 36
    },
    Card: {
      borderRadius: 8,
      paddingLG: 24
    },
    Table: {
      borderRadius: 8,
      headerBg: '#fafafa'
    }
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <AntdRegistry>
          <ConfigProvider locale={ruRU} theme={antdTheme}>
            <App>
              <AuthProvider>{children}</AuthProvider>
            </App>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
```

### 4.2 Component-Level Customization

```typescript
// Override component styles
<Card
  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
  styles={{ body: { padding: '12px' } }}
>
  Content
</Card>

// CSS-in-JS for custom styling
const compactFormStyles = `
  .compact-form .ant-form-item {
    margin-bottom: 12px;
  }
  .compact-form .ant-form-item-label > label {
    font-size: 12px;
  }
`;

<style dangerouslySetInnerHTML={{ __html: compactFormStyles }} />
```

### 4.3 Color Scheme Standards

**Production color usage:**

```typescript
// Gray - Empty/Default values
backgroundColor: '#f5f5f5'

// Blue - User-filled/Override values
backgroundColor: '#e6f7ff'

// Red - Admin-only/Critical values
backgroundColor: '#fff1f0'

// Yellow - Warning states
backgroundColor: '#fffbe6'
```

**Example from quote creation (two-tier variables):**
- Gray background = Using quote-level default
- Blue background = Product-level override

---

## 5. When to Use Ant Design vs ag-Grid

### 5.1 Decision Matrix

| Feature | Ant Design Table | ag-Grid |
|---------|------------------|---------|
| **Simple lists (≤5 columns)** | ✅ Recommended | ❌ Overkill |
| **Read-only data** | ✅ Perfect | ⚠️ Works but unnecessary |
| **Basic sorting/filtering** | ✅ Built-in | ✅ Built-in |
| **Editable cells** | ⚠️ Manual work | ✅ Native support |
| **Excel-like editing** | ❌ Not suitable | ✅ Built for this |
| **10+ columns** | ⚠️ Gets cluttered | ✅ Designed for this |
| **Column groups** | ❌ Not supported | ✅ Built-in |
| **Pinned columns** | ❌ Not supported | ✅ Built-in |
| **Cell renderers** | ✅ Via render prop | ✅ Built-in system |
| **Performance (1000+ rows)** | ⚠️ Slow | ✅ Virtualized |
| **Learning curve** | ✅ Easy | ⚠️ Moderate |

### 5.2 Real-World Examples from Project

**✅ Use Ant Design Table:**
- Customer list page (5 columns: name, INN, email, phone, actions)
- Quote list page (6 columns: number, customer, date, status, total, actions)
- Activity log page (5 columns: user, action, entity, timestamp, details)

**✅ Use ag-Grid:**
- Quote creation product table (15+ columns, editable, calculations)
- Quote edit page (same as above)
- Any table with complex formulas or Excel-like behavior

---

## 6. Russian Localization

### 6.1 Global Locale

**Set in layout.tsx:**

```typescript
import ruRU from 'antd/lib/locale/ru_RU';

<ConfigProvider locale={ruRU}>
  {children}
</ConfigProvider>
```

### 6.2 Common Russian Translations

**Form labels:**
- Название - Name
- Количество - Quantity
- Цена - Price
- Валюта - Currency
- Клиент - Customer/Client
- Дата - Date
- Статус - Status
- Комментарий - Comment

**Buttons:**
- Сохранить - Save
- Отменить - Cancel
- Удалить - Delete
- Создать - Create
- Редактировать - Edit
- Экспорт - Export
- Загрузить - Upload/Load
- Скачать - Download
- Применить - Apply
- Закрыть - Close

**Messages:**
- Успешно сохранено - Successfully saved
- Ошибка при сохранении - Error saving
- Пожалуйста, заполните все обязательные поля - Please fill all required fields
- Вы уверены? - Are you sure?
- Данные загружаются... - Data loading...

**Validation messages:**
- Пожалуйста, выберите... - Please select...
- Пожалуйста, укажите... - Please specify...
- Пожалуйста, заполните... - Please fill...
- Некорректный формат - Invalid format
- Поле обязательно для заполнения - Field is required

### 6.3 Consistency Check

**Before committing:**
- ✅ All user-facing text in Russian
- ✅ No mixed English/Russian
- ✅ Error messages in Russian
- ✅ Placeholder text in Russian
- ✅ Button labels in Russian

**Exceptions (OK to keep English):**
- Code comments
- Console logs
- Technical error messages in console
- Variable names

---

## Quick Reference Links

**Documentation:**
- Ant Design v5 Official Docs: https://ant.design/components/overview/
- Migration Guide v4 → v5: https://ant.design/docs/react/migration-v5
- React 19 Compatibility: https://u.ant.design/v5-for-19

**Bug Tracking:**
- BUG-034: Deprecated APIs (general) - MASTER_BUG_INVENTORY.md
- BUG-040: Export dropdown bug - MASTER_BUG_INVENTORY.md:829-870
- BUG-043: React 19 warning - MASTER_BUG_INVENTORY.md:872-914
- COMMON_GOTCHAS.md #5: No form validation feedback
- COMMON_GOTCHAS.md #6: Ant Design deprecated APIs

**Code Examples:**
- Form patterns: `frontend/src/app/quotes/create/page.tsx:500-650`
- Validation: `frontend/src/app/quotes/create/page.tsx:1040-1200`
- Layout: `frontend/src/app/layout.tsx:25-61` (theming)
- Upload: `frontend/src/app/quotes/create/page.tsx:368-378`

---

**Last Updated:** 2025-10-29 21:15 UTC
**Total Sections:** 6
**Total Examples:** 30+
**Maintenance:** Update when discovering new patterns or critical migrations
