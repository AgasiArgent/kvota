# Quote Creation Form - Validation Implementation

**Date:** 2025-10-28
**File:** `frontend/src/app/quotes/create/page.tsx`
**Branch:** dev

---

## Overview

Added comprehensive validation feedback to the quote creation form to guide users and prevent submission with incomplete data.

---

## Changes Implemented

### 1. Form-Level Validation Configuration

**Location:** Line 951-959

```typescript
<Form
  form={form}
  layout="vertical"
  size="small"
  className="compact-form"
  onFinish={handleCalculate}
  validateTrigger={['onBlur', 'onChange']}  // NEW: Validate on blur and change
  scrollToFirstError={{ behavior: 'smooth', block: 'center' }}  // NEW: Auto-scroll to errors
>
```

**Features:**

- Validates fields when user leaves them (onBlur)
- Validates fields as user types (onChange)
- Automatically scrolls to first error field on submit

---

### 2. Required Field Validation Rules

Added validation rules to critical fields:

#### Customer Selection (Line 997-1018)

```typescript
<Form.Item
  name="customer_id"
  noStyle
  rules={[{ required: true, message: 'Выберите клиента' }]}
>
  <Select ... />
</Form.Item>
```

#### Currency of Quote (Line 1141-1151)

```typescript
<Form.Item
  name="currency_of_quote"
  label="Валюта КП"
  rules={[{ required: true, message: 'Выберите валюту КП' }]}
>
  <Select ... />
</Form.Item>
```

#### Delivery Time (Line 1164-1175)

```typescript
<Form.Item
  name="delivery_time"
  label="Срок поставки (дни)"
  rules={[{ required: true, message: 'Укажите срок поставки' }]}
>
  <InputNumber ... />
</Form.Item>
```

#### Quote Date (Line 1063-1081)

```typescript
<Form.Item
  name="quote_date"
  noStyle
  rules={[{ required: true, message: 'Укажите дату КП' }]}
>
  <DatePicker ... />
</Form.Item>
```

#### Valid Until Date (Line 1089-1095)

```typescript
<Form.Item
  name="valid_until"
  noStyle
  rules={[{ required: true, message: 'Укажите срок действия' }]}
>
  <DatePicker ... />
</Form.Item>
```

---

### 3. Enhanced Validation in handleCalculate()

**Location:** Line 514-564

#### Step 1: Form Fields Validation

```typescript
try {
  await form.validateFields();
} catch (error) {
  message.error('Пожалуйста, заполните все обязательные поля');
  // Scroll to first error field
  const errorField = document.querySelector('.ant-form-item-has-error');
  if (errorField) {
    errorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return;
}
```

**What it does:**

- Validates all form fields with `rules` prop
- Shows error message if validation fails
- Scrolls to first invalid field
- Prevents submission

#### Step 2: Customer Validation

```typescript
if (!selectedCustomer) {
  message.error('Выберите клиента');
  // Scroll to customer select
  const customerSelect = document.querySelector('[name="customer_id"]')?.closest('.ant-row');
  if (customerSelect) {
    customerSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return;
}
```

**What it does:**

- Checks if customer is selected
- Shows error message: "Выберите клиента"
- Scrolls to customer dropdown
- Prevents submission

#### Step 3: Products Existence Validation

```typescript
if (uploadedProducts.length === 0) {
  message.error('Добавьте минимум 1 продукт');
  // Scroll to upload section
  const uploadSection = document.querySelector('.ant-upload-drag');
  if (uploadSection) {
    uploadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return;
}
```

**What it does:**

- Checks if at least 1 product uploaded
- Shows error message: "Добавьте минимум 1 продукт"
- Scrolls to file upload area
- Prevents submission

#### Step 4: Product Fields Validation

```typescript
const invalidProducts = uploadedProducts.filter(
  (p) =>
    !p.product_name || p.base_price_vat === null || p.base_price_vat === undefined || !p.quantity
);
if (invalidProducts.length > 0) {
  message.error(
    `Заполните все обязательные поля продуктов (название, цена с НДС, количество). Найдено незаполненных: ${invalidProducts.length}`
  );
  // Scroll to products grid
  const productsGrid = document.querySelector('.ag-theme-alpine');
  if (productsGrid) {
    productsGrid.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return;
}
```

