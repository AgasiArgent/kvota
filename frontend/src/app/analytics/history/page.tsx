'use client';

import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import {
  Download,
  History,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getExecutionHistory,
  downloadExecutionFile,
  type ReportExecution,
  type PaginatedResponse,
} from '@/lib/api/analytics-service';

// File format icons
const FormatIcon = ({ format }: { format: string }) => {
  switch (format) {
    case 'xlsx':
      return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
    case 'csv':
    case 'json':
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

export default function ExecutionHistoryPage() {
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [executions, setExecutions] = useState<ReportExecution[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [executionTypeFilter, setExecutionTypeFilter] = useState<string>('');

  // Detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<ReportExecution | null>(null);

  // Load executions
  const loadExecutions = useCallback(
    async (page: number = 1, pageSize: number = 50) => {
      try {
        setLoading(true);
        const data: PaginatedResponse<ReportExecution> = await getExecutionHistory(page, pageSize);

        // Apply client-side filters
        let filtered = data.items;

        if (dateFrom && dateTo) {
          filtered = filtered.filter((exec) => {
            const execDate = dayjs(exec.executed_at);
            const start = dayjs(dateFrom).startOf('day');
            const end = dayjs(dateTo).endOf('day');
            return execDate.isAfter(start) && execDate.isBefore(end);
          });
        }

        if (executionTypeFilter) {
          filtered = filtered.filter((exec) => exec.execution_type === executionTypeFilter);
        }

        setExecutions(filtered);
        setPagination({
          current: data.page,
          pageSize: data.page_size,
          total: filtered.length,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Ошибка загрузки истории');
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    },
    [dateFrom, dateTo, executionTypeFilter]
  );

  // Apply filters
  const handleApplyFilters = useCallback(() => {
    loadExecutions(1, pagination.pageSize);
  }, [loadExecutions, pagination.pageSize]);

  // Reset filters
  const handleResetFilters = useCallback(() => {
    setDateFrom('');
    setDateTo('');
    setExecutionTypeFilter('');
    loadExecutions(1, pagination.pageSize);
  }, [loadExecutions, pagination.pageSize]);

  useEffect(() => {
    loadExecutions();
  }, [loadExecutions]);

  // Download file
  const handleDownload = useCallback(async (execution: ReportExecution) => {
    if (!execution.export_file_url) {
      toast.warning('Файл недоступен');
      return;
    }

    try {
      const blob = await downloadExecutionFile(execution.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const timestamp = dayjs(execution.executed_at).format('YYYYMMDD_HHmmss');
      const format = execution.export_format || 'xlsx';
      link.download = `analytics_${timestamp}_history.${format}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Файл скачан');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка скачивания');
    }
  }, []);

  // Show detail
  const handleShowDetail = useCallback((execution: ReportExecution) => {
    setSelectedExecution(execution);
    setDetailModalOpen(true);
  }, []);

  // Check if file is expired
  const isFileExpired = useCallback((execution: ReportExecution): boolean => {
    if (!execution.file_expires_at) return false;
    return dayjs(execution.file_expires_at).isBefore(dayjs());
  }, []);

  // Format file size
  const formatFileSize = useCallback((bytes?: number): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'manual':
        return 'Вручную';
      case 'scheduled':
        return 'Расписание';
      case 'api':
        return 'API';
      default:
        return type;
    }
  };

  if (pageLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-[80vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={<History className="h-6 w-6" />}
          title="История выполнений"
          description="Журнал всех выполненных запросов и отчётов"
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Дата от</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Дата до</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Тип выполнения</Label>
            <Select value={executionTypeFilter} onValueChange={setExecutionTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Вручную</SelectItem>
                <SelectItem value="scheduled">По расписанию</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleApplyFilters}>Применить</Button>
          <Button variant="outline" onClick={handleResetFilters}>
            Сбросить
          </Button>
        </div>

        {/* Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : executions.length === 0 ? (
              <div className="p-8 text-center">
                <History className="mx-auto h-12 w-12 text-foreground/20 mb-4" />
                <p className="text-foreground/40">Нет записей</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-secondary/30 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Дата и время
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Отчёт
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Тип
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Записей
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Файл
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Время
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {executions.map((exec) => {
                      const expired = isFileExpired(exec);

                      return (
                        <tr key={exec.id} className="hover:bg-foreground/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-sm">
                              {dayjs(exec.executed_at).format('DD.MM.YYYY')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {dayjs(exec.executed_at).format('HH:mm:ss')}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm">{exec.report_name || 'Разовый запрос'}</div>
                            {exec.saved_report_id && (
                              <div className="text-xs text-muted-foreground">
                                ID: {exec.saved_report_id.slice(0, 8)}...
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary">{getTypeLabel(exec.execution_type)}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {exec.quote_count.toLocaleString('ru-RU')}
                          </td>
                          <td className="px-4 py-3">
                            {exec.export_file_url ? (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <FormatIcon format={exec.export_format || 'xlsx'} />
                                  <span className="text-sm">
                                    {exec.export_format?.toUpperCase()}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatFileSize(exec.file_size_bytes)}
                                </div>
                                {expired && (
                                  <Badge variant="destructive" className="mt-1">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Истёк
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground/70">
                            {exec.execution_time_ms
                              ? exec.execution_time_ms < 1000
                                ? `${exec.execution_time_ms} мс`
                                : `${(exec.execution_time_ms / 1000).toFixed(2)} сек`
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleShowDetail(exec)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Детали
                              </Button>
                              {exec.export_file_url && !expired && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleDownload(exec)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && pagination.total > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Всего: {pagination.total} записей
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.current === 1}
                    onClick={() => loadExecutions(pagination.current - 1, pagination.pageSize)}
                  >
                    Назад
                  </Button>
                  <span className="text-sm text-muted-foreground">Стр. {pagination.current}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.current * pagination.pageSize >= pagination.total}
                    onClick={() => loadExecutions(pagination.current + 1, pagination.pageSize)}
                  >
                    Далее
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Детали выполнения</DialogTitle>
          </DialogHeader>

          {selectedExecution && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">ID</Label>
                  <p className="text-sm font-mono">{selectedExecution.id}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Тип выполнения</Label>
                  <p className="text-sm">
                    <Badge variant="secondary">
                      {getTypeLabel(selectedExecution.execution_type)}
                    </Badge>
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Дата и время</Label>
                  <p className="text-sm">
                    {dayjs(selectedExecution.executed_at).format('DD.MM.YYYY HH:mm:ss')}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Записей найдено</Label>
                  <p className="text-sm">{selectedExecution.quote_count.toLocaleString('ru-RU')}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Время выполнения</Label>
                  <p className="text-sm">
                    {selectedExecution.execution_time_ms
                      ? selectedExecution.execution_time_ms < 1000
                        ? `${selectedExecution.execution_time_ms} мс`
                        : `${(selectedExecution.execution_time_ms / 1000).toFixed(2)} сек`
                      : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Формат файла</Label>
                  <p className="text-sm">{selectedExecution.export_format?.toUpperCase() || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Размер файла</Label>
                  <p className="text-sm">{formatFileSize(selectedExecution.file_size_bytes)}</p>
                </div>
              </div>

              {/* Result Summary */}
              {Object.keys(selectedExecution.result_summary).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Результаты агрегации</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2 p-3 bg-secondary/30 rounded-lg">
                    {Object.entries(selectedExecution.result_summary).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-xs text-muted-foreground">{key}: </span>
                        <span className="text-sm">
                          {typeof value === 'number'
                            ? value.toLocaleString('ru-RU')
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filters Used */}
              {Object.keys(selectedExecution.filters).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Применённые фильтры</Label>
                  <pre className="mt-2 text-xs bg-secondary/30 p-3 rounded-lg overflow-auto">
                    {JSON.stringify(selectedExecution.filters, null, 2)}
                  </pre>
                </div>
              )}

              {/* Selected Fields */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  Выбранные поля ({selectedExecution.selected_fields.length})
                </Label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedExecution.selected_fields.map((field) => (
                    <Badge key={field} variant="outline">
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailModalOpen(false)}>
              Закрыть
            </Button>
            {selectedExecution?.export_file_url && !isFileExpired(selectedExecution) && (
              <Button onClick={() => selectedExecution && handleDownload(selectedExecution)}>
                <Download className="h-4 w-4 mr-2" />
                Скачать файл
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
