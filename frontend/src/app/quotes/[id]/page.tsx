'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { config } from '@/lib/config';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Download,
  CheckCircle,
  Loader2,
  Info,
  AlertTriangle,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { QuoteService } from '@/lib/api/quote-service';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getAuthToken } from '@/lib/auth/auth-helper';
import { toast } from 'sonner';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { WorkflowStatusCard } from '@/components/workflow';
import { getWorkflowStatus, type WorkflowStatus } from '@/lib/api/workflow-service';
import FinancialApprovalActions from '@/components/quotes/FinancialApprovalActions';
import SubmitForApprovalModal from '@/components/quotes/SubmitForApprovalModal';

// Lazy load ag-Grid to reduce initial bundle size (saves ~300KB)
const AgGridReact = dynamic(
  async () => {
    const { AgGridReact } = await import('ag-grid-react');
    const { ModuleRegistry, AllCommunityModule } = await import('ag-grid-community');

    // Register modules when ag-Grid loads
    ModuleRegistry.registerModules([AllCommunityModule]);

    return AgGridReact;
  },
  {
    loading: () => (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Загрузка таблицы...</span>
      </div>
    ),
    ssr: false,
  }
);

// TypeScript interfaces matching backend response
interface QuoteItem {
  id: string;
  sku?: string;
  brand?: string;
  product_name: string;
  quantity: number;
  base_price_vat?: number;
  currency?: string;
  weight_in_kg?: number;
  unit_price?: number;
  total_price?: number;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  inn?: string;
  kpp?: string;
  company_name?: string;
}

interface QuoteDetail {
  id: string;
  quote_number: string;
  customer_id?: string;
  customer?: Customer;
  title?: string;
  status: string;
  workflow_state?: string;
  submission_comment?: string;
  last_sendback_reason?: string;
  last_financial_comment?: string;
  last_approval_comment?: string;
  quote_date?: string;
  valid_until?: string;
  currency?: string;
  total_amount?: number;
  created_at: string;
  items: QuoteItem[];
}

