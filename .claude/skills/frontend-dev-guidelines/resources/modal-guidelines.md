# Modal UX Guidelines

**Created:** 2025-12-18
**Last Updated:** 2025-12-18

This document defines UX patterns for modals in the B2B Quotation Platform. Following these patterns ensures consistent, frustration-free user experience across all modal dialogs.

---

## Core Principles

### 1. Always Show Loading States

**Problem:** Users click buttons multiple times when there's no feedback, creating duplicate records.

**Solution:** Every submit button must:
1. Show a loading spinner during async operations
2. Be disabled while loading
3. Prevent accidental double-clicks

```tsx
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const [saving, setSaving] = useState(false);

const handleSubmit = async () => {
  setSaving(true);
  try {
    await apiCall();
    toast.success('Сохранено');
    onSuccess();
  } catch (error) {
    toast.error(`Ошибка: ${error.message}`);
  } finally {
    setSaving(false);
  }
};

<Button disabled={saving} onClick={handleSubmit}>
  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Сохранить
</Button>
```

---

### 2. Close Modal on Success

**Problem:** Users don't know if their action succeeded, click again, create duplicates.

**Solution:** After successful save, close the modal and show a success toast.

```tsx
const handleSubmit = async () => {
  setSaving(true);
  try {
    const response = await apiCall();
    if (response.success) {
      toast.success('Запись создана');
      onSuccess(); // This should close the modal and refresh parent data
    } else {
      toast.error(`Ошибка: ${response.error}`);
    }
  } catch (error) {
    toast.error(`Ошибка: ${error.message}`);
  } finally {
    setSaving(false);
  }
};
```

---

### 3. Toast Notifications in Center

**Problem:** Bottom-right toasts are easy to miss.

**Solution:** Configure Sonner in layout.tsx with `position="top-center"`:

```tsx
// layout.tsx
import { Toaster } from '@/components/ui/sonner';

<Toaster position="top-center" />
```

---

### 4. Inline Add Forms Need Save Buttons

**Problem:** When a dropdown has "Add new" option that shows inline fields, users don't know how to save.

**Solution:** Inline add forms must have explicit "Сохранить" and "Отмена" buttons.

```tsx
// Pattern: Dropdown with inline add form
{!isAdding ? (
  <Select value={selectedId || 'add_new'} onValueChange={(val) => {
    if (val === 'add_new') {
      setIsAdding(true);
      setSelectedId('');
    } else {
      setSelectedId(val);
    }
  }}>
    <SelectContent>
      {items.map((item) => (
        <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
      ))}
      <SelectItem value="add_new">
        <span className="flex items-center">
          <Plus className="h-3 w-3 mr-1" />
          Добавить новый
        </span>
      </SelectItem>
    </SelectContent>
  </Select>
) : (
  <div className="space-y-2">
    <Input
      placeholder="Название..."
      value={newName}
      onChange={(e) => setNewName(e.target.value)}
    />
    <div className="flex gap-2">
      {items.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => {
          setIsAdding(false);
          setNewName('');
          // Restore previous selection
          if (items.length > 0) {
            setSelectedId(items[0].id);
          }
        }}>
          Отмена
        </Button>
      )}
      <Button size="sm" onClick={handleAdd}>
        Сохранить
      </Button>
    </div>
  </div>
)}
```

---

### 5. Refresh Parent Data After Create

**Problem:** After creating an item in a modal, the dropdown/list doesn't update.

**Solution:**
1. Modal accepts `onSuccess` callback
2. `onSuccess` is called after successful save
3. Parent component refetches data in `onSuccess`

```tsx
// Parent component
const [items, setItems] = useState<Item[]>([]);

const fetchItems = async () => {
  const response = await api.listItems();
  if (response.success) setItems(response.data);
};

<ItemModal
  open={modalOpen}
  onCancel={() => setModalOpen(false)}
  onSuccess={() => {
    setModalOpen(false);
    fetchItems(); // Refresh the list
  }}
/>
```

