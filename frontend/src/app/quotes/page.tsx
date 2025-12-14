'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useTransition,
  useMemo,
  useCallback,
  memo,
} from 'react';
import { useRouter } from 'next/navigation';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

// Register AG Grid modules (required for v34+)
ModuleRegistry.registerModules([AllCommunityModule]);
import {
  Download,
  Upload,
  MoreHorizontal,
  Send,
  FileDown,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import QuoteStats from '@/components/quotes/QuoteStats';
import QuoteFilters from '@/components/quotes/QuoteFilters';
import StatusBadge from '@/components/shared/StatusBadge';
import CreateQuoteModal from '@/components/quotes/CreateQuoteModal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { QuoteService } from '@/lib/api/quote-service';
import { useAuth } from '@/lib/auth/AuthProvider';
import { config } from '@/lib/config';
import { getAuthToken } from '@/lib/auth/auth-helper';
import { cn } from '@/lib/utils';

interface QuoteListItem {
  id: string;
  idn_quote?: string; // New IDN format (optional for backward compatibility)
  quote_number?: string; // Legacy field (optional for backward compatibility)
  customer_name?: string;
  created_by_name?: string;
  workflow_state?: string;
  total_with_vat_quote?: number;
  total_with_vat_usd?: number;
  total_profit_usd?: number;
  currency?: string;
  quote_date?: string;
  valid_until?: string;
}

// Memoized formatting functions (outside component to avoid recreation)
const currencyFormatters = new Map<string, Intl.NumberFormat>();
const getCurrencyFormatter = (currency: string) => {
  if (!currencyFormatters.has(currency)) {
    currencyFormatters.set(
      currency,
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: 0,
      })
    );
  }
  return currencyFormatters.get(currency)!;
};

const formatCurrencyStatic = (amount: number, currency: string) => {
  return getCurrencyFormatter(currency || 'USD').format(amount);
};

const formatDateStatic = (date: string) => {
  return new Date(date).toLocaleDateString('ru-RU');
};

// Memoized cell renderers (defined outside component)
const QuoteNumberCell = memo(({ value }: { value: string }) => (
  <span className="font-medium text-foreground/90 cursor-pointer hover:text-foreground">
    {value}
  </span>
));
QuoteNumberCell.displayName = 'QuoteNumberCell';

const ProfitCell = memo(({ value }: { value: number | null }) => {
  if (!value) return <span className="text-foreground/40">—</span>;
  const isPositive = value >= 0;
  return (
    <span className={isPositive ? 'text-emerald-400' : 'text-red-400'}>
      ${value.toLocaleString('ru-RU', { minimumFractionDigits: 0 })}
    </span>
  );
});
ProfitCell.displayName = 'ProfitCell';

// Actions menu - memoized with callbacks
interface ActionsMenuProps {
  data: QuoteListItem;
  onSubmitForApproval: (id: string, idnQuote: string) => void;
  onExport: (id: string, type: 'validation' | 'invoice') => void;
}

