'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import type { TableWidgetConfig } from '@/types/dashboard';

interface TableDataRow {
  [key: string]: string | number | boolean | null;
}

interface TableWidgetProps {
  data: TableDataRow[];
  config: TableWidgetConfig;
}

/**
 * Table widget for displaying tabular campaign data
 */
export function TableWidget({ data, config }: TableWidgetProps) {
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const columns =
    config.columns.length > 0 ? config.columns : data.length > 0 ? Object.keys(data[0]) : [];

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortField || !config.sortable) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr, 'ru')
        : bStr.localeCompare(aStr, 'ru');
    });
  }, [data, sortField, sortDirection, config.sortable]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!config.paginated) return sortedData;
    const start = page * config.page_size;
    return sortedData.slice(start, start + config.page_size);
  }, [sortedData, page, config.paginated, config.page_size]);

  const totalPages = Math.ceil(data.length / config.page_size);

  const handleSort = (field: string) => {
    if (!config.sortable) return;

    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatColumnName = (name: string) => {
    // Convert snake_case to readable format
    return name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatCellValue = (value: string | number | boolean | null) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
    if (typeof value === 'number') {
      if (Number.isInteger(value)) return value.toLocaleString('ru-RU');
      return value.toFixed(2);
    }
    return String(value);
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Нет данных для отображения
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col}
                  className={config.sortable ? 'cursor-pointer select-none' : ''}
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center gap-1">
                    {formatColumnName(col)}
                    {config.sortable && <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((col) => (
                  <TableCell key={col}>{formatCellValue(row[col])}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {config.paginated && totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-2 border-t">
          <span className="text-sm text-muted-foreground">
            Страница {page + 1} из {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TableWidget;
