'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Eye } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchDashboard,
  updateDashboard,
  createWidget,
  updateWidget,
  deleteWidget,
} from '@/lib/api/dashboard-constructor-service';
import { DashboardGrid, WidgetPicker } from '@/components/dashboard-constructor';
import type { Dashboard, DashboardWidget, WidgetPosition, WidgetType } from '@/types/dashboard';

export default function DashboardEditPage() {
  const params = useParams();
  const router = useRouter();
  const dashboardId = params.id as string;

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Dashboard metadata editing
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Widget editing dialog
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);
  const [widgetDialogOpen, setWidgetDialogOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchDashboard(dashboardId);
      setDashboard(data);
      setName(data.name);
      setDescription(data.description || '');
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error('Не удалось загрузить дашборд');
    } finally {
      setIsLoading(false);
    }
  }, [dashboardId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Track changes
  useEffect(() => {
    if (dashboard) {
      const nameChanged = name !== dashboard.name;
      const descChanged = description !== (dashboard.description || '');
      setHasChanges(nameChanged || descChanged);
    }
  }, [name, description, dashboard]);

  const handleSave = async () => {
    if (!dashboard) return;

    try {
      setIsSaving(true);
      const updated = await updateDashboard(dashboardId, {
        name,
        description: description || undefined,
      });
      setDashboard(updated);
      setHasChanges(false);
      toast.success('Дашборд сохранен');
    } catch (error) {
      console.error('Failed to save dashboard:', error);
      toast.error('Не удалось сохранить дашборд');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddWidget = async (type: WidgetType) => {
    if (!dashboard) return;

    try {
      // Find the lowest available position
      const maxY = dashboard.widgets.reduce(
        (max, w) => Math.max(max, w.position.y + w.position.h),
        0
      );

      const defaultConfig = getDefaultConfig(type);
      const newWidget = await createWidget(dashboardId, {
        widget_type: type,
        title: getDefaultTitle(type),
        config: defaultConfig,
        position: { x: 0, y: maxY, w: 4, h: 3 },
        data_source: {
          type: 'aggregate',
          metric: type === 'kpi' ? 'sent_count' : 'all',
        },
      });

      setDashboard((prev) => (prev ? { ...prev, widgets: [...prev.widgets, newWidget] } : null));
      toast.success('Виджет добавлен');

      // Open editor for new widget
      setEditingWidget(newWidget);
      setWidgetDialogOpen(true);
    } catch (error) {
      console.error('Failed to add widget:', error);
      toast.error('Не удалось добавить виджет');
    }
  };

  const handleWidgetEdit = (widget: DashboardWidget) => {
    setEditingWidget(widget);
    setWidgetDialogOpen(true);
  };

  const handleWidgetDelete = async (widgetId: string) => {
    if (!dashboard) return;

    try {
      await deleteWidget(dashboardId, widgetId);
      setDashboard((prev) =>
        prev ? { ...prev, widgets: prev.widgets.filter((w) => w.id !== widgetId) } : null
      );
      toast.success('Виджет удален');
    } catch (error) {
      console.error('Failed to delete widget:', error);
      toast.error('Не удалось удалить виджет');
    }
  };

  const handleLayoutChange = async (positions: WidgetPosition[]) => {
    if (!dashboard) return;

    try {
      // Update positions in state
      const updatedWidgets = dashboard.widgets.map((widget, index) => ({
        ...widget,
        position: positions[index] || widget.position,
      }));

      setDashboard((prev) => (prev ? { ...prev, widgets: updatedWidgets } : null));

      // Persist position changes
      await Promise.all(
        updatedWidgets.map((widget) =>
          updateWidget(dashboardId, widget.id, {
            position: widget.position,
          })
        )
      );
    } catch (error) {
      console.error('Failed to update layout:', error);
      toast.error('Не удалось сохранить расположение');
    }
  };

  const handleWidgetSave = async (widgetData: Partial<DashboardWidget>) => {
    if (!editingWidget || !dashboard) return;

    try {
      const updated = await updateWidget(dashboardId, editingWidget.id, {
        title: widgetData.title,
        config: widgetData.config,
      });

      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              widgets: prev.widgets.map((w) => (w.id === updated.id ? updated : w)),
            }
          : null
      );

      setWidgetDialogOpen(false);
      setEditingWidget(null);
      toast.success('Виджет обновлен');
    } catch (error) {
      console.error('Failed to update widget:', error);
      toast.error('Не удалось обновить виджет');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-[600px] w-full" />
        </div>
        <div className="w-72 border-l p-4">
          <Skeleton className="h-6 w-24 mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-medium mb-2">Дашборд не найден</h2>
          <Button onClick={() => router.push('/dashboards')}>
            <ArrowLeft className="mr-2 h-4 w-4" />К списку дашбордов
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b p-4 flex items-center justify-between bg-background">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboards')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0 bg-transparent"
                placeholder="Название дашборда"
              />
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-sm text-muted-foreground border-0 p-0 h-auto focus-visible:ring-0 bg-transparent"
                placeholder="Описание (опционально)"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/dashboards/${dashboardId}`)}>
              <Eye className="mr-2 h-4 w-4" />
              Просмотр
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="flex-1 overflow-auto p-6">
          <DashboardGrid
            dashboard={dashboard}
            isEditing={true}
            onLayoutChange={handleLayoutChange}
            onWidgetEdit={handleWidgetEdit}
            onWidgetDelete={handleWidgetDelete}
          />
        </div>
      </div>

      {/* Sidebar - Widget Picker */}
      <div className="w-72 border-l bg-muted/30 p-4 overflow-auto">
        <WidgetPicker onAddWidget={handleAddWidget} />

        {/* Dashboard Info */}
        <Card className="mt-6 p-4">
          <h4 className="font-medium text-sm mb-2">Информация</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Виджетов: {dashboard.widgets.length}</p>
            <p>Создан: {new Date(dashboard.created_at).toLocaleDateString('ru-RU')}</p>
            <p>Обновлен: {new Date(dashboard.updated_at).toLocaleDateString('ru-RU')}</p>
          </div>
        </Card>
      </div>

      {/* Widget Edit Dialog */}
      <WidgetEditDialog
        widget={editingWidget}
        open={widgetDialogOpen}
        onOpenChange={setWidgetDialogOpen}
        onSave={handleWidgetSave}
      />
    </div>
  );
}

interface WidgetEditDialogProps {
  widget: DashboardWidget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<DashboardWidget>) => void;
}

function WidgetEditDialog({ widget, open, onOpenChange, onSave }: WidgetEditDialogProps) {
  const [title, setTitle] = useState('');
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (widget) {
      setTitle(widget.title);
      setConfig(widget.config as Record<string, unknown>);
    }
  }, [widget]);

  if (!widget) return null;

  const handleSave = () => {
    onSave({
      title,
      config: config || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Настройки виджета</DialogTitle>
          <DialogDescription>Настройте отображение и данные виджета</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="widget-title">Заголовок</Label>
            <Input
              id="widget-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название виджета"
            />
          </div>

          {/* Config fields based on widget type */}
          {widget.widget_type === 'kpi' && <KPIConfigFields config={config} onChange={setConfig} />}

          {widget.widget_type === 'chart' && (
            <ChartConfigFields config={config} onChange={setConfig} />
          )}

          {widget.widget_type === 'table' && (
            <TableConfigFields config={config} onChange={setConfig} />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ConfigFieldsProps {
  config: Record<string, unknown> | null;
  onChange: (config: Record<string, unknown>) => void;
}

function KPIConfigFields({ config, onChange }: ConfigFieldsProps) {
  return (
    <div className="space-y-2">
      <Label>Метрика</Label>
      <select
        className="w-full p-2 border rounded-md"
        value={(config?.metric as string) || 'total_sent'}
        onChange={(e) => onChange({ ...config, metric: e.target.value })}
      >
        <option value="total_sent">Всего отправлено</option>
        <option value="total_delivered">Доставлено</option>
        <option value="total_opened">Открыто</option>
        <option value="total_clicked">Кликов</option>
        <option value="total_replied">Ответов</option>
        <option value="total_bounced">Отказов</option>
        <option value="avg_open_rate">Средний Open Rate</option>
        <option value="avg_reply_rate">Средний Reply Rate</option>
      </select>
    </div>
  );
}

function ChartConfigFields({ config, onChange }: ConfigFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Тип графика</Label>
        <select
          className="w-full p-2 border rounded-md"
          value={(config?.chart_type as string) || 'line'}
          onChange={(e) => onChange({ ...config, chart_type: e.target.value })}
        >
          <option value="line">Линейный</option>
          <option value="bar">Столбчатый</option>
          <option value="pie">Круговой</option>
          <option value="area">Область</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label>Метрика для отображения</Label>
        <select
          className="w-full p-2 border rounded-md"
          value={(config?.y_field as string) || 'sent'}
          onChange={(e) => onChange({ ...config, y_field: e.target.value })}
        >
          <option value="sent">Отправлено</option>
          <option value="delivered">Доставлено</option>
          <option value="opened">Открыто</option>
          <option value="clicked">Кликов</option>
          <option value="replied">Ответов</option>
        </select>
      </div>
    </div>
  );
}

function TableConfigFields({ config, onChange }: ConfigFieldsProps) {
  const allColumns = [
    { value: 'campaign_name', label: 'Кампания' },
    { value: 'sent', label: 'Отправлено' },
    { value: 'delivered', label: 'Доставлено' },
    { value: 'opened', label: 'Открыто' },
    { value: 'clicked', label: 'Кликов' },
    { value: 'replied', label: 'Ответов' },
    { value: 'open_rate', label: 'Open Rate' },
    { value: 'reply_rate', label: 'Reply Rate' },
  ];

  const selectedColumns = (config?.columns as string[]) || [
    'campaign_name',
    'sent',
    'opened',
    'replied',
  ];

  const toggleColumn = (column: string) => {
    const newColumns = selectedColumns.includes(column)
      ? selectedColumns.filter((c) => c !== column)
      : [...selectedColumns, column];
    onChange({ ...config, columns: newColumns });
  };

  return (
    <div className="space-y-2">
      <Label>Столбцы</Label>
      <div className="grid grid-cols-2 gap-2">
        {allColumns.map((col) => (
          <label key={col.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedColumns.includes(col.value)}
              onChange={() => toggleColumn(col.value)}
            />
            {col.label}
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * Get default config for widget type
 */
function getDefaultConfig(type: WidgetType): Record<string, unknown> {
  switch (type) {
    case 'kpi':
      return {
        format: 'number',
        show_trend: true,
        trend_period: 'week',
        decimal_places: 0,
      };
    case 'chart':
      return {
        chart_type: 'line',
        show_legend: true,
        show_labels: true,
        stacked: false,
      };
    case 'table':
      return {
        columns: ['campaign_name', 'sent', 'opened', 'replied'],
        sortable: true,
        paginated: true,
        page_size: 10,
      };
    case 'filter':
      return {
        filter_type: 'date_range',
        target_widgets: [],
      };
    default:
      return {};
  }
}

/**
 * Get default title for widget type
 */
function getDefaultTitle(type: WidgetType): string {
  switch (type) {
    case 'kpi':
      return 'KPI Метрика';
    case 'chart':
      return 'График';
    case 'table':
      return 'Таблица кампаний';
    case 'filter':
      return 'Фильтр';
    default:
      return 'Новый виджет';
  }
}
