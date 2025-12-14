'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, X, Eye, Clock, CheckCircle, FileText, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { QuoteService } from '@/lib/api/quote-service';
import { useAuth } from '@/lib/auth/AuthProvider';
import { toast } from 'sonner';

interface Quote {
  id: string;
  idn_quote: string; // Renamed from quote_number
  customer_name: string;
  title: string;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
  submitted_for_approval_at: string;
}

export default function QuoteApprovalPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const quoteService = new QuoteService();

  useEffect(() => {
    // Check if user has manager role
    const managerRoles = [
      'finance_manager',
      'department_manager',
      'director',
      'admin',
      'procurement_manager',
      'customs_manager',
      'logistics_manager',
    ];

    if (!profile?.role || !managerRoles.includes(profile.role)) {
      toast.error('У вас нет прав для доступа к этой странице');
      router.push('/dashboard');
      return;
    }

    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    setLoading(true);
    try {
      // TODO: Implement with organizationId from auth context
      // const organizationId = profile?.organization_id || '';
      // const response = await quoteService.getQuotes(organizationId,
      //   { status: 'pending_approval,partially_approved' },
      //   { page: 1, limit: 100 }
      // );
      // if (response.success && response.data) {
      //   setQuotes(response.data.quotes || []);
      // }
      setQuotes([]); // Temporary: empty list
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast.error(`Ошибка загрузки КП: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async () => {
    if (!selectedQuote) return;

    setActionLoading(true);
    try {
      // In real implementation, call API to approve/reject
      // await quoteService.approveQuote(selectedQuote.id, approvalAction, approvalNotes)

      toast.success(
        approvalAction === 'approve'
          ? `КП ${selectedQuote.idn_quote} утверждено`
          : `КП ${selectedQuote.idn_quote} отклонено`
      );

      setApprovalModalVisible(false);
      setApprovalNotes('');
      setSelectedQuote(null);
      fetchPendingApprovals();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast.error(`Ошибка: ${errorMessage}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<
      string,
      { variant: 'default' | 'secondary' | 'destructive' | 'outline'; text: string }
    > = {
      pending_approval: { variant: 'default', text: 'На утверждении' },
      partially_approved: { variant: 'outline', text: 'Частично утверждено' },
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

  const pendingCount = quotes.filter((q) => q.status === 'pending_approval').length;
  const partialCount = quotes.filter((q) => q.status === 'partially_approved').length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold">КП на утверждении</h1>
          <p className="text-muted-foreground">
            Коммерческие предложения, ожидающие вашего утверждения
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Clock className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Ожидают утверждения</p>
                  <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <CheckCircle className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Частично утверждено</p>
                  <p className="text-2xl font-bold">{partialCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Нет КП, ожидающих утверждения</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Номер КП</th>
                      <th className="text-left py-3 px-4 font-medium">Клиент</th>
                      <th className="text-left py-3 px-4 font-medium">Название</th>
                      <th className="text-right py-3 px-4 font-medium">Сумма</th>
                      <th className="text-left py-3 px-4 font-medium">Статус</th>
                      <th className="text-left py-3 px-4 font-medium">Отправлено на утв.</th>
                      <th className="text-center py-3 px-4 font-medium">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((quote) => {
                      const daysSince = quote.submitted_for_approval_at
                        ? Math.floor(
                            (new Date().getTime() -
                              new Date(quote.submitted_for_approval_at).getTime()) /
                              (1000 * 60 * 60 * 24)
                          )
                        : null;

                      return (
                        <tr key={quote.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <button
                              onClick={() => router.push(`/quotes/${quote.id}`)}
                              className="font-medium text-primary hover:underline"
                            >
                              {quote.idn_quote}
                            </button>
                          </td>
                          <td className="py-3 px-4 max-w-[200px] truncate">
                            {quote.customer_name}
                          </td>
                          <td className="py-3 px-4 max-w-[250px] truncate">{quote.title}</td>
                          <td className="py-3 px-4 text-right">
                            {formatCurrency(quote.total_amount, quote.currency)}
                          </td>
                          <td className="py-3 px-4">{getStatusBadge(quote.status)}</td>
                          <td className="py-3 px-4">
                            {quote.submitted_for_approval_at ? (
                              <div>
                                <p>
                                  {new Date(quote.submitted_for_approval_at).toLocaleDateString(
                                    'ru-RU'
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {daysSince === 0
                                    ? 'Сегодня'
                                    : `${daysSince} ${daysSince === 1 ? 'день' : 'дней'} назад`}
                                </p>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/quotes/${quote.id}`)}
                                title="Просмотр"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedQuote(quote);
                                  setApprovalAction('approve');
                                  setApprovalModalVisible(true);
                                }}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Утвердить
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setSelectedQuote(quote);
                                  setApprovalAction('reject');
                                  setApprovalModalVisible(true);
                                }}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Отклонить
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approval Modal */}
      <Dialog open={approvalModalVisible} onOpenChange={setApprovalModalVisible}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve'
                ? `Утвердить КП ${selectedQuote?.idn_quote}`
                : `Отклонить КП ${selectedQuote?.idn_quote}`}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === 'approve'
                ? 'Подтвердите утверждение коммерческого предложения'
                : 'Укажите причину отклонения коммерческого предложения'}
            </DialogDescription>
          </DialogHeader>

          {selectedQuote && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div>
                  <span className="font-medium">Клиент:</span> {selectedQuote.customer_name}
                </div>
                <div>
                  <span className="font-medium">Название:</span> {selectedQuote.title}
                </div>
                <div>
                  <span className="font-medium">Сумма:</span>{' '}
                  <span className="text-lg">
                    {formatCurrency(selectedQuote.total_amount, selectedQuote.currency)}
                  </span>
                </div>
              </div>

              <Textarea
                rows={4}
                placeholder={
                  approvalAction === 'approve'
                    ? 'Комментарий (необязательно)'
                    : 'Укажите причину отклонения'
                }
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
              />

              {approvalAction === 'reject' && (
                <p className="text-amber-600 text-sm">
                  После отклонения КП вернется автору для доработки
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setApprovalModalVisible(false);
                setApprovalNotes('');
                setSelectedQuote(null);
              }}
            >
              Отмена
            </Button>
            <Button
              variant={approvalAction === 'reject' ? 'destructive' : 'default'}
              onClick={handleApproval}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {approvalAction === 'approve' ? 'Утвердить' : 'Отклонить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