**What it does:**

- Validates each product has: name, base_price_vat, quantity
- Shows error message with count of invalid products
- Scrolls to products grid
- Prevents submission

---

### 4. Customer State Synchronization

**Location:** Line 177-187

```typescript
useEffect(() => {
  if (selectedCustomer) {
    loadCustomerContacts(selectedCustomer);
    // Sync form field with state
    form.setFieldValue('customer_id', selectedCustomer);
  } else {
    setCustomerContacts([]);
    setSelectedContact(undefined);
    form.setFieldValue('customer_id', undefined);
  }
}, [selectedCustomer, form]);
```

**What it does:**

- Syncs `selectedCustomer` state with `customer_id` form field
- Ensures validation works correctly
- Clears field when customer deselected

---

### 5. Visual Error Styling

**Location:** Line 93-112

```css
.compact-form .ant-form-item-has-error .ant-select-selector,
.compact-form .ant-form-item-has-error .ant-input,
.compact-form .ant-form-item-has-error .ant-input-number,
.compact-form .ant-form-item-has-error .ant-picker {
  border-color: #ff4d4f !important;
}
.compact-form .ant-form-item-has-error .ant-form-item-explain-error {
  font-size: 11px;
  margin-top: 2px;
}
```

**What it does:**

- Red border on invalid fields (Select, Input, InputNumber, DatePicker)
- Small font for error messages (11px)
- Consistent styling across all field types

---

### 6. Enhanced Calculate Button Section

**Location:** Line 1768-1808

**Before:**

```typescript
{(!selectedCustomer || uploadedProducts.length === 0) && (
  <Text type="secondary" style={{ display: 'block', marginTop: 8, textAlign: 'center' }}>
    {!selectedCustomer && 'Выберите клиента'}
    {!selectedCustomer && uploadedProducts.length === 0 && ' и '}
    {uploadedProducts.length === 0 && 'загрузите товары'}
  </Text>
)}
```

**After:**

```typescript
{(!selectedCustomer || uploadedProducts.length === 0) && (
  <Alert
    message="Перед расчетом проверьте:"
    description={
      <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
        {!selectedCustomer && <li>Выберите клиента из списка</li>}
        {uploadedProducts.length === 0 && <li>Загрузите файл с товарами</li>}
        <li>Заполните все обязательные поля (отмечены красным при пропуске)</li>
      </ul>
    }
    type="warning"
    showIcon
    style={{ marginTop: 12 }}
  />
)}
```

**Changes:**

- Replaced simple text with Alert component
- Added warning icon
- Bullet list format for clarity
- Always shows reminder about required fields

---

## Validation Flow

### When User Clicks "Рассчитать КП"

```
1. Validate Form Fields (Ant Design rules)
   ├─ If fails → Show error + scroll to field → STOP
   └─ If passes → Continue

2. Check Customer Selected
   ├─ If not selected → Show error + scroll → STOP
   └─ If selected → Continue

3. Check Products Uploaded
   ├─ If none → Show error + scroll → STOP
   └─ If exists → Continue

4. Check Product Fields Complete
   ├─ If missing fields → Show error + scroll → STOP
   └─ If all complete → Continue

5. Submit to Backend
```

---

## User Experience Improvements

### 1. Immediate Feedback

- Fields validate on blur (when user leaves field)
- Red border appears immediately on invalid fields
- Error messages show below fields

### 2. Clear Error Messages

- Russian language for all messages
- Specific messages for each error type:
  - "Выберите клиента" (Select customer)
  - "Выберите валюту КП" (Select quote currency)
  - "Укажите срок поставки" (Specify delivery time)
  - "Укажите дату КП" (Specify quote date)
  - "Укажите срок действия" (Specify valid until)
  - "Добавьте минимум 1 продукт" (Add at least 1 product)
  - "Заполните все обязательные поля продуктов" (Fill all required product fields)

### 3. Auto-Scroll to Errors

- Form automatically scrolls to first error
- Smooth animation (not jarring)
- Centers error field in viewport

