'use client';

/**
 * ListGrid Component - Dynamic Quote List with Preset Support
 *
 * TASK-008: Quote List Constructor with Department Presets
 *
 * This component provides a configurable ag-Grid table for quotes that:
 * - Accepts dynamic column configuration based on presets
 * - Fetches data from /api/quotes-list backend API
 * - Supports filtering, sorting, and pagination
 * - Preserves column state across sessions
 */

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  GridReadyEvent,
  SortChangedEvent,
  FilterChangedEvent,
  GridApi,
  ModuleRegistry,
  AllCommunityModule,
} from 'ag-grid-community';
import { toast } from 'sonner';
import { Settings2, RefreshCw, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/shared/StatusBadge';
import { GridScrollHelper } from '@/components/ui/grid-scroll-helper';

import { buildColDefs, SALES_PRESET_COLUMNS } from './columnDefs';
import { useQuotesList } from '@/lib/api/quotes-list-service';
import { cn } from '@/lib/utils';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// =============================================================================
// Types
// =============================================================================

export interface ListGridProps {
  /** Column fields to display (defaults to SALES_PRESET_COLUMNS) */
  columns?: string[];
  /** Initial filters */
  initialFilters?: Record<string, unknown>;
  /** Initial sort model */
  initialSort?: Array<{ colId: string; sort: 'asc' | 'desc' }>;
  /** Preset ID to load columns from */
  presetId?: string;
  /** Page size (default 50) */
  pageSize?: number;
  /** Callback when column config changes (for saving presets) */
  onColumnConfigChange?: (columns: string[]) => void;
  /** Callback when row is clicked */
  onRowClick?: (quoteId: string) => void;
  /** Show column configuration button */
  showColumnConfig?: boolean;
  /** Additional class name */
  className?: string;
}

export interface QuoteListRow {
  id: string;
  quote_number?: string;
  idn_quote?: string;
  customer_name?: string;
  manager_name?: string;
  workflow_state?: string;
  total_with_vat_quote?: number;
  total_with_vat_usd?: number;
  total_profit_usd?: number;
  currency?: string;
  created_at?: string;
  [key: string]: unknown;
}

// =============================================================================
// Cell Renderers
// =============================================================================

const StatusCell = React.memo(({ value }: { value: string }) => (
  <StatusBadge status={value || 'draft'} />
));
StatusCell.displayName = 'StatusCell';

const ProfitCell = React.memo(({ value }: { value: number | null }) => {
  if (!value) return <span className="text-foreground/40">—</span>;
  const isPositive = value >= 0;
  return (
    <span className={isPositive ? 'text-emerald-400' : 'text-red-400'}>
      ${value.toLocaleString('ru-RU', { minimumFractionDigits: 0 })}
    </span>
  );
});
ProfitCell.displayName = 'ProfitCell';

const QuoteNumberCell = React.memo(({ value }: { value: string }) => (
  <span className="font-medium text-foreground/90 cursor-pointer hover:text-foreground">
    {value || '—'}
  </span>
));
QuoteNumberCell.displayName = 'QuoteNumberCell';

// =============================================================================
// Component
// =============================================================================

export default function ListGrid({
  columns = SALES_PRESET_COLUMNS,
  initialFilters,
  initialSort,
  presetId,
  pageSize = 50,
  onColumnConfigChange,
  onRowClick,
  showColumnConfig = true,
  className,
}: ListGridProps) {
  const router = useRouter();
  const gridRef = useRef<AgGridReact>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  // Current page state
  const [currentPage, setCurrentPage] = useState(1);

  // Filter and sort state for API
  const [filters, setFilters] = useState<Record<string, unknown>>(initialFilters || {});
  const [sortModel, setSortModel] = useState<Array<{ colId: string; sort: 'asc' | 'desc' }>>(
    initialSort || []
  );

  // Fetch data using our custom hook
  const { data, isLoading, error, refetch } = useQuotesList({
    columns,
    filters,
    sortModel,
    page: currentPage,
    pageSize,
    presetId,
  });

  // Build column definitions
  const columnDefs = useMemo(() => {
    const baseDefs = buildColDefs(columns);

    // Apply custom cell renderers for specific columns
    return baseDefs.map((colDef) => {
      const field = colDef.field;

      // Quote number column
      if (field === 'quote_number' || field === 'idn_quote') {
        return {
          ...colDef,
          cellRenderer: (params: { value: string }) => <QuoteNumberCell value={params.value} />,
        };
      }

      // Status column
      if (field === 'workflow_state' || field === 'status') {
        return {
          ...colDef,
          cellStyle: { display: 'flex', alignItems: 'center' },
          cellRenderer: (params: { value: string }) => <StatusCell value={params.value} />,
        };
      }

      // Profit column
      if (field === 'total_profit_usd') {
        return {
          ...colDef,
          cellRenderer: (params: { value: number }) => <ProfitCell value={params.value} />,
        };
      }

      return colDef;
    });
  }, [columns]);

  // Default column definition
  const defaultColDef: ColDef = useMemo(
    () => ({
      sortable: true,
      resizable: true,
      filter: true,
    }),
    []
  );

  // Grid ready handler
  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  // Sort change handler
  const onSortChanged = useCallback((event: SortChangedEvent) => {
    const sortState = event.api
      .getColumnState()
      .filter((col) => col.sort)
      .map((col) => ({
        colId: col.colId || '',
        sort: col.sort as 'asc' | 'desc',
      }));

    setSortModel(sortState);
    setCurrentPage(1); // Reset to first page on sort change
  }, []);

  // Filter change handler
  const onFilterChanged = useCallback((event: FilterChangedEvent) => {
    const filterModel = event.api.getFilterModel();
    const newFilters: Record<string, unknown> = {};

    Object.entries(filterModel).forEach(([field, filter]) => {
      // Convert ag-Grid filter model to our API format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const f = filter as any;
      if (f.filter !== undefined) {
        newFilters[field] = f.filter;
      } else if (f.filterTo !== undefined) {
        newFilters[field] = { from: f.filter, to: f.filterTo };
      } else if (f.values !== undefined) {
        newFilters[field] = { in: f.values };
      }
    });

    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page on filter change
  }, []);

  // Row click handler
  const handleRowClick = useCallback(
    (event: { data?: QuoteListRow }) => {
      if (event.data?.id) {
        if (onRowClick) {
          onRowClick(event.data.id);
        } else {
          router.push(`/quotes/${event.data.id}`);
        }
      }
    },
    [router, onRowClick]
  );

  // Refresh handler
  const handleRefresh = useCallback(() => {
    refetch();
    toast.success('Данные обновлены');
  }, [refetch]);

  // Export handler
  const handleExport = useCallback(async () => {
    if (!gridApi) return;

    try {
      const loadingToast = toast.loading('Подготовка экспорта...');

      // Use ag-Grid's built-in CSV export
      gridApi.exportDataAsCsv({
        fileName: `quotes_export_${new Date().toISOString().split('T')[0]}.csv`,
        columnSeparator: ';',
        suppressQuotes: false,
      });

      toast.success('Файл скачан', { id: loadingToast });
    } catch (err) {
      toast.error('Ошибка экспорта');
    }
  }, [gridApi]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(`Ошибка загрузки: ${error}`);
    }
  }, [error]);

  // Pagination info
  const totalPages = data?.total_pages || 1;
  const totalItems = data?.total || 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {isLoading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <>
              Показано {data?.rows?.length || 0} из {totalItems} записей
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Обновить
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isLoading || !data?.rows?.length}
          >
            <Download className="h-4 w-4 mr-2" />
            Экспорт
          </Button>

          {showColumnConfig && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // TODO: Open column config modal
                toast.info('Настройка колонок скоро будет доступна');
              }}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Колонки
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      <GridScrollHelper gridContainerRef={gridContainerRef}>
        <div
          ref={gridContainerRef}
          className={cn(
            'ag-theme-custom-dark rounded-lg border border-border',
            isLoading && 'opacity-70 transition-opacity'
          )}
        >
          {isLoading && !data?.rows?.length ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <AgGridReact
              ref={gridRef}
              theme="legacy"
              rowData={data?.rows || []}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              onGridReady={onGridReady}
              onSortChanged={onSortChanged}
              onFilterChanged={onFilterChanged}
              rowSelection={{ mode: 'multiRow', enableClickSelection: false }}
              suppressCellFocus={true}
              enableCellTextSelection={false}
              ensureDomOrder={true}
              domLayout="autoHeight"
              alwaysShowHorizontalScroll={true}
              getRowId={(params) => params.data.id}
              onRowClicked={handleRowClick}
            />
          )}
        </div>
      </GridScrollHelper>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Страница {currentPage} из {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || isLoading}
            >
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isLoading}
            >
              Вперед
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
