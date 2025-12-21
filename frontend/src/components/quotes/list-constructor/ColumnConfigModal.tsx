'use client';

/**
 * ColumnConfigModal Component - Modal to configure visible columns
 *
 * TASK-008: Quote List Constructor with Department Presets
 *
 * Features:
 * - Toggle column visibility
 * - Group columns by category
 * - Search columns
 * - Save as new preset
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Search, GripVertical, Eye, EyeOff, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import {
  ALL_COLUMNS,
  CATEGORY_LABELS,
  ColumnCategory,
  ColumnDefinition,
  getColumnsByCategory,
} from './columnDefs';

// =============================================================================
// Types
// =============================================================================

export interface ColumnConfigModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Currently selected columns */
  selectedColumns: string[];
  /** Callback when columns are applied */
  onApply: (columns: string[]) => void;
  /** Callback to save as new preset */
  onSaveAsPreset?: (name: string, columns: string[]) => void;
  /** Whether this is for creating a new custom view */
  isCreatingCustomView?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export default function ColumnConfigModal({
  open,
  onClose,
  selectedColumns,
  onApply,
  onSaveAsPreset,
  isCreatingCustomView = false,
}: ColumnConfigModalProps) {
  // Local state for column selection
  const [localColumns, setLocalColumns] = useState<Set<string>>(new Set(selectedColumns));
  const [searchTerm, setSearchTerm] = useState('');
  const [savePresetName, setSavePresetName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(isCreatingCustomView);

  // Reset local state when modal opens
  React.useEffect(() => {
    if (open) {
      setLocalColumns(new Set(selectedColumns));
      setSearchTerm('');
      setShowSaveForm(isCreatingCustomView);
      setSavePresetName('');
    }
  }, [open, selectedColumns, isCreatingCustomView]);

  // Filter columns by search term
  const filteredColumns = useMemo(() => {
    if (!searchTerm) return ALL_COLUMNS;

    const term = searchTerm.toLowerCase();
    return ALL_COLUMNS.filter(
      (col) =>
        col.field.toLowerCase().includes(term) ||
        col.headerName.toLowerCase().includes(term) ||
        col.description?.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  // Group filtered columns by category
  const groupedColumns = useMemo(() => {
    const groups: Record<ColumnCategory, ColumnDefinition[]> = {
      identity: [],
      manager: [],
      customer: [],
      financials: [],
      delivery: [],
      variables: [],
      calculations: [],
      derived: [],
    };

    filteredColumns.forEach((col) => {
      groups[col.category].push(col);
    });

    return groups;
  }, [filteredColumns]);

  // Toggle column selection
  const toggleColumn = useCallback((field: string) => {
    setLocalColumns((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }, []);

  // Select/deselect all in a category
  const toggleCategory = useCallback((category: ColumnCategory, select: boolean) => {
    const categoryColumns = getColumnsByCategory(category);
    setLocalColumns((prev) => {
      const next = new Set(prev);
      categoryColumns.forEach((col) => {
        if (select) {
          next.add(col.field);
        } else {
          next.delete(col.field);
        }
      });
      return next;
    });
  }, []);

  // Apply changes
  const handleApply = useCallback(() => {
    // Convert to array, preserving order from ALL_COLUMNS
    const orderedColumns = ALL_COLUMNS.filter((col) => localColumns.has(col.field)).map(
      (col) => col.field
    );
    onApply(orderedColumns);
    onClose();
  }, [localColumns, onApply, onClose]);

  // Save as preset
  const handleSaveAsPreset = useCallback(() => {
    if (!savePresetName.trim() || !onSaveAsPreset) return;

    const orderedColumns = ALL_COLUMNS.filter((col) => localColumns.has(col.field)).map(
      (col) => col.field
    );
    onSaveAsPreset(savePresetName.trim(), orderedColumns);
    onClose();
  }, [savePresetName, localColumns, onSaveAsPreset, onClose]);

  // Count selected in each category
  const categoryCounts = useMemo(() => {
    const counts: Record<ColumnCategory, { selected: number; total: number }> = {
      identity: { selected: 0, total: 0 },
      manager: { selected: 0, total: 0 },
      customer: { selected: 0, total: 0 },
      financials: { selected: 0, total: 0 },
      delivery: { selected: 0, total: 0 },
      variables: { selected: 0, total: 0 },
      calculations: { selected: 0, total: 0 },
      derived: { selected: 0, total: 0 },
    };

    ALL_COLUMNS.forEach((col) => {
      counts[col.category].total++;
      if (localColumns.has(col.field)) {
        counts[col.category].selected++;
      }
    });

    return counts;
  }, [localColumns]);

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            {isCreatingCustomView ? 'Создание нового вида' : 'Настройка колонок'}
          </DialogTitle>
          <DialogDescription>
            {isCreatingCustomView
              ? 'Выберите нужные колонки и сохраните как личный пресет'
              : `Выберите колонки для отображения в таблице. Выбрано: ${localColumns.size} из ${ALL_COLUMNS.length}`}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск колонок..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Column List */}
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {(Object.keys(CATEGORY_LABELS) as ColumnCategory[]).map((category) => {
              const columns = groupedColumns[category];
              if (columns.length === 0) return null;

              const { selected, total } = categoryCounts[category];
              const allSelected = selected === total;
              const someSelected = selected > 0 && selected < total;

              return (
                <div key={category}>
                  {/* Category Header */}
                  <div className="flex items-center justify-between py-2 sticky top-0 bg-background z-10">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                        onCheckedChange={(checked: boolean | 'indeterminate') =>
                          toggleCategory(category, checked === true)
                        }
                      />
                      <span className="font-medium">{CATEGORY_LABELS[category]}</span>
                      <Badge variant="secondary" className="ml-2">
                        {selected}/{total}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCategory(category, true)}
                        className="h-6 px-2 text-xs"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Все
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCategory(category, false)}
                        className="h-6 px-2 text-xs"
                      >
                        <EyeOff className="h-3 w-3 mr-1" />
                        Скрыть
                      </Button>
                    </div>
                  </div>

                  {/* Category Columns */}
                  <div className="grid grid-cols-2 gap-1 pl-6">
                    {columns.map((col) => (
                      <TooltipProvider key={col.field} delayDuration={600}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <label className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer">
                              <Checkbox
                                checked={localColumns.has(col.field)}
                                onCheckedChange={() => toggleColumn(col.field)}
                              />
                              <span className="text-sm truncate">{col.headerName}</span>
                            </label>
                          </TooltipTrigger>
                          {col.description && (
                            <TooltipContent side="right" className="max-w-xs">
                              <p className="font-medium">{col.headerName}</p>
                              <p className="text-muted-foreground text-xs mt-1">
                                {col.description}
                              </p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>

                  <Separator className="mt-2" />
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Save as Preset Form */}
        {showSaveForm && onSaveAsPreset && (
          <div className="flex gap-2">
            <Input
              placeholder="Название пресета"
              value={savePresetName}
              onChange={(e) => setSavePresetName(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSaveAsPreset} disabled={!savePresetName.trim()}>
              Сохранить
            </Button>
            <Button variant="ghost" onClick={() => setShowSaveForm(false)}>
              Отмена
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!showSaveForm && onSaveAsPreset && (
            <Button variant="outline" onClick={() => setShowSaveForm(true)}>
              <Save className="h-4 w-4 mr-2" />
              Сохранить как пресет
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleApply}>Применить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