### 4. Visual Consistency

- All error fields use same red color (#ff4d4f)
- Small, unobtrusive error messages (11px font)
- Error styling works across all field types

### 5. Helpful Warnings

- Alert box shows requirements before submission
- Bullet list format easy to scan
- Warning icon draws attention

---

## Required Fields Summary

### Form Fields (Ant Design Validation)

- ✅ Customer (customer_id) - Select
- ✅ Currency of Quote (currency_of_quote) - Select
- ✅ Delivery Time (delivery_time) - InputNumber
- ✅ Quote Date (quote_date) - DatePicker
- ✅ Valid Until (valid_until) - DatePicker

### Non-Form Fields (Manual Validation)

- ✅ Products Array - Must have at least 1 product
- ✅ Each Product:
  - product_name - Required
  - base_price_vat - Required (not null/undefined)
  - quantity - Required

---

## Testing Checklist

### Empty Form Submission

- [ ] Click "Рассчитать КП" with empty form
- [ ] Should show "Пожалуйста, заполните все обязательные поля"
- [ ] Should scroll to first error field
- [ ] Red border appears on invalid fields

### Customer Not Selected

- [ ] Fill all fields except customer
- [ ] Click "Рассчитать КП"
- [ ] Should show "Выберите клиента"
- [ ] Should scroll to customer dropdown

### No Products Uploaded

- [ ] Select customer
- [ ] Fill all form fields
- [ ] Don't upload file
- [ ] Click "Рассчитать КП"
- [ ] Should show "Добавьте минимум 1 продукт"
- [ ] Should scroll to upload area

### Invalid Product Fields

- [ ] Upload file with products
- [ ] Delete product name/price/quantity in grid
- [ ] Click "Рассчитать КП"
- [ ] Should show error with count of invalid products
- [ ] Should scroll to products grid

### Field-Level Validation (On Blur)

- [ ] Tab through form fields without filling
- [ ] Error messages should appear below fields
- [ ] Red borders should appear on invalid fields

### Error Clearing

- [ ] Trigger validation error
- [ ] Fill the field correctly
- [ ] Error message should disappear
- [ ] Red border should disappear

### Successful Submission

- [ ] Fill all required fields
- [ ] Upload file with valid products
- [ ] Click "Рассчитать КП"
- [ ] Should submit successfully
- [ ] No validation errors

---

## Code Quality

### ✅ TypeScript Type Safety

- All validation functions properly typed
- No `any` types used
- Product interface validation correct

### ✅ Error Handling

- Try/catch for form validation
- Null checks for DOM elements
- Graceful error messages

### ✅ Performance

- useEffect dependencies correct
- No unnecessary re-renders
- Efficient validation logic

### ✅ Maintainability

- Clear validation flow
- Well-commented code
- Consistent patterns

---

## Follow Project Patterns

### ✅ Russian Localization

- All error messages in Russian
- Consistent terminology with existing code

### ✅ Ant Design Best Practices

- Form.Item with rules prop
- noStyle for inline fields
- validateTrigger configuration

### ✅ Code Style

- Consistent with existing patterns
- Proper indentation and formatting
- Clear variable names

---

## Files Modified

1. `/home/novi/quotation-app-dev/frontend/src/app/quotes/create/page.tsx` (~2,200 lines)
   - Added form validation configuration
   - Added validation rules to 5 fields
   - Enhanced handleCalculate with 4-step validation
   - Added customer state sync
   - Enhanced error styling CSS
   - Improved calculate button section

---

## Summary

Comprehensive validation feedback now ensures:

1. ✅ All required form fields are filled
2. ✅ Customer is selected
3. ✅ At least 1 product is uploaded
4. ✅ All products have required fields (name, price, quantity)
5. ✅ Clear error messages in Russian
6. ✅ Auto-scroll to first error
7. ✅ Visual feedback with red borders
8. ✅ Validation on blur and change
9. ✅ Form submission prevented until valid
10. ✅ Helpful warning alert before calculation

**User Experience:** Users now receive immediate, clear feedback about what needs to be filled before submitting the form. The auto-scroll feature ensures they don't miss error messages, and the Russian error messages are specific and actionable.
