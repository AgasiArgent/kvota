'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Settings, Trash2, GripVertical } from 'lucide-react';
import type { DashboardWidget, WidgetType } from '@/types/dashboard';

interface WidgetProps {
  widget: DashboardWidget;
  isEditing?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onEdit?: (widget: DashboardWidget) => void;
  onDelete?: (widgetId: string) => void;
  children: React.ReactNode;
}

/**
 * Base Widget wrapper component
 * Provides consistent styling, loading states, and edit controls
 */
export function Widget({
  widget,
  isEditing = false,
  isLoading = false,
  error = null,
  onEdit,
  onDelete,
  children,
}: WidgetProps) {
  return (
    <Card className="h-full flex flex-col overflow-hidden bg-card">
      {/* Widget Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          {isEditing && <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />}
          <h3 className="font-medium text-sm truncate">{widget.title}</h3>
        </div>

        {isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(widget)}>
                <Settings className="h-4 w-4 mr-2" />
                Настроить
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete?.(widget.id)} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Widget Content */}
      <div className="flex-1 p-4 overflow-auto">
        {isLoading ? (
          <WidgetSkeleton type={widget.widget_type} />
        ) : error ? (
          <WidgetError message={error} />
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

/**
 * Loading skeleton for widgets
 */
function WidgetSkeleton({ type }: { type: WidgetType }) {
  switch (type) {
    case 'kpi':
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      );
    case 'chart':
      return (
        <div className="flex items-end justify-around h-full gap-2 pt-4">
          {[60, 80, 40, 90, 50, 70].map((h, i) => (
            <Skeleton key={i} className="w-8" style={{ height: `${h}%` }} />
          ))}
        </div>
      );
    case 'table':
      return (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      );
    default:
      return <Skeleton className="h-full w-full" />;
  }
}

/**
 * Error display for widgets
 */
function WidgetError({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full text-center">
      <div className="text-destructive">
        <p className="text-sm font-medium">Ошибка загрузки</p>
        <p className="text-xs text-muted-foreground mt-1">{message}</p>
      </div>
    </div>
  );
}

export default Widget;
