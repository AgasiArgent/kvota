'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Trash2, RotateCcw, Trash, Info, X } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { QuoteService } from '@/lib/api/quote-service';
import { useAuth } from '@/lib/auth/AuthProvider';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';

// Enable relativeTime plugin and set locale to Russian
dayjs.extend(relativeTime);
dayjs.locale('ru');

interface QuoteListItem {
  id: string;
  quote_number: string;
  customer_name: string;
  title: string;
  status: string;
  total_amount: number;
  currency: string;
  quote_date: string;
  valid_until: string;
  created_at: string;
  deleted_at?: string;
}

const STATUS_OPTIONS = [
  { label: 'Черновик', value: 'draft' },
  { label: 'На утверждении', value: 'pending_approval' },
  { label: 'Частично утверждено', value: 'partially_approved' },
  { label: 'Утверждено', value: 'approved' },
  { label: 'Требуется доработка', value: 'revision_needed' },
  { label: 'Отклонено (внутр.)', value: 'rejected_internal' },
  { label: 'Готово к отправке', value: 'ready_to_send' },
  { label: 'Отправлено', value: 'sent' },
  { label: 'Просмотрено', value: 'viewed' },
  { label: 'Принято', value: 'accepted' },
  { label: 'Отклонено', value: 'rejected' },
  { label: 'Истекло', value: 'expired' },
  { label: 'Отменено', value: 'cancelled' },
];

export default function QuotesBinPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showAlert, setShowAlert] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const quoteService = new QuoteService();

  useEffect(() => {
    console.log('[useEffect] Triggered - profile:', profile?.organization_id, 'page:', currentPage);
    if (profile?.organization_id) {
      fetchBinQuotes();
    } else {
      console.log('[useEffect] BLOCKED - no organization_id');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, searchTerm, statusFilter, dateFrom, dateTo, profile]);

  const fetchBinQuotes = async () => {
    console.log(
      '[fetchBinQuotes] START - profile:',
      profile?.email,
      'org_id:',
      profile?.organization_id
    );
    setLoading(true);
    try {
      const filters: Record<string, string> = {};

      if (searchTerm) {
        filters.search = searchTerm;
      }
      if (statusFilter) {
        filters.status = statusFilter;
      }
      if (dateFrom && dateTo) {
        filters.date_from = dateFrom;
        filters.date_to = dateTo;
      }

      const organizationId = profile?.organization_id || '';
      if (!organizationId) {
        toast.error('Не удалось определить организацию');
        return;
      }

      const response = await quoteService.getBinQuotes(organizationId, filters, {
        page: currentPage,
        limit: pageSize,
      });
      console.log('[fetchBinQuotes] API response:', response);
      if (response.success && response.data) {
        setQuotes((response.data.quotes || []) as unknown as QuoteListItem[]);
        setTotalCount(response.data.pagination?.total_items || 0);
      } else {
        const errMsg =
          typeof response.error === 'string' ? response.error : 'Ошибка загрузки корзины';
        toast.error(errMsg);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast.error(`Ошибка загрузки корзины: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const organizationId = profile?.organization_id || '';
      if (!organizationId) {
        toast.error('Не удалось определить организацию');
        return;
      }

      const response = await quoteService.restoreQuote(id, organizationId);
      if (response.success) {
        toast.success('КП восстановлено');
        fetchBinQuotes();
      } else {
        const errMsg =
          typeof response.error === 'string' ? response.error : 'Ошибка восстановления';
        toast.error(errMsg);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast.error(`Ошибка восстановления: ${errorMessage}`);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      const organizationId = profile?.organization_id || '';
      if (!organizationId) {
        toast.error('Не удалось определить организацию');
        return;
      }

      const response = await quoteService.permanentlyDeleteQuote(id, organizationId);
      if (response.success) {
        toast.success('КП удалено безвозвратно');
        fetchBinQuotes();
      } else {
        const errMsg = typeof response.error === 'string' ? response.error : 'Ошибка удаления';
        toast.error(errMsg);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast.error(`Ошибка удаления: ${errorMessage}`);
    }
  };

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
    };
    const config = statusMap[status] || { variant: 'secondary' as const, text: status };
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency || 'RUB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchBinQuotes();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Корзина КП</h1>
        </div>

        {/* Info Banner */}
        {showAlert && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Автоматическое удаление</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>КП автоматически удаляются через 7 дней после перемещения в корзину</span>
              <Button variant="ghost" size="sm" onClick={() => setShowAlert(false)}>
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Trash className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-sm text-muted-foreground">Всего в корзине</p>
                  <p className="text-2xl font-bold text-destructive">{totalCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по номеру, клиенту..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Select
                value={statusFilter || 'all'}
                onValueChange={(value: string) => {
                  setStatusFilter(value === 'all' ? '' : value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                placeholder="Дата от"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
              />
              <Input
                type="date"
                placeholder="Дата до"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : quotes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trash className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Корзина пуста</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Номер КП</th>
                        <th className="text-left py-3 px-4 font-medium">Клиент</th>
                        <th className="text-left py-3 px-4 font-medium">Название</th>
                        <th className="text-right py-3 px-4 font-medium">Сумма</th>
                        <th className="text-left py-3 px-4 font-medium">Статус</th>
                        <th className="text-left py-3 px-4 font-medium">Дата КП</th>
                        <th className="text-left py-3 px-4 font-medium">Удалено</th>
                        <th className="text-center py-3 px-4 font-medium">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((quote) => (
                        <tr key={quote.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 font-medium">{quote.quote_number}</td>
                          <td className="py-3 px-4 max-w-[200px] truncate">
                            {quote.customer_name}
                          </td>
                          <td className="py-3 px-4 max-w-[250px] truncate">{quote.title}</td>
                          <td className="py-3 px-4 text-right">
                            {formatCurrency(quote.total_amount, quote.currency)}
                          </td>
                          <td className="py-3 px-4">{getStatusBadge(quote.status)}</td>
                          <td className="py-3 px-4">
                            {quote.quote_date
                              ? new Date(quote.quote_date).toLocaleDateString('ru-RU')
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {quote.deleted_at ? dayjs(quote.deleted_at).fromNow() : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRestore(quote.id)}
                                title="Восстановить"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Удалить навсегда"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Безвозвратно удалить КП?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Это действие нельзя отменить. КП будет удалено навсегда.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handlePermanentDelete(quote.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Удалить навсегда
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Всего: {totalCount} КП</p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      Назад
                    </Button>
                    <span className="text-sm">
                      Страница {currentPage} из {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Вперед
                    </Button>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(value: string) => {
                        setPageSize(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
