'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, FileSearch, Download, Filter, X, Eye } from 'lucide-react';
import dayjs from 'dayjs';
import Link from 'next/link';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  activityLogService,
  ActivityLog,
  ActivityLogFilters,
} from '@/lib/api/activity-log-service';

export default function ActivityLogPage() {
  // ============================================================================
  // STATE
  // ============================================================================

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  // Filter state - using native date strings (YYYY-MM-DD format)
  const [dateFrom, setDateFrom] = useState<string>(
    dayjs().subtract(7, 'days').format('YYYY-MM-DD')
  );
  const [dateTo, setDateTo] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [userFilter, setUserFilter] = useState<string | undefined>(undefined);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string | undefined>(undefined);
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);

  // Pagination state
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
  });

  // Available users (for filter dropdown)
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ id: string; name: string; email: string }>
  >([]);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchLogs = useCallback(async () => {
    setLoading(true);

    try {
      const filters: ActivityLogFilters = {
        date_from: dateFrom,
        date_to: dateTo,
        user_id: userFilter,
        entity_type: entityTypeFilter,
        action: actionFilter,
        page: pagination.current,
        per_page: pagination.pageSize,
      };

      const response = await activityLogService.list(filters);

      if (response.success && response.data) {
        setLogs(response.data.items);
        setTotal(response.data.total);
      } else {
        toast.error(response.error || 'Ошибка загрузки логов');
        setLogs([]);
        setTotal(0);
      }
    } catch {
      toast.error('Ошибка загрузки логов');
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, userFilter, entityTypeFilter, actionFilter, pagination]);

  const fetchUsers = async () => {
    const response = await activityLogService.getUsers();
    if (response.success && response.data) {
      // Backend returns {users: Array}, extract the array
      const usersData = (response.data as any).users || response.data;
      setAvailableUsers(Array.isArray(usersData) ? usersData : []);
    }
  };

  // Initial load
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Fetch users for filter dropdown
  useEffect(() => {
    fetchUsers();
  }, []);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleApplyFilters = () => {
    setPagination({ ...pagination, current: 1 });
    fetchLogs();
  };

  const handleResetFilters = () => {
    setDateFrom(dayjs().subtract(7, 'days').format('YYYY-MM-DD'));
    setDateTo(dayjs().format('YYYY-MM-DD'));
    setUserFilter(undefined);
    setEntityTypeFilter(undefined);
    setActionFilter(undefined);
    setPagination({ current: 1, pageSize: 50 });
  };

  const handleViewMetadata = (log: ActivityLog) => {
    setSelectedLog(log);
    setDrawerOpen(true);
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.warning('Нет данных для экспорта');
      return;
    }

    // Generate CSV content
    const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Metadata'];
    const rows = logs.map((log) => [
      formatTimestamp(log.created_at),
      log.user_email || log.user_name || log.user_id,
      activityLogService.formatAction(log.action),
      activityLogService.formatEntityType(log.entity_type),
      log.entity_id || '',
      log.metadata ? JSON.stringify(log.metadata) : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const filename = `activity_log_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('CSV файл загружен');
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const formatTimestamp = (isoString: string) => {
    return dayjs(isoString).format('DD.MM.YYYY HH:mm:ss');
  };

  const getActionBadge = (action: string) => {
    const color = activityLogService.getActionColor(action);
    const text = activityLogService.formatAction(action);

    // Map ant design colors to badge variants/styles
    const dotColorMap: Record<string, string> = {
      blue: 'bg-blue-400',
      green: 'bg-emerald-400',
      red: 'bg-rose-400',
      orange: 'bg-amber-400',
      purple: 'bg-purple-400',
    };

    const dotColor = dotColorMap[color] || 'bg-zinc-400';

    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotColor)} />
        {text}
      </Badge>
    );
  };

  const hasActiveFilters =
    userFilter ||
    entityTypeFilter ||
    actionFilter ||
    dateFrom !== dayjs().subtract(7, 'days').format('YYYY-MM-DD') ||
    dateTo !== dayjs().format('YYYY-MM-DD');

  // ============================================================================
  // STATS CALCULATIONS
  // ============================================================================

  const totalActions = logs.length;
  const uniqueUsers = new Set(logs.map((log) => log.user_id)).size;
  const createdActions = logs.filter((log) => log.action === 'created').length;
  const updatedActions = logs.filter((log) => log.action === 'updated').length;

  // ============================================================================
  // DATE PRESETS
  // ============================================================================

  const applyDatePreset = (preset: 'today' | '7days' | '30days' | 'thisMonth') => {
    const today = dayjs();
    switch (preset) {
      case 'today':
        setDateFrom(today.format('YYYY-MM-DD'));
        setDateTo(today.format('YYYY-MM-DD'));
        break;
      case '7days':
        setDateFrom(today.subtract(7, 'days').format('YYYY-MM-DD'));
        setDateTo(today.format('YYYY-MM-DD'));
        break;
      case '30days':
        setDateFrom(today.subtract(30, 'days').format('YYYY-MM-DD'));
        setDateTo(today.format('YYYY-MM-DD'));
        break;
      case 'thisMonth':
        setDateFrom(today.startOf('month').format('YYYY-MM-DD'));
        setDateTo(today.format('YYYY-MM-DD'));
        break;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader title="История действий" description="Журнал всех операций в системе" />

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Всего действий" value={totalActions} />
          <StatCard label="Активных пользователей" value={uniqueUsers} />
          <StatCard label="Создано" value={createdActions} valueClassName="text-emerald-400" />
          <StatCard label="Обновлено" value={updatedActions} valueClassName="text-amber-400" />
        </div>

        {/* Filters Card */}
        <div className="rounded-lg border border-border/50 bg-card/30 p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Date Range Filter */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-foreground/60">Период:</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[150px] bg-background/50 border-border/50"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[150px] bg-background/50 border-border/50"
                />
              </div>
            </div>

            {/* User Filter */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-foreground/60">Пользователь:</Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-[200px] bg-background/50 border-border/50">
                  <SelectValue placeholder="Все пользователи" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Entity Type Filter */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-foreground/60">Тип сущности:</Label>
              <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                <SelectTrigger className="w-[150px] bg-background/50 border-border/50">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quote">Котировка</SelectItem>
                  <SelectItem value="customer">Клиент</SelectItem>
                  <SelectItem value="contact">Контакт</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Filter */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-foreground/60">Действие:</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[150px] bg-background/50 border-border/50">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">Создано</SelectItem>
                  <SelectItem value="updated">Обновлено</SelectItem>
                  <SelectItem value="deleted">Удалено</SelectItem>
                  <SelectItem value="restored">Восстановлено</SelectItem>
                  <SelectItem value="exported">Экспортировано</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-end gap-2 ml-auto">
              <Button onClick={handleApplyFilters} variant="default">
                <Filter className="mr-2 h-4 w-4" />
                Применить фильтры
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-9 px-3 text-foreground/50 hover:text-foreground hover:bg-background/50"
                >
                  <X className="mr-1.5 h-4 w-4" />
                  Сбросить
                </Button>
              )}
              <Button variant="outline" onClick={fetchLogs}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Обновить
              </Button>
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Экспорт CSV
              </Button>
            </div>
          </div>

          {/* Date Presets */}
          <div className="flex gap-2">
            <span className="text-xs text-foreground/50">Быстрый выбор:</span>
            <button
              onClick={() => applyDatePreset('today')}
              className="text-xs text-foreground/60 hover:text-foreground transition-colors"
            >
              Сегодня
            </button>
            <span className="text-foreground/30">•</span>
            <button
              onClick={() => applyDatePreset('7days')}
              className="text-xs text-foreground/60 hover:text-foreground transition-colors"
            >
              Последние 7 дней
            </button>
            <span className="text-foreground/30">•</span>
            <button
              onClick={() => applyDatePreset('30days')}
              className="text-xs text-foreground/60 hover:text-foreground transition-colors"
            >
              Последние 30 дней
            </button>
            <span className="text-foreground/30">•</span>
            <button
              onClick={() => applyDatePreset('thisMonth')}
              className="text-xs text-foreground/60 hover:text-foreground transition-colors"
            >
              Этот месяц
            </button>
          </div>
        </div>

        {/* Table Card */}
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <FileSearch className="mx-auto h-12 w-12 text-foreground/20 mb-4" />
              <p className="text-foreground/40">Нет записей за выбранный период</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/30 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Время
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Пользователь
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Действие
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Тип сущности
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Детали
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Метаданные
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => {
                    const link = activityLogService.getEntityLink(log);
                    const displayText = log.metadata?.quote_number || log.entity_id?.slice(0, 8);

                    return (
                      <tr key={log.id} className="hover:bg-foreground/5 transition-colors">
                        <td className="px-4 py-3 text-sm text-foreground/70">
                          {formatTimestamp(log.created_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/70">
                          {log.user_name || log.user_email || log.user_id}
                        </td>
                        <td className="px-4 py-3">{getActionBadge(log.action)}</td>
                        <td className="px-4 py-3 text-sm text-foreground/70">
                          {activityLogService.formatEntityType(log.entity_type)}
                        </td>
                        <td className="px-4 py-3">
                          {link && log.entity_id ? (
                            <Link
                              href={link}
                              className="text-amber-400 hover:text-amber-500 transition-colors"
                            >
                              {displayText}
                            </Link>
                          ) : (
                            <span className="text-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewMetadata(log)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/20">
              <div className="text-sm text-foreground/60">
                Показано {(pagination.current - 1) * pagination.pageSize + 1}–
                {Math.min(pagination.current * pagination.pageSize, total)} из {total} записей
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current === 1}
                  onClick={() =>
                    setPagination((p) => ({ ...p, current: Math.max(1, p.current - 1) }))
                  }
                >
                  Назад
                </Button>
                <span className="text-sm text-foreground/60">
                  Страница {pagination.current} из {Math.ceil(total / pagination.pageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current >= Math.ceil(total / pagination.pageSize)}
                  onClick={() => setPagination((p) => ({ ...p, current: p.current + 1 }))}
                >
                  Далее
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metadata Dialog */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Детали действия</DialogTitle>
            <DialogDescription>Подробная информация о записи в журнале</DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="mt-6 space-y-6">
              <div>
                <span className="text-sm font-medium text-foreground/60">Время:</span>
                <div className="mt-1 text-sm">{formatTimestamp(selectedLog.created_at)}</div>
              </div>

              <div>
                <span className="text-sm font-medium text-foreground/60">Пользователь:</span>
                <div className="mt-1">
                  {selectedLog.user_name && <div className="text-sm">{selectedLog.user_name}</div>}
                  {selectedLog.user_email && (
                    <div className="text-sm text-foreground/50">{selectedLog.user_email}</div>
                  )}
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-foreground/60">Действие:</span>
                <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
              </div>

              <div>
                <span className="text-sm font-medium text-foreground/60">Тип сущности:</span>
                <div className="mt-1 text-sm">
                  {activityLogService.formatEntityType(selectedLog.entity_type)}
                </div>
              </div>

              {selectedLog.entity_id && (
                <div>
                  <span className="text-sm font-medium text-foreground/60">ID сущности:</span>
                  <div className="mt-1">
                    <code className="text-xs bg-secondary/50 px-2 py-1 rounded">
                      {selectedLog.entity_id}
                    </code>
                  </div>
                </div>
              )}

              {selectedLog.metadata && (
                <div>
                  <span className="text-sm font-medium text-foreground/60">Метаданные:</span>
                  <pre className="mt-2 text-xs bg-secondary/30 p-3 rounded overflow-auto max-h-[400px]">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