const ActionsMenu = memo(({ data, onSubmitForApproval, onExport }: ActionsMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {data.workflow_state === 'draft' && (
        <>
          <DropdownMenuItem
            onClick={() => onSubmitForApproval(data.id, data.idn_quote || data.quote_number || '')}
          >
            <Send className="mr-2 h-4 w-4" />
            На утверждение
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuItem onClick={() => onExport(data.id, 'validation')}>
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Экспорт для проверки
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onExport(data.id, 'invoice')}>
        <FileDown className="mr-2 h-4 w-4" />
        Счёт (Invoice)
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
));
ActionsMenu.displayName = 'ActionsMenu';

export default function QuotesPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const gridRef = useRef<AgGridReact>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Filters with transition for better INP
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState<string | undefined>(undefined);
  const [authorFilterInitialized, setAuthorFilterInitialized] = useState(false);

  // Team members
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Submit modal
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitQuoteId, setSubmitQuoteId] = useState<string | null>(null);
  const [submitQuoteNumber, setSubmitQuoteNumber] = useState('');
  const [submitComment, setSubmitComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Create quote modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const quoteService = new QuoteService();

  // Fetch team members
  useEffect(() => {
    if (profile?.organization_id && teamMembers.length === 0) {
      fetchTeamMembers();
    }
  }, [profile?.organization_id]);

  // Pre-select current user
  useEffect(() => {
    if (teamMembers.length > 0 && profile?.id && !authorFilterInitialized) {
      setAuthorFilter(profile.id);
      setAuthorFilterInitialized(true);
    }
  }, [teamMembers, profile?.id, authorFilterInitialized]);

  // Fetch quotes when filters change
  useEffect(() => {
    if (profile?.organization_id && authorFilterInitialized) {
      fetchQuotes();
    }
  }, [
    currentPage,
    pageSize,
    searchTerm,
    statusFilter,
    authorFilter,
    profile,
    authorFilterInitialized,
  ]);

  const fetchTeamMembers = async () => {
    if (!profile?.organization_id) return;
    setLoadingMembers(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${config.apiUrl}/api/organizations/${profile.organization_id}/members`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setTeamMembers(
          data.map((m: any) => ({
            id: m.user_id,
            name: m.user_full_name || m.user_email,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const filters: Record<string, any> = {};
      if (searchTerm) filters.search = searchTerm;
      if (statusFilter) filters.workflow_state = statusFilter;
      if (authorFilter) filters.created_by = authorFilter;

      const response = await quoteService.getQuotes(profile?.organization_id || '', filters, {
        page: currentPage,
        limit: pageSize,
      });

      if (response.success && response.data) {
        setQuotes(response.data.quotes || []);
        setTotalCount(response.data.pagination?.total_items || 0);
      } else {
        toast.error(response.error || 'Ошибка загрузки КП');
      }
    } catch (error: any) {
      toast.error(`Ошибка загрузки: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats - memoized to avoid recalculation on unrelated state changes
  const { approvedQuotes, pendingQuotes, totalProfitUsd } = useMemo(() => {
    const approved = quotes.filter(
      (q: QuoteListItem) =>
        q.workflow_state === 'financially_approved' || q.workflow_state === 'accepted_by_customer'
    ).length;
    const pending = quotes.filter(
      (q: QuoteListItem) => q.workflow_state === 'awaiting_financial_approval'
    ).length;
    const profit = quotes.reduce(
      (sum: number, q: QuoteListItem) => sum + (q.total_profit_usd || 0),
      0
    );
    return { approvedQuotes: approved, pendingQuotes: pending, totalProfitUsd: profit };
  }, [quotes]);

  // Handlers
  const handleDownloadTemplate = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error('Не авторизован');
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/quotes/upload/download-template`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Ошибка скачивания');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'quote_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Шаблон скачан');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setCreateModalOpen(true);
    }
    e.target.value = '';
  };

  const handleCreateModalSuccess = (quoteId: string, _quoteNumber: string) => {
    setCreateModalOpen(false);
    setSelectedFile(null);
    // Navigate to the new quote or refresh the list
    router.push(`/quotes/${quoteId}`);
  };

  const handleCreateModalCancel = () => {
    setCreateModalOpen(false);
    setSelectedFile(null);
  };

  const handleSubmitForApproval = async () => {
    if (!submitQuoteId) return;
    setSubmitting(true);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Не авторизован');

      const response = await fetch(
        `${config.apiUrl}/api/quotes/${submitQuoteId}/submit-for-financial-approval`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
          body: submitComment || '',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка отправки');
      }

      setSubmitModalOpen(false);
      setSubmitComment('');
      toast.success('КП отправлено на утверждение');
      fetchQuotes();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async (quoteId: string, type: 'validation' | 'invoice') => {
    const loadingToast = toast.loading(
      type === 'validation' ? 'Создание файла... (10-15 сек)' : 'Экспорт...'
    );

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Не авторизован');

      const url =
        type === 'validation'
          ? `${config.apiUrl}/api/quotes/upload/export-as-template/${quoteId}`
          : `${config.apiUrl}/api/quotes/${quoteId}/export/pdf?format=invoice`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Ошибка экспорта');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = type === 'validation' ? `validation_${quoteId}.xlsm` : `invoice_${quoteId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);

      toast.success('Файл скачан', { id: loadingToast });
    } catch (error: any) {
      toast.error(error.message, { id: loadingToast });
    }
  };

  // Memoized callbacks for actions menu
  const handleOpenSubmitModal = useCallback((id: string, quoteNumber: string) => {
    setSubmitQuoteId(id);
    setSubmitQuoteNumber(quoteNumber);
    setSubmitModalOpen(true);
  }, []);

  const handleExportMemo = useCallback((quoteId: string, type: 'validation' | 'invoice') => {
    handleExport(quoteId, type);
  }, []);

  // ag-Grid column definitions - memoized to prevent recreation on every render
  // Column definitions with consistent alignment:
  // - Text columns: left-aligned (header + data)
  // - Number columns: right-aligned (header + data)
  // - Center: status badges only
  const columnDefs: ColDef[] = useMemo(
    () => [
      {
        field: 'idn_quote',
        headerName: 'IDN КП',
        width: 220,
        valueGetter: (params) => params.data?.idn_quote || params.data?.quote_number || '',
        cellRenderer: (params: ICellRendererParams) => <QuoteNumberCell value={params.value} />,
      },
      {
        field: 'customer_name',
        headerName: 'Клиент',
        flex: 1,
        minWidth: 180,
        cellClass: 'text-foreground/90',
      },
      {
        field: 'created_by_name',
        headerName: 'Автор',
        width: 150,
        cellClass: 'text-foreground/55',
        valueFormatter: (params: { value: string }) => params.value || '—',
      },
      {
        field: 'total_with_vat_quote',
        headerName: 'Сумма',
        width: 140,
        type: 'rightAligned',
        cellClass: 'font-mono-numbers text-foreground/90',
        valueFormatter: (params: { value: number; data: QuoteListItem }) =>
          params.value ? formatCurrencyStatic(params.value, params.data.currency || 'USD') : '—',
      },
      {
        field: 'total_profit_usd',
        headerName: 'Прибыль',
        width: 120,
        type: 'rightAligned',
        cellClass: 'font-mono-numbers',
        cellRenderer: (params: ICellRendererParams) => <ProfitCell value={params.value} />,
      },
      {
        field: 'workflow_state',
        headerName: 'Статус',
        width: 140,
        cellStyle: { display: 'flex', alignItems: 'center' },
        cellRenderer: (params: ICellRendererParams) => (
          <StatusBadge status={params.value || 'draft'} />
        ),
      },
      {
        field: 'quote_date',
        headerName: 'Дата',
        width: 110,
        cellClass: 'text-foreground/55',
        valueFormatter: (params: { value: string }) =>
          params.value ? formatDateStatic(params.value) : '—',
      },
      {
        headerName: '',
        width: 60,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams) => (
          <ActionsMenu
            data={params.data}
            onSubmitForApproval={handleOpenSubmitModal}
            onExport={handleExportMemo}
          />
        ),
      },
    ],
    [handleOpenSubmitModal, handleExportMemo]
  );

  const defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Коммерческие предложения"
          actions={
            <>
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Шаблон
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xlsx,.xls,.xlsm"
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Создать КП
              </Button>
            </>
          }
        />

        {/* Stats */}
        <QuoteStats
          totalQuotes={totalCount}
          approvedQuotes={approvedQuotes}
          pendingQuotes={pendingQuotes}
          totalProfitUsd={totalProfitUsd}
        />

        {/* Filters */}
        <QuoteFilters
          searchTerm={searchTerm}
          onSearchChange={(v) =>
            startTransition(() => {
              setSearchTerm(v);
              setCurrentPage(1);
            })
          }
          statusFilter={statusFilter}
          onStatusChange={(v) =>
            startTransition(() => {
              setStatusFilter(v);
              setCurrentPage(1);
            })
          }
          authorFilter={authorFilter}
          onAuthorChange={(v) =>
            startTransition(() => {
              setAuthorFilter(v);
              setCurrentPage(1);
            })
          }
          teamMembers={teamMembers}
          loadingMembers={loadingMembers}
        />

        {/* Table */}
        <div
          className={cn(
            'ag-theme-custom-dark rounded-lg border border-border overflow-hidden',
            isPending && 'opacity-70 transition-opacity'
          )}
          style={{ height: 600 }}
        >
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : quotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">КП не найдено</p>
              <p className="text-sm mt-1">
                {authorFilter
                  ? 'По выбранному фильтру нет коммерческих предложений'
                  : 'Создайте первое коммерческое предложение'}
              </p>
            </div>
          ) : (
            <AgGridReact
              ref={gridRef}
              theme="legacy"
              rowData={quotes}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              rowSelection={{ mode: 'multiRow', enableClickSelection: false }}
              suppressCellFocus={true}
              // Disable text selection to prevent InvalidNodeTypeError on detached nodes
              enableCellTextSelection={false}
              ensureDomOrder={true}
              pagination
              paginationPageSize={pageSize}
              domLayout="normal"
              getRowId={(params) => params.data.id}
              onRowClicked={(e) => {
                // Skip navigation when clicking on checkbox column
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((e as any).column?.getColId() === 'ag-Grid-SelectionColumn') return;
                if (e.data?.id) {
                  router.push(`/quotes/${e.data.id}`);
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Submit for Approval Dialog */}
      <Dialog open={submitModalOpen} onOpenChange={setSubmitModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отправить на утверждение</DialogTitle>
            <DialogDescription>
              КП {submitQuoteNumber} будет отправлено на финансовое утверждение.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Комментарий (необязательно)"
              value={submitComment}
              onChange={(e) => setSubmitComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSubmitForApproval} disabled={submitting}>
              {submitting ? 'Отправка...' : 'Отправить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Quote Modal */}
      <CreateQuoteModal
        open={createModalOpen}
        onCancel={handleCreateModalCancel}
        onSuccess={handleCreateModalSuccess}
        selectedFile={selectedFile}
      />
    </MainLayout>
  );
}
