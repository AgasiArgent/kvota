# Frontend Workflow Patterns

Complete workflows for common frontend development tasks in the B2B quotation platform.

**Last Updated:** 2025-10-30 (Expert agent)

---

## 1. Making API Changes Workflow

When backend API changes, follow this workflow to update frontend:

### Step-by-Step Process

```bash
# 1. Understand the API change
cd /home/novi/quotation-app-dev
grep -r "endpoint_name" backend/routes/  # Find backend implementation
```

```typescript
// 2. Update TypeScript interfaces (frontend/src/types/*.ts)
export interface UpdatedResponse {
  newField: string;  // Add new fields
  // removedField: string;  // Comment out removed fields first
}
```

```typescript
// 3. Update API service (frontend/src/lib/api/*-service.ts)
export async function updateApiCall(data: UpdatedRequest): Promise<UpdatedResponse> {
  const response = await fetchWithAuth('/api/endpoint', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
```

```typescript
// 4. Update component that uses the API
const MyComponent = () => {
  const [data, setData] = useState<UpdatedResponse | null>(null);

  const handleSubmit = async (formData: UpdatedRequest) => {
    try {
      const result = await updateApiCall(formData);
      setData(result);
      message.success('Updated successfully');
    } catch (error) {
      console.error('API call failed:', error);
      message.error('Update failed');
    }
  };
};
```

```bash
# 5. Test the integration
# Terminal 1: Run backend
cd backend && uvicorn main:app --reload

# Terminal 2: Run frontend
cd frontend && npm run dev

# Terminal 3: Test with Chrome DevTools MCP
./.claude/scripts/testing/launch-chrome-testing.sh headless http://localhost:3001/your-page
```

### Common Gotchas

- ❌ **Don't forget to update TypeScript types** - Will cause build errors
- ❌ **Don't assume API is always successful** - Always handle errors
- ✅ **Do test with real API calls** - Mock testing isn't enough
- ✅ **Do check network tab** - Verify request/response payloads

---

## 2. Making UI Changes Workflow

### Component Update Process

```typescript
// 1. Read existing component first
// frontend/src/app/your-feature/page.tsx
```

```typescript
// 2. Plan the change
// - What props need updating?
// - What state is affected?
// - What child components are impacted?
```

```typescript
// 3. Update component with Ant Design patterns
import { Card, Button, Form, Input, Space } from 'antd';

const UpdatedComponent = () => {
  // Use Ant Design form for complex forms
  const [form] = Form.useForm();

  return (
    <Card title="Feature Title">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="fieldName"
          label="Field Label"
          rules={[{ required: true, message: 'Required field' }]}
        >
          <Input placeholder="Enter value" />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              Submit
            </Button>
            <Button onClick={() => form.resetFields()}>
              Reset
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};
```

```css
/* 4. Add responsive styles if needed */
/* frontend/src/app/globals.css or component.module.css */
@media (max-width: 768px) {
  .card-container {
    padding: 12px;
  }
}
```

```bash
# 5. Test responsiveness
# Use Chrome DevTools to test mobile/tablet views
# Check with Chrome DevTools MCP
```

### UI Change Checklist

- [ ] Component follows Ant Design patterns
- [ ] Responsive on mobile (375px), tablet (768px), desktop (1200px+)
- [ ] Keyboard navigation works
- [ ] Loading states implemented
- [ ] Error states handled
- [ ] Success feedback provided
- [ ] Accessibility: ARIA labels, focus management
- [ ] Dark mode compatible (if implemented)

---

## 3. Adding New Page Workflow

### Complete Page Creation Process

```bash
# 1. Create the route structure
mkdir -p frontend/src/app/new-feature
```

```typescript
// 2. Create page.tsx
// frontend/src/app/new-feature/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, Spin, Alert } from 'antd';
import { PageHeader } from '@/components/PageHeader';

export default function NewFeaturePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // API call here
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spin size="large" />;
  if (error) return <Alert message={error} type="error" />;

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title="New Feature"
        onBack={() => window.history.back()}
      />

      <Card className="mt-6">
        {/* Page content */}
      </Card>
    </div>
  );
}
```

```typescript
// 3. Add to navigation (if needed)
// frontend/src/components/Navigation.tsx or similar
const menuItems = [
  // ... existing items
  {
    key: 'new-feature',
    icon: <IconComponent />,
    label: 'New Feature',
    path: '/new-feature',
  },
];
```

```typescript
// 4. Add route protection if needed
// frontend/src/app/new-feature/layout.tsx
import { AuthGuard } from '@/components/AuthGuard';

export default function Layout({ children }) {
  return <AuthGuard requiredRole="admin">{children}</AuthGuard>;
}
```

```typescript
// 5. Create API service if needed
// frontend/src/lib/api/new-feature-service.ts
export async function getNewFeatureData() {
  return fetchWithAuth('/api/new-feature');
}
```

