'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { PlayCircle, Edit2, Copy, Trash2, Eye, Search } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import {
  getSavedReports,
  deleteSavedReport,
  updateSavedReport,
  createSavedReport,
  type SavedReport,
} from '@/lib/api/analytics-service';

export default function SavedReportsPage() {
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<SavedReport[]>([]);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'personal' | 'shared'>('all');
  const [searchText, setSearchText] = useState('');

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<SavedReport | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState<'personal' | 'shared'>('personal');

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  // Load reports
  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSavedReports();
      setReports(data);
      setFilteredReports(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка загрузки отчётов');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Apply filters
  useEffect(() => {
    let filtered = reports;

    // Filter by visibility
    if (visibilityFilter !== 'all') {
      filtered = filtered.filter((r) => r.visibility === visibilityFilter);
    }

    // Filter by search text
    if (searchText) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(lower) ||
          (r.description && r.description.toLowerCase().includes(lower))
      );
    }

    setFilteredReports(filtered);
  }, [reports, visibilityFilter, searchText]);

  // Delete report
  const handleDeleteClick = useCallback((id: string) => {
    setDeletingReportId(id);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingReportId) return;

    try {
      await deleteSavedReport(deletingReportId);
      toast.success('Отчёт удалён');
      loadReports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка удаления');
    } finally {
      setDeleteDialogOpen(false);
      setDeletingReportId(null);
    }
  }, [deletingReportId, loadReports]);

  // Clone report
  const handleClone = useCallback(
    async (report: SavedReport) => {
      try {
        await createSavedReport({
          name: `${report.name} (копия)`,
          description: report.description,
          filters: report.filters,
          selected_fields: report.selected_fields,
          aggregations: report.aggregations,
          visibility: 'personal',
        });
        toast.success('Отчёт скопирован');
        loadReports();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Ошибка копирования');
      }
    },
    [loadReports]
  );

  // Edit report
  const handleEdit = useCallback((report: SavedReport) => {
    setEditingReport(report);
    setEditName(report.name);
    setEditDescription(report.description || '');
    setEditVisibility(report.visibility);
    setEditModalOpen(true);
  }, []);

  // Save edit
  const handleSaveEdit = useCallback(async () => {
    if (!editingReport) return;
    if (!editName.trim()) {
      toast.error('Введите название');
      return;
    }

    try {
      await updateSavedReport(editingReport.id, {
        name: editName,
        description: editDescription || undefined,
        visibility: editVisibility,
      });
      toast.success('Отчёт обновлён');
      setEditModalOpen(false);
      setEditingReport(null);
      loadReports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка обновления');
    }
  }, [editingReport, editName, editDescription, editVisibility, loadReports]);

  // Run report (navigate to analytics page with filters loaded)
  const handleRun = useCallback(
    (report: SavedReport) => {
      // Store report in localStorage for analytics page to load
      localStorage.setItem('analytics_load_report', JSON.stringify(report));
      router.push('/analytics');
    },
    [router]
  );

  if (pageLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <PageHeader title="Сохранённые отчёты" description="Управление шаблонами отчётов" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader title="Сохранённые отчёты" description="Управление шаблонами отчётов" />

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию или описанию"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={visibilityFilter}
            onValueChange={(value: any) => setVisibilityFilter(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все отчёты</SelectItem>
              <SelectItem value="personal">Личные</SelectItem>
              <SelectItem value="shared">Общие</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reports Table */}
        <div className="rounded-md border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Название</th>
                  <th className="px-4 py-3 text-left text-sm font-medium w-[120px]">Видимость</th>
                  <th className="px-4 py-3 text-left text-sm font-medium w-[160px]">Создан</th>
                  <th className="px-4 py-3 text-left text-sm font-medium w-[160px]">Обновлён</th>
                  <th className="px-4 py-3 text-left text-sm font-medium w-[280px]">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3" colSpan={5}>
                        <Skeleton className="h-12 w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredReports.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                      Нет сохранённых отчётов
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{report.name}</div>
                          {report.description && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {report.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={report.visibility === 'shared' ? 'default' : 'secondary'}>
                          {report.visibility === 'shared' ? 'Общий' : 'Личный'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {dayjs(report.created_at).format('DD.MM.YYYY HH:mm')}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {dayjs(report.updated_at).format('DD.MM.YYYY HH:mm')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => handleRun(report)} className="gap-1">
                            <PlayCircle className="h-4 w-4" />
                            Запустить
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEdit(report)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleClone(report)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteClick(report.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination info */}
          {!loading && filteredReports.length > 0 && (
            <div className="border-t px-4 py-3 text-sm text-muted-foreground">
              Всего: {filteredReports.length}
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать отчёт</DialogTitle>
            <DialogDescription>Измените параметры сохранённого отчёта</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Название</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Название отчёта"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Описание</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Описание отчёта"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-visibility">Видимость</Label>
              <Select
                value={editVisibility}
                onValueChange={(value: any) => setEditVisibility(value)}
              >
                <SelectTrigger id="edit-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Личный</SelectItem>
                  <SelectItem value="shared">Общий (доступен всем в организации)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditModalOpen(false);
                setEditingReport(null);
              }}
            >
              Отмена
            </Button>
            <Button onClick={handleSaveEdit}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить отчёт?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Отчёт будет удалён навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
