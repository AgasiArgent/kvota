'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Plus, Search, MoreVertical, Edit, Trash2, LayoutDashboard, Eye } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchDashboards,
  createDashboard,
  deleteDashboard,
} from '@/lib/api/dashboard-constructor-service';
import type { DashboardSummary } from '@/types/dashboard';

export default function DashboardsListPage() {
  const router = useRouter();
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dashboardToDelete, setDashboardToDelete] = useState<DashboardSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadDashboards = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetchDashboards(1, 100, searchQuery || undefined);
      setDashboards(response.dashboards);
    } catch (error) {
      console.error('Failed to load dashboards:', error);
      toast.error('Не удалось загрузить дашборды');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadDashboards();
  }, [loadDashboards]);

  const handleCreateDashboard = async () => {
    try {
      const newDashboard = await createDashboard({
        name: 'Новый дашборд',
        description: '',
      });
      toast.success('Дашборд создан');
      router.push(`/dashboards/${newDashboard.id}/edit`);
    } catch (error) {
      console.error('Failed to create dashboard:', error);
      toast.error('Не удалось создать дашборд');
    }
  };

  const handleDeleteClick = (dashboard: DashboardSummary) => {
    setDashboardToDelete(dashboard);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!dashboardToDelete) return;

    try {
      setIsDeleting(true);
      await deleteDashboard(dashboardToDelete.id);
      toast.success('Дашборд удален');
      setDashboards((prev) => prev.filter((d) => d.id !== dashboardToDelete.id));
    } catch (error) {
      console.error('Failed to delete dashboard:', error);
      toast.error('Не удалось удалить дашборд');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDashboardToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Дашборды</h1>
          <p className="text-muted-foreground">Визуализация данных email-кампаний</p>
        </div>
        <Button onClick={handleCreateDashboard}>
          <Plus className="mr-2 h-4 w-4" />
          Создать дашборд
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск дашбордов..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Dashboard Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : dashboards.length === 0 ? (
        <Card className="py-12">
          <div className="text-center">
            <LayoutDashboard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Нет дашбордов</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? 'По вашему запросу ничего не найдено'
                : 'Создайте первый дашборд для визуализации данных кампаний'}
            </p>
            {!searchQuery && (
              <Button onClick={handleCreateDashboard}>
                <Plus className="mr-2 h-4 w-4" />
                Создать дашборд
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((dashboard) => (
            <Card
              key={dashboard.id}
              className="group hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/dashboards/${dashboard.id}`)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium line-clamp-1">
                  {dashboard.name}
                </CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboards/${dashboard.id}`);
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Просмотр
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboards/${dashboard.id}/edit`);
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Редактировать
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(dashboard);
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                {dashboard.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {dashboard.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{dashboard.widget_count} виджетов</span>
                  <span>Обновлен {formatDate(dashboard.updated_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить дашборд?</AlertDialogTitle>
            <AlertDialogDescription>
              Дашборд &quot;{dashboardToDelete?.name}&quot; будет удален безвозвратно. Это действие
              нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
