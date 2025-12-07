'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Edit,
  Send,
  CheckCircle,
  PlusCircle,
  List,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';
import {
  DashboardService,
  type DashboardStats,
  type RecentQuote,
} from '@/lib/api/dashboard-service';
import { useAuth } from '@/lib/auth/AuthProvider';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format currency for Russian locale
 */
const formatCurrency = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Calculate percentage
 */
const calculatePercentage = (part: number, total: number): string => {
  if (total === 0) return '0.0';
  return ((part / total) * 100).toFixed(1);
};

/**
 * Get status badge configuration
 */
const getStatusBadge = (
  status: string
): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
  const config: Record<
    string,
    { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    draft: { text: 'Черновик', variant: 'secondary' },
    sent: { text: 'Отправлено', variant: 'default' },
    accepted: { text: 'Утверждено', variant: 'default' },
    rejected: { text: 'Отклонено', variant: 'destructive' },
    expired: { text: 'Истек срок', variant: 'outline' },
  };
  return config[status] || { text: status, variant: 'secondary' };
};

/**
 * Format date to DD.MM format
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${month}`;
};

// ============================================================================
// STATISTIC CARD COMPONENT
// ============================================================================

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  percentage?: string;
}

function StatCard({ title, value, icon, color, percentage }: StatCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-semibold" style={{ color }}>
                {value}
              </p>
              {percentage && <span className="text-sm text-muted-foreground">({percentage}%)</span>}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-muted/50" style={{ color }}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// DASHBOARD PAGE COMPONENT
// ============================================================================

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/login');
      } else {
        loadDashboardStats();
      }
    }
  }, [user, authLoading, router]);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await DashboardService.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
      setError('Не удалось загрузить данные панели');
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while checking auth
  if (authLoading || loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-semibold mb-6">Панель управления</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-4">
          <div className="lg:col-span-3">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Последние котировки</CardTitle>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-2">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Быстрые действия</CardTitle>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-semibold mb-6">Панель управления</h2>
        <Card className="bg-card border-border border-destructive/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Ошибка загрузки</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={loadDashboardStats}>
                Повторить
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-6">Панель управления</h2>

      {/* Row 1: Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Всего котировок"
          value={stats.total_quotes}
          icon={<FileText className="h-5 w-5" />}
          color="#3b82f6"
        />
        <StatCard
          title="Черновики"
          value={stats.draft_quotes}
          icon={<Edit className="h-5 w-5" />}
          color="#f59e0b"
          percentage={
            stats.total_quotes > 0
              ? calculatePercentage(stats.draft_quotes, stats.total_quotes)
              : undefined
          }
        />
        <StatCard
          title="Отправлено"
          value={stats.sent_quotes}
          icon={<Send className="h-5 w-5" />}
          color="#3b82f6"
          percentage={
            stats.total_quotes > 0
              ? calculatePercentage(stats.sent_quotes, stats.total_quotes)
              : undefined
          }
        />
        <StatCard
          title="Утверждено"
          value={stats.accepted_quotes}
          icon={<CheckCircle className="h-5 w-5" />}
          color="#22c55e"
          percentage={
            stats.total_quotes > 0
              ? calculatePercentage(stats.accepted_quotes, stats.total_quotes)
              : undefined
          }
        />
      </div>

      {/* Row 2: Revenue and Recent Quotes */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-4">
        <div className="lg:col-span-3">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-medium">Последние котировки</CardTitle>
              <Button
                variant="link"
                className="text-primary p-0 h-auto"
                onClick={() => router.push('/quotes')}
              >
                Все КП
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Номер</TableHead>
                    <TableHead>Клиент</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-center">Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recent_quotes.map((quote: RecentQuote) => {
                    const badge = getStatusBadge(quote.status);
                    return (
                      <TableRow
                        key={quote.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/quotes/${quote.id}`)}
                      >
                        <TableCell className="font-medium text-primary">
                          {quote.quote_number}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {quote.customer_name}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(quote.total_amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.text}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {formatDate(quote.created_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base font-medium">Выручка за месяц</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-primary">
                {formatCurrency(stats.revenue_this_month)}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-sm text-muted-foreground">vs предыдущий месяц</span>
                <span
                  className={`flex items-center gap-1 text-sm font-medium ${
                    stats.revenue_trend >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {stats.revenue_trend >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {Math.abs(stats.revenue_trend).toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base font-medium">Быстрые действия</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full justify-start gap-2"
                onClick={() => router.push('/quotes/create')}
              >
                <PlusCircle className="h-4 w-4" />
                Создать КП
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => router.push('/quotes')}
              >
                <List className="h-4 w-4" />
                Все КП
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
