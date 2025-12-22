'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Hash, BarChart3, Table2, Filter, Plus } from 'lucide-react';
import type { WidgetType } from '@/types/dashboard';
import { getWidgetTypeLabel } from '@/types/dashboard';

interface WidgetPickerProps {
  onAddWidget: (type: WidgetType) => void;
}

interface WidgetOption {
  type: WidgetType;
  icon: React.ReactNode;
  description: string;
}

const WIDGET_OPTIONS: WidgetOption[] = [
  {
    type: 'kpi',
    icon: <Hash className="h-6 w-6" />,
    description: 'Одна метрика с трендом',
  },
  {
    type: 'chart',
    icon: <BarChart3 className="h-6 w-6" />,
    description: 'Линейный, столбчатый или круговой',
  },
  {
    type: 'table',
    icon: <Table2 className="h-6 w-6" />,
    description: 'Табличные данные с сортировкой',
  },
  {
    type: 'filter',
    icon: <Filter className="h-6 w-6" />,
    description: 'Фильтр для всего дашборда',
  },
];

/**
 * Widget picker sidebar for adding new widgets in edit mode
 */
export function WidgetPicker({ onAddWidget }: WidgetPickerProps) {
  return (
    <div className="space-y-3">
      <h3 className="font-medium text-sm">Добавить виджет</h3>
      <div className="grid gap-2">
        {WIDGET_OPTIONS.map((option) => (
          <Card
            key={option.type}
            className="p-3 cursor-pointer hover:bg-accent transition-colors"
            onClick={() => onAddWidget(option.type)}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">{option.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{getWidgetTypeLabel(option.type)}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default WidgetPicker;