---

### 6. Form Validation Before Submit

**Problem:** Users submit incomplete forms, get cryptic errors.

**Solution:** Validate required fields client-side before API call.

```tsx
const handleSubmit = async () => {
  // Client-side validation
  if (!name.trim()) {
    toast.error('Укажите название');
    return;
  }
  if (!selectedType) {
    toast.error('Выберите тип');
    return;
  }

  // Proceed with API call
  setSaving(true);
  // ...
};
```

---

### 7. Modal State Reset on Open

**Problem:** Modal shows stale data from previous open.

**Solution:** Reset all state when modal opens.

```tsx
useEffect(() => {
  if (open) {
    // Fetch fresh data
    fetchData();

    // Reset form state
    setSelectedId('');
    setName('');
    setIsAdding(false);
    setError(null);
  }
}, [open]);
```

---

## Modal Component Checklist

When creating a new modal, verify:

- [ ] Submit button shows `Loader2` spinner when saving
- [ ] Submit button is `disabled={saving}` during save
- [ ] Modal calls `onSuccess()` after successful save (not just `onCancel`)
- [ ] Parent component refetches data in `onSuccess` callback
- [ ] Toast notifications use `toast.success()` / `toast.error()` from Sonner
- [ ] Inline "Add new" forms have explicit "Сохранить" button
- [ ] Inline "Add new" forms have "Отмена" button when items exist
- [ ] Required fields validated before API call
- [ ] State resets when modal opens via `useEffect([open])`
- [ ] Russian text for all user-facing labels and messages

---

## Example: Complete Modal Pattern

```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ItemModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  item?: Item | null; // For edit mode
}

export default function ItemModal({ open, onCancel, onSuccess, item }: ItemModalProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      if (item) {
        // Edit mode: populate from existing item
        setName(item.name);
      } else {
        // Create mode: reset to defaults
        setName('');
      }
    }
  }, [open, item]);

  const handleSubmit = async () => {
    // Validate
    if (!name.trim()) {
      toast.error('Укажите название');
      return;
    }

    setSaving(true);
    try {
      const response = item
        ? await api.updateItem(item.id, { name })
        : await api.createItem({ name });

      if (response.success) {
        toast.success(item ? 'Запись обновлена' : 'Запись создана');
        onSuccess(); // Close modal and refresh parent
      } else {
        toast.error(`Ошибка: ${response.error}`);
      }
    } catch (error) {
      toast.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Редактировать' : 'Создать'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>
              Название <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {item ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Common Mistakes to Avoid

### 1. No loading feedback
```tsx
// BAD: No feedback on click
<Button onClick={handleSubmit}>Сохранить</Button>

// GOOD: Loading state
<Button onClick={handleSubmit} disabled={saving}>
  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Сохранить
</Button>
```

### 2. Not closing modal on success
```tsx
// BAD: Only shows toast, doesn't close
if (response.success) {
  toast.success('Сохранено');
}

// GOOD: Close and refresh
if (response.success) {
  toast.success('Сохранено');
  onSuccess();
}
```

### 3. Inline add without save button
```tsx
// BAD: User types but can't save
{isAdding && (
  <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
)}

// GOOD: Explicit save action
{isAdding && (
  <div className="space-y-2">
    <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => setIsAdding(false)}>
        Отмена
      </Button>
      <Button size="sm" onClick={handleAdd}>
        Сохранить
      </Button>
    </div>
  </div>
)}
```

### 4. Not refreshing parent after create
```tsx
// BAD: Modal closes but list is stale
<ItemModal onSuccess={() => setModalOpen(false)} />

// GOOD: Refresh list after close
<ItemModal onSuccess={() => {
  setModalOpen(false);
  fetchItems();
}} />
```

---

## See Also

- `ant-design-standards.md` - Form validation patterns
- `workflow-patterns.md` - API integration patterns
- `common-gotchas.md` - Frontend debugging tips