```bash
# 6. Test the new page
npm run dev
# Navigate to http://localhost:3001/new-feature
# Test with Chrome DevTools MCP for automated verification
```

---

## 4. Form Submission Workflow

### Complete Form Implementation

```typescript
// 1. Define form interface
interface FormData {
  name: string;
  email: string;
  amount: number;
  description?: string;
}
```

```typescript
// 2. Create form component with validation
import { Form, Input, InputNumber, Button, message } from 'antd';

const MyForm = () => {
  const [form] = Form.useForm<FormData>();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: FormData) => {
    try {
      setSubmitting(true);

      // Client-side validation passed (Ant Design handles this)

      // API call
      const response = await submitFormData(values);

      // Success handling
      message.success('Form submitted successfully!');
      form.resetFields();

      // Optional: Navigate or update parent
      router.push('/success-page');

    } catch (error) {
      // Error handling
      console.error('Submission error:', error);

      if (error.response?.data?.errors) {
        // Field-specific errors from backend
        const errors = error.response.data.errors;
        form.setFields(
          Object.entries(errors).map(([name, error]) => ({
            name,
            errors: [error as string],
          }))
        );
      } else {
        // General error
        message.error(error.message || 'Submission failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      autoComplete="off"
    >
      <Form.Item
        name="name"
        label="Name"
        rules={[
          { required: true, message: 'Please enter name' },
          { min: 2, message: 'Name too short' },
          { max: 100, message: 'Name too long' },
        ]}
      >
        <Input placeholder="Enter name" />
      </Form.Item>

      <Form.Item
        name="email"
        label="Email"
        rules={[
          { required: true, message: 'Please enter email' },
          { type: 'email', message: 'Invalid email format' },
        ]}
      >
        <Input type="email" placeholder="Enter email" />
      </Form.Item>

      <Form.Item
        name="amount"
        label="Amount"
        rules={[
          { required: true, message: 'Please enter amount' },
          { type: 'number', min: 0, message: 'Amount must be positive' },
        ]}
      >
        <InputNumber
          style={{ width: '100%' }}
          formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
        />
      </Form.Item>

      <Form.Item
        name="description"
        label="Description"
      >
        <Input.TextArea rows={4} placeholder="Optional description" />
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={submitting}
          block
        >
          Submit Form
        </Button>
      </Form.Item>
    </Form>
  );
};
```

### Form Validation Patterns

```typescript
// Custom validators
const validatePhone = (_, value) => {
  const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
  if (!value || phoneRegex.test(value)) {
    return Promise.resolve();
  }
  return Promise.reject(new Error('Invalid phone number'));
};

// Async validation (check uniqueness)
const validateUniqueEmail = async (_, value) => {
  if (!value) return Promise.resolve();

  try {
    const exists = await checkEmailExists(value);
    if (exists) {
      return Promise.reject(new Error('Email already registered'));
    }
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(new Error('Could not validate email'));
  }
};

// Use in form
<Form.Item
  name="phone"
  rules={[{ validator: validatePhone }]}
>
  <Input />
</Form.Item>

<Form.Item
  name="email"
  rules={[{ validator: validateUniqueEmail }]}
>
  <Input />
</Form.Item>
```

---

## 5. Integration Testing Workflow

### Chrome DevTools MCP Testing

```bash
# 1. Launch Chrome in test mode
./.claude/scripts/testing/launch-chrome-testing.sh headless http://localhost:3001/your-feature
```

```typescript
// 2. Test user flows with Chrome DevTools MCP
// Example: Test quote creation flow

// Take initial snapshot
mcp__chrome-devtools__take_snapshot();

// Fill form
mcp__chrome-devtools__fill({ uid: 'input-customer', value: 'Test Company' });
mcp__chrome-devtools__fill({ uid: 'input-amount', value: '10000' });

// Select from dropdown
mcp__chrome-devtools__click({ uid: 'select-currency' });
mcp__chrome-devtools__click({ uid: 'option-usd' });

// Upload file
mcp__chrome-devtools__upload_file({
  uid: 'file-upload',
  filePath: '/home/novi/test-files/products.xlsx'
});

// Submit form
mcp__chrome-devtools__click({ uid: 'submit-button' });

// Wait for success
mcp__chrome-devtools__wait_for({ text: 'Quote created successfully' });

// Verify navigation
const result = mcp__chrome-devtools__evaluate_script({
  function: () => window.location.pathname
});
// Should be on success page
```

### Testing Checklist

