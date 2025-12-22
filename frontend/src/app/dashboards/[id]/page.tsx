'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { fetchDashboard } from '@/lib/api/dashboard-constructor-service';
import { fetchAggregatedMetrics } from '@/lib/api/campaign-service';
import { DashboardGrid } from '@/components/dashboard-constructor';
import type { Dashboard } from '@/types/dashboard';

export default function DashboardViewPage() {
  const params = useParams();
  const router = useRouter();
  const dashboardId = params.id as string;

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgetData, setWidgetData] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchDashboard(dashboardId);
      setDashboard(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error('Не удалось загрузить дашборд');
    } finally {
      setIsLoading(false);
    }
  }, [dashboardId]);

  const loadWidgetData = useCallback(async () => {
    if (!dashboard) return;

    try {
      setIsRefreshing(true);

      // Fetch aggregated metrics for KPI and chart widgets
      const metrics = await fetchAggregatedMetrics();

      // Map metrics to widgets based on their configuration
      const data: Record<string, unknown> = {};

      for (const widget of dashboard.widgets) {
        switch (widget.widget_type) {
          case 'kpi': {
            const config = widget.config as { metric: string };
            data[widget.id] = metrics[config.metric as keyof typeof metrics] ?? 0;
            break;
          }
          case 'chart': {
            // For charts, we'd need time-series data
            // This is a placeholder - real implementation would fetch from API
            data[widget.id] = generateChartData();
            break;
          }
          case 'table': {
            // For tables, we'd fetch campaign data
            // This is a placeholder
            data[widget.id] = [];
            break;
          }
          case 'filter': {
            // Filters don't need pre-loaded data
            data[widget.id] = null;
            break;
          }
        }
      }

      setWidgetData(data);
    } catch (error) {
      console.error('Failed to load widget data:', error);
      toast.error('Не удалось загрузить данные виджетов');
    } finally {
      setIsRefreshing(false);
    }
  }, [dashboard]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (dashboard) {
      loadWidgetData();
    }
  }, [dashboard, loadWidgetData]);

  const handleRefresh = () => {
    loadWidgetData();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-medium mb-2">Дашборд не найден</h2>
          <p className="text-muted-foreground mb-4">
            Возможно, он был удален или у вас нет доступа
          </p>
          <Button onClick={() => router.push('/dashboards')}>
            <ArrowLeft className="mr-2 h-4 w-4" />К списку дашбордов
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboards')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{dashboard.name}</h1>
            {dashboard.description && (
              <p className="text-muted-foreground">{dashboard.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Обновить данные
          </Button>
          <Button onClick={() => router.push(`/dashboards/${dashboardId}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Редактировать
          </Button>
        </div>
      </div>

      {/* Dashboard Grid */}
      <DashboardGrid dashboard={dashboard} isEditing={false} widgetData={widgetData} />
    </div>
  );
}

/**
 * Generate sample chart data for demonstration
 * In production, this would come from the API
 */
function generateChartData() {
  const now = new Date();
  const data = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.floor(Math.random() * 100) + 50,
    });
  }

  return data;
}