export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [workflow, setWorkflow] = useState<WorkflowStatus | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('details');
  const [submitModalOpen, setSubmitModalOpen] = useState(false);

  const quoteService = new QuoteService();
  const quoteId = params?.id as string;

  useEffect(() => {
    if (quoteId && profile?.organization_id) {
      fetchQuoteDetails();
    }
  }, [quoteId, profile?.organization_id]);

  useEffect(() => {
    if (quote?.id) {
      loadWorkflowStatus();
    }
  }, [quote?.id]);

  async function loadWorkflowStatus() {
    try {
      setWorkflowLoading(true);
      const status = await getWorkflowStatus(quote!.id);
      setWorkflow(status);
    } catch (error) {
      console.error('Failed to load workflow:', error);
    } finally {
      setWorkflowLoading(false);
    }
  }

  const fetchQuoteDetails = async () => {
    setLoading(true);
    try {
      const organizationId = profile?.organization_id || '';
      if (!organizationId) {
        toast.error('Не удалось определить организацию');
        return;
      }

      const response = await quoteService.getQuoteDetails(quoteId, organizationId);
      console.log('[QuoteDetail] API response:', response);

      if (response.success && response.data) {
        const quoteData = response.data as unknown as Record<string, unknown>;
        const items = (quoteData.items || []) as QuoteItem[];

        setQuote({
          id: quoteData.id as string,
          quote_number: quoteData.quote_number as string,
          customer_id: quoteData.customer_id as string | undefined,
          customer: quoteData.customer as Customer | undefined,
          title: quoteData.title as string | undefined,
          status: quoteData.status as string,
          workflow_state: quoteData.workflow_state as string | undefined,
          submission_comment: quoteData.submission_comment as string | undefined,
          last_sendback_reason: quoteData.last_sendback_reason as string | undefined,
          last_financial_comment: quoteData.last_financial_comment as string | undefined,
          last_approval_comment: quoteData.last_approval_comment as string | undefined,
          quote_date: quoteData.quote_date as string | undefined,
          valid_until: quoteData.valid_until as string | undefined,
          currency: (quoteData.currency_of_quote || quoteData.currency || 'RUB') as string,
          total_amount: quoteData.total_amount as number | undefined,
          created_at: quoteData.created_at as string,
          items: items,
        });
      } else {
        toast.error(response.error || 'Ошибка загрузки КП');
        router.push('/quotes');
      }
    } catch (error: unknown) {
      console.error('[QuoteDetail] Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast.error('Ошибка загрузки: ' + errorMessage);
      router.push('/quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const organizationId = profile?.organization_id || '';
      if (!organizationId) {
        toast.error('Не удалось определить организацию');
        return;
      }

      const response = await quoteService.deleteQuote(quoteId, organizationId);
      if (response.success) {
        toast.success('КП перемещено в корзину');
        router.push('/quotes');
      } else {
        toast.error(response.error || 'Ошибка удаления');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast.error('Ошибка удаления: ' + errorMessage);
    }
  };

  const handleSubmitForApproval = async (comment?: string) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error('Не авторизован');
        return;
      }

      const response = await fetch(
        `${config.apiUrl}/api/quotes/${quoteId}/submit-for-financial-approval`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
          body: comment || '',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка отправки на утверждение');
      }

      setSubmitModalOpen(false);
      await fetchQuoteDetails();
      await loadWorkflowStatus();
      toast.success('КП отправлено на финансовое утверждение');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Ошибка отправки на утверждение';
      toast.error(errorMessage);
      throw error;
    }
  };

  const handleExport = useCallback(
    async (format: string, type: 'pdf' | 'excel') => {
      if (exportLoading) {
        toast.warning('Экспорт уже выполняется. Пожалуйста, подождите.');
        return;
      }

      if (!quote?.items || quote.items.length === 0) {
        toast.warning('Котировка пустая. Добавьте товары для экспорта.');
        return;
      }

      setExportLoading(true);

      try {
        const token = await getAuthToken();

        const response = await fetch(
          `${config.apiUrl}/api/quotes/${quoteId}/export/${type}?format=${format}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || errorData.detail || 'Export failed');
        }

        const contentDisposition = response.headers.get('content-disposition');
        let filename = `quote_${quoteId}_${format}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;

        if (contentDisposition) {
          console.log('[Export] Content-Disposition:', contentDisposition);
          let filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;\n]*)/i);
          if (filenameMatch && filenameMatch[1]) {
            filename = decodeURIComponent(filenameMatch[1]);
          } else {
            filenameMatch = contentDisposition.match(
              /filename=["']([^"']+)["']|filename=([^;\s]+)/i
            );
            if (filenameMatch) {
              filename = (filenameMatch[1] || filenameMatch[2]).trim();
            }
          }
          console.log('[Export] Extracted filename:', filename);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success('Файл успешно загружен');
      } catch (error: unknown) {
        console.error('Export error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Попробуйте снова';
        toast.error('Ошибка экспорта: ' + errorMessage);
      } finally {
        setExportLoading(false);
      }
    },
    [quote?.items, quoteId, exportLoading]
  );

  const getStatusBadge = (status: string) => {
    const statusMap: Record<
      string,
      { variant: 'default' | 'secondary' | 'destructive' | 'outline'; text: string }
    > = {
      draft: { variant: 'secondary', text: 'Черновик' },
      pending_approval: { variant: 'default', text: 'На утверждении' },
      partially_approved: { variant: 'default', text: 'Частично утверждено' },
      approved: { variant: 'default', text: 'Утверждено' },
      revision_needed: { variant: 'outline', text: 'Требуется доработка' },
      rejected_internal: { variant: 'destructive', text: 'Отклонено (внутр.)' },
      ready_to_send: { variant: 'default', text: 'Готово к отправке' },
      sent: { variant: 'secondary', text: 'Отправлено' },
      viewed: { variant: 'secondary', text: 'Просмотрено' },
      accepted: { variant: 'default', text: 'Принято' },
      rejected: { variant: 'destructive', text: 'Отклонено' },
      expired: { variant: 'secondary', text: 'Истекло' },
      cancelled: { variant: 'secondary', text: 'Отменено' },
      awaiting_financial_approval: { variant: 'default', text: 'На финансовом утверждении' },
      financially_approved: { variant: 'default', text: 'Финансово утверждено' },
      rejected_by_finance: { variant: 'destructive', text: 'Отклонено финансовым менеджером' },
      sent_back_for_revision: { variant: 'outline', text: 'На доработке' },
    };
    const config = statusMap[status] || { variant: 'secondary' as const, text: status };
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const formatCurrency = (amount: number | undefined, currency: string = 'RUB') => {
    if (amount === undefined) return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  // ag-Grid column definitions for products table
  const columnDefs: ColDef[] = useMemo(
    () => [
      {
        field: 'product_code',
        headerName: 'Артикул',
        width: 150,
        pinned: 'left',
      },
      {
        field: 'brand',
        headerName: 'Бренд',
        width: 120,
        pinned: 'left',
      },
      {
        field: 'description',
        headerName: 'Наименование',
        width: 300,
        pinned: 'left',
      },
      {
        field: 'quantity',
        headerName: 'Кол-во',
        width: 100,
        type: 'numericColumn',
      },
      {
        field: 'unit',
        headerName: 'Ед. изм.',
        width: 100,
      },
      {
        field: 'final_price',
        headerName: 'Цена продажи',
        width: 150,
        type: 'numericColumn',
        valueFormatter: (params) => {
          if (!params.value) return '—';
          const currency = quote?.currency || 'RUB';
          const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '₽';
          return Number(params.value).toFixed(2) + ' ' + symbol;
        },
        cellStyle: { fontWeight: 'bold' },
      },
      {
        field: 'country_of_origin',
        headerName: 'Страна',
        width: 120,
      },
      {
        field: 'weight_in_kg',
        headerName: 'Вес (кг)',
        width: 110,
        type: 'numericColumn',
        valueFormatter: (params) => (params.value ? Number(params.value).toFixed(2) : '—'),
      },
      {
        field: 'total',
        headerName: 'Сумма',
        width: 150,
        type: 'numericColumn',
        valueGetter: (params) => {
          const finalPrice = params.data?.final_price;
          const quantity = params.data?.quantity;
          return finalPrice && quantity ? Number(finalPrice) * Number(quantity) : null;
        },
        valueFormatter: (params) => {
          if (!params.value) return '—';
          const currency = quote?.currency || 'RUB';
          const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '₽';
          return Number(params.value).toFixed(2) + ' ' + symbol;
        },
        cellStyle: { fontWeight: 'bold' },
      },
    ],
    [quote?.currency]
  );

  const defaultColDef: ColDef = useMemo(
    () => ({
      resizable: true,
      sortable: true,
      filter: false,
    }),
    []
  );

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </MainLayout>
    );
  }

  if (!quote) {
    return (
      <MainLayout>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">КП не найдено</p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        {/* Section 1: Header with Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push('/quotes')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <h1 className="text-2xl font-semibold">{quote.quote_number}</h1>
            {getStatusBadge(quote.workflow_state || quote.status)}
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={exportLoading}>
                  {exportLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Экспорт
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport('validation', 'excel')}>
                  Экспорт для проверки
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('invoice', 'pdf')}>
                  Счет (Invoice)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {quote.workflow_state === 'draft' && (
              <Button
                onClick={() => setSubmitModalOpen(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Отправить на утверждение
              </Button>
            )}
            {(quote.status === 'draft' || quote.status === 'revision_needed') && (
              <Button
                variant="outline"
                onClick={() => router.push('/quotes/' + quote.id + '/edit')}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Редактировать
              </Button>
            )}
            {quote.status === 'draft' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Удалить
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить КП?</AlertDialogTitle>
                    <AlertDialogDescription>КП будет перемещено в корзину</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Tabs for Details and Plan-Fact */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="details">Детали</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            {/* Workflow Section */}
            {!workflowLoading && workflow && (
              <WorkflowStatusCard workflow={workflow} workflowMode={'simple'} />
            )}

            {/* Submission Comment Alert (for financial managers) */}
            {quote.workflow_state === 'awaiting_financial_approval' && quote.submission_comment && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Комментарий менеджера при отправке</AlertTitle>
                <AlertDescription>
                  <strong>Менеджер написал:</strong>
                  <br />
                  {quote.submission_comment}
                </AlertDescription>
              </Alert>
            )}

            {/* Send-back Reason Alert */}
            {quote.workflow_state === 'sent_back_for_revision' && quote.last_sendback_reason && (
              <Alert
                variant="default"
                className="border-amber-500 bg-amber-50 dark:bg-amber-950/20"
              >
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 dark:text-amber-400">
                  КП требует доработки
                </AlertTitle>
                <AlertDescription>
                  <strong>Комментарий от финансового менеджера:</strong>
                  <br />
                  {quote.last_sendback_reason}
                </AlertDescription>
              </Alert>
            )}

            {/* Rejection Reason Alert */}
            {quote.workflow_state === 'rejected_by_finance' && quote.last_financial_comment && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>КП отклонено финансовым менеджером</AlertTitle>
                <AlertDescription>
                  <strong>Причина отклонения:</strong>
                  <br />
                  {quote.last_financial_comment}
                </AlertDescription>
              </Alert>
            )}

            {/* Approval Comment Alert */}
            {(quote.workflow_state === 'financially_approved' ||
              quote.workflow_state === 'approved') &&
              quote.last_approval_comment && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800 dark:text-green-400">
                    КП утверждено финансовым менеджером
                  </AlertTitle>
                  <AlertDescription>
                    <strong>Комментарий финансового менеджера:</strong>
                    <br />
                    {quote.last_approval_comment}
                  </AlertDescription>
                </Alert>
              )}

            {/* Financial Approval Actions */}
            {quote.workflow_state === 'awaiting_financial_approval' &&
              (['financial_manager', 'cfo', 'admin'].includes(profile?.organizationRole || '') ||
                profile?.is_owner) && (
                <Card>
                  <CardContent className="pt-6">
                    <FinancialApprovalActions
                      quoteId={quote.id}
                      quoteNumber={quote.quote_number}
                      onApprove={() => {
                        fetchQuoteDetails();
                        loadWorkflowStatus();
                      }}
                      onSendBack={() => {
                        fetchQuoteDetails();
                        loadWorkflowStatus();
                      }}
                      onReject={() => {
                        fetchQuoteDetails();
                        loadWorkflowStatus();
                      }}
                    />
                  </CardContent>
                </Card>
              )}

            {/* Quote Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Информация о КП</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Клиент</p>
                    <p className="font-medium">{quote.customer?.name || 'Не указан'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Название КП</p>
                    <p className="font-medium">{quote.title || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Статус</p>
                    {getStatusBadge(quote.workflow_state || quote.status)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Дата КП</p>
                    <p className="font-medium">{formatDate(quote.quote_date)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Действительно до</p>
                    <p className="font-medium">{formatDate(quote.valid_until)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Создано</p>
                    <p className="font-medium">{formatDate(quote.created_at)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Валюта</p>
                    <p className="font-medium">{quote.currency || 'RUB'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Общая сумма</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(quote.total_amount, quote.currency)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products Table (ag-Grid, read-only) */}
            <Card>
              <CardHeader>
                <CardTitle>Товары ({quote.items?.length || 0} позиций)</CardTitle>
              </CardHeader>
              <CardContent>
                {quote.items && quote.items.length > 0 ? (
                  <div className="ag-theme-alpine" style={{ height: 400, width: '100%' }}>
                    <AgGridReact
                      rowData={quote.items}
                      columnDefs={columnDefs}
                      defaultColDef={defaultColDef}
                      animateRows={true}
                      suppressHorizontalScroll={false}
                    />
                  </div>
                ) : (
                  <p className="text-muted-foreground">Нет товаров в этом КП</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Submit for Approval Modal */}
      <SubmitForApprovalModal
        open={submitModalOpen}
        onCancel={() => setSubmitModalOpen(false)}
        onSubmit={handleSubmitForApproval}
        quoteNumber={quote.quote_number}
      />
    </MainLayout>
  );
}