```markdown
## Pre-Test Setup
- [ ] Backend running (`uvicorn main:app --reload`)
- [ ] Frontend running (`npm run dev`)
- [ ] Test data prepared
- [ ] Chrome launched with remote debugging

## Happy Path Testing
- [ ] Form submission succeeds
- [ ] Data displays correctly
- [ ] Navigation works
- [ ] Success messages shown

## Error Testing
- [ ] Invalid input shows validation
- [ ] Network error handled gracefully
- [ ] Auth expiry redirects to login
- [ ] File upload size limits enforced

## Edge Cases
- [ ] Empty state displays correctly
- [ ] Large datasets paginate/virtualize
- [ ] Concurrent updates handled
- [ ] Browser back button works

## Performance
- [ ] Page loads < 3 seconds
- [ ] No console errors
- [ ] No memory leaks
- [ ] API calls debounced where needed
```

### Automated Test Example

```javascript
// frontend/tests/integration/quote-creation.test.js
const { test, expect } = require('@playwright/test');

test.describe('Quote Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3001/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('creates quote successfully', async ({ page }) => {
    // Navigate to quote creation
    await page.goto('http://localhost:3001/quotes/create');

    // Fill form
    await page.fill('[name="customer_name"]', 'Test Company');
    await page.fill('[name="amount"]', '10000');

    // Submit
    await page.click('button:has-text("Create Quote")');

    // Verify success
    await expect(page.locator('.ant-message')).toContainText('created successfully');
    await expect(page).toHaveURL(/\/quotes\/\d+/);
  });

  test('validates required fields', async ({ page }) => {
    await page.goto('http://localhost:3001/quotes/create');

    // Submit empty form
    await page.click('button:has-text("Create Quote")');

    // Check validation messages
    await expect(page.locator('.ant-form-item-explain-error')).toContainText('required');
  });
});
```

---

## Common Patterns & Best Practices

### State Management Pattern

```typescript
// Use custom hooks for complex state
const useQuoteForm = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<QuoteData | null>(null);

  const actions = {
    save: async (values: QuoteFormData) => {
      setLoading(true);
      setError(null);
      try {
        const result = await saveQuote(values);
        setData(result);
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },

    reset: () => {
      setData(null);
      setError(null);
    },
  };

  return { loading, error, data, ...actions };
};
```

### Error Boundary Pattern

```typescript
// Wrap features in error boundaries
import { ErrorBoundary } from '@/components/ErrorBoundary';

<ErrorBoundary fallback={<ErrorFallback />}>
  <YourFeatureComponent />
</ErrorBoundary>
```

### Loading State Pattern

```typescript
// Consistent loading states
const LoadingCard = () => (
  <Card>
    <Skeleton active paragraph={{ rows: 4 }} />
  </Card>
);

// Use in components
if (loading) return <LoadingCard />;
```

### API Error Handling Pattern

```typescript
// Centralized error handler
export function handleApiError(error: any): string {
  if (error.response) {
    // Server responded with error
    switch (error.response.status) {
      case 401:
        router.push('/login');
        return 'Session expired. Please login again.';
      case 403:
        return 'You do not have permission for this action.';
      case 404:
        return 'The requested resource was not found.';
      case 422:
        return error.response.data.detail || 'Validation failed.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return error.response.data.message || 'An error occurred.';
    }
  } else if (error.request) {
    // Request made but no response
    return 'Network error. Please check your connection.';
  } else {
    // Something else happened
    return error.message || 'An unexpected error occurred.';
  }
}
```

---

## Debugging Tools

### Console Monitoring

```bash
# Monitor console in real-time
cd frontend && node .claude-read-console.js http://localhost:3001
```

### Network Debugging

```javascript
// Use Chrome DevTools MCP to inspect network
mcp__chrome-devtools__list_network_requests({
  resourceTypes: ['xhr', 'fetch'],
});
```

### React DevTools

```bash
# Install React DevTools extension in Chrome
# Inspect component state, props, and hooks
```

### Performance Profiling

```javascript
// Use Chrome DevTools performance trace
mcp__chrome-devtools__performance_start_trace({
  reload: true,
  autoStop: true,
});

// ... perform actions ...

mcp__chrome-devtools__performance_stop_trace();
```

---

## Quick Reference

### File Locations

```
frontend/
├── src/
│   ├── app/           # Pages and routes
│   ├── components/    # Reusable components
│   ├── lib/
│   │   └── api/      # API services
│   ├── types/        # TypeScript interfaces
│   └── styles/       # Global styles
├── public/           # Static assets
└── tests/           # Test files
```

### Common Commands

```bash
# Development
cd frontend && npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Build
npm run build

# Test
npm test
```

### Environment Variables

```env
# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## See Also

- [React Patterns](./react-patterns.md) - Component patterns and hooks
- [Ant Design Standards](./ant-design-standards.md) - UI component usage
- [ag-Grid Patterns](./ag-grid-patterns.md) - Data table implementation
- [State Management](./state-management.md) - State patterns and context
- [Common Gotchas](./common-gotchas.md) - Pitfalls to avoid