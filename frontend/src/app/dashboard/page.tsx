'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  CheckCircle,
  Clock,
  DollarSign,
  Trophy,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth/AuthProvider';
import { cn } from '@/lib/utils';

interface Quote {
  id: string;
  quote_number: string;
  customer_name: string;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalQuotes: 0,
    approvedQuotes: 0,
    pendingQuotes: 0,
    totalRevenue: 0,
    monthlyGrowth: 12.5,
    totalCustomers: 0,
  });
  const [recentQuotes, setRecentQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // TODO: Implement dashboard data fetching with proper organizationId context
      setStats({
        totalQuotes: 0,
        approvedQuotes: 0,
        pendingQuotes: 0,
        totalRevenue: 0,
        monthlyGrowth: 0,
        totalCustomers: 0,
      });
      setRecentQuotes([]);
    } catch (error: any) {
      toast.error(`Ошибка загрузки данных: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { dotColor: string; text: string }> = {
      draft: { dotColor: 'bg-zinc-400', text: 'Черновик' },
      pending_approval: { dotColor: 'bg-amber-400', text: 'На утверждении' },
      approved: { dotColor: 'bg-emerald-400', text: 'Утверждено' },
      sent: { dotColor: 'bg-blue-400', text: 'Отправлено' },
      accepted: { dotColor: 'bg-green-400', text: 'Принято' },
      rejected: { dotColor: 'bg-rose-400', text: 'Отклонено' },
      expired: { dotColor: 'bg-gray-400', text: 'Истекло' },
    };
    const config = statusMap[status] || { dotColor: 'bg-zinc-400', text: status };
    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
        {config.text}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getRoleWelcome = () => {
    const roleMessages = {
      sales_manager: 'Создавайте и отправляйте коммерческие предложения',
      finance_manager: 'Утверждайте КП и контролируйте финансовые показатели',
      department_manager: 'Управляйте процессами утверждения в отделе',
      director: 'Контролируйте все бизнес-процессы компании',
      admin: 'Администрируйте систему и управляйте пользователями',
    };
    return roleMessages[profile?.role as keyof typeof roleMessages] || 'Добро пожаловать в систему';
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Добро пожаловать, {profile?.full_name || 'Пользователь'}!
          </h1>
          <p className="mt-1 text-base text-foreground/60">{getRoleWelcome()}</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Всего КП" value={stats.totalQuotes} />
          <StatCard label="Утверждено" value={stats.approvedQuotes} />
          <StatCard label="На утверждении" value={stats.pendingQuotes} />
          <StatCard
            label="Общая выручка"
            value={formatCurrency(stats.totalRevenue, 'RUB')}
            valueClassName="text-xl"
          />
        </div>

        {/* Performance and Quick Actions */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Эффективность за месяц</CardTitle>
              <CardAction>
                <Button variant="ghost" size="sm">
                  Подробнее
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Monthly Growth */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Рост продаж</span>
                  <span className="flex items-center gap-1 text-sm font-medium text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                    {stats.monthlyGrowth}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary/30">
                  <div
                    className="h-2 rounded-full bg-amber-500 transition-all"
                    style={{ width: `${Math.min(stats.monthlyGrowth, 100)}%` }}
                  />
                </div>
              </div>

              <Separator />

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-foreground/60">
                    Конверсия КП
                  </p>
                  <p className="mt-2 text-xl font-semibold tabular-nums">68.5%</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-foreground/60">
                    Среднее время утверждения
                  </p>
                  <p className="mt-2 text-xl font-semibold tabular-nums">
                    2.3 <span className="text-sm font-normal text-foreground/60">дня</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Быстрые действия</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full justify-start"
                variant="default"
                size="lg"
                onClick={() => router.push('/quotes/create')}
              >
                Создать новое КП
              </Button>

              {profile?.role &&
                ['finance_manager', 'department_manager', 'director', 'admin'].includes(
                  profile.role
                ) && (
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    size="lg"
                    onClick={() => router.push('/quotes/approval')}
                  >
                    Проверить КП на утверждении ({stats.pendingQuotes})
                  </Button>
                )}

              <Button
                className="w-full justify-start"
                variant="outline"
                size="lg"
                onClick={() => router.push('/customers')}
              >
                Управление клиентами
              </Button>

              <Button
                className="w-full justify-start"
                variant="outline"
                size="lg"
                onClick={() => router.push('/quotes')}
              >
                Просмотреть все КП
              </Button>

              <Separator />

              {/* Goal Section */}
              <div className="space-y-3 rounded-lg bg-secondary/20 p-4 text-center">
                <Trophy className="mx-auto h-6 w-6 text-amber-500" />
                <div>
                  <p className="font-semibold">Цель месяца</p>
                  <p className="text-sm text-foreground/60">200 КП (выполнено 78%)</p>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary/30">
                  <div
                    className="h-2 rounded-full bg-amber-500 transition-all"
                    style={{ width: '78%' }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Quotes Table */}
        <Card>
          <CardHeader>
            <CardTitle>Последние коммерческие предложения</CardTitle>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/quotes')}
                className="gap-1"
              >
                Показать все
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {recentQuotes.length === 0 ? (
              <div className="py-12 text-center text-foreground/40">
                Нет коммерческих предложений
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Номер КП
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Клиент
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Сумма
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Статус
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Дата
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentQuotes.map((quote) => (
                      <tr
                        key={quote.id}
                        onClick={() => router.push(`/quotes/${quote.id}`)}
                        className="cursor-pointer transition-colors hover:bg-foreground/5"
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground/90">
                            {quote.quote_number}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/70">
                          {quote.customer_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/70">
                          {formatCurrency(quote.total_amount, quote.currency)}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(quote.status)}</td>
                        <td className="px-4 py-3 text-sm text-foreground/70">
                          {new Date(quote.created_at).toLocaleDateString('ru-RU')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
