'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ReactGridLayout = require('react-grid-layout');
const GridLayout = ReactGridLayout.default || ReactGridLayout;
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Widget } from './Widget';
import { KPICard } from './KPICard';
import { ChartWidget } from './ChartWidget';
import { TableWidget } from './TableWidget';
import { FilterWidget } from './FilterWidget';
import type {
  Dashboard,
  DashboardWidget,
  WidgetPosition,
  KPIWidgetConfig,
  ChartWidgetConfig,
  TableWidgetConfig,
  FilterWidgetConfig,
} from '@/types/dashboard';

// Layout item type for react-grid-layout
interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  static?: boolean;
}

interface DashboardGridProps {
  dashboard: Dashboard;
  isEditing?: boolean;
  widgetData?: Record<string, unknown>;
  onLayoutChange?: (layout: WidgetPosition[]) => void;
  onWidgetEdit?: (widget: DashboardWidget) => void;
  onWidgetDelete?: (widgetId: string) => void;
}

/**
 * Main dashboard grid component using react-grid-layout
 */
export function DashboardGrid({
  dashboard,
  isEditing = false,
  widgetData = {},
  onLayoutChange,
  onWidgetEdit,
  onWidgetDelete,
}: DashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  // Measure container width for responsive grid
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Convert widgets to grid layout format
  const layout: LayoutItem[] = dashboard.widgets.map((widget) => ({
    i: widget.id,
    x: widget.position.x,
    y: widget.position.y,
    w: widget.position.w,
    h: widget.position.h,
    minW: 2,
    minH: 2,
    static: !isEditing,
  }));

  const handleLayoutChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newLayout: any[]) => {
      if (!isEditing) return;

      const positions: WidgetPosition[] = newLayout.map((item) => ({
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      }));

      onLayoutChange?.(positions);
    },
    [isEditing, onLayoutChange]
  );

  if (dashboard.widgets.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">Пустой дашборд</p>
          <p className="text-sm">
            {isEditing ? 'Добавьте виджеты из панели справа' : 'В этом дашборде пока нет виджетов'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      {}
      <GridLayout
        className="layout"
        layout={layout as any}
        cols={12}
        rowHeight={100}
        width={containerWidth}
        isDraggable={isEditing}
        isResizable={isEditing}
        onLayoutChange={handleLayoutChange as any}
        draggableHandle=".cursor-grab"
        margin={[16, 16] as [number, number]}
      >
        {dashboard.widgets.map((widget) => (
          <div key={widget.id}>
            <Widget
              widget={widget}
              isEditing={isEditing}
              isLoading={!widgetData[widget.id]}
              onEdit={onWidgetEdit}
              onDelete={onWidgetDelete}
            >
              {renderWidgetContent(widget, widgetData[widget.id])}
            </Widget>
          </div>
        ))}
      </GridLayout>
    </div>
  );
}

/**
 * Render the appropriate widget component based on type
 */
function renderWidgetContent(widget: DashboardWidget, data: unknown) {
  switch (widget.widget_type) {
    case 'kpi':
      return (
        <KPICard
          value={typeof data === 'number' ? data : 0}
          config={widget.config as KPIWidgetConfig}
        />
      );

    case 'chart':
      return (
        <ChartWidget
          data={Array.isArray(data) ? data : []}
          config={widget.config as ChartWidgetConfig}
        />
      );

    case 'table':
      return (
        <TableWidget
          data={Array.isArray(data) ? data : []}
          config={widget.config as TableWidgetConfig}
        />
      );

    case 'filter':
      return <FilterWidget config={widget.config as FilterWidgetConfig} value={data} />;

    default:
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Неизвестный тип виджета
        </div>
      );
  }
}

export default DashboardGrid;
