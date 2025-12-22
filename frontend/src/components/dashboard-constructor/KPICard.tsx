'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KPIWidgetConfig } from '@/types/dashboard';

interface KPICardProps {
  value: number;
  previousValue?: number;
  config: KPIWidgetConfig;
  label?: string;
}

/**
 * KPI Card widget for displaying single metrics
 * Supports number, percent, and currency formats with trend indicator
 */
export function KPICard({ value, previousValue, config, label }: KPICardProps) {
  const formattedValue = formatValue(value, config);
  const trend = previousValue !== undefined ? calculateTrend(value, previousValue) : null;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      {/* Main Value */}
      <div className="text-3xl font-bold text-foreground">
        {config.prefix}
        {formattedValue}
        {config.suffix}
      </div>

      {/* Label */}
      {label && <div className="text-sm text-muted-foreground mt-1">{label}</div>}

      {/* Trend Indicator */}
      {config.show_trend && trend !== null && (
        <TrendIndicator value={trend} period={config.trend_period} />
      )}
    </div>
  );
}

function formatValue(value: number, config: KPIWidgetConfig): string {
  const { format, decimal_places } = config;

  switch (format) {
    case 'percent':
      return `${value.toFixed(decimal_places)}%`;
    case 'currency':
      return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: decimal_places,
        maximumFractionDigits: decimal_places,
      }).format(value);
    case 'number':
    default:
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: decimal_places,
        maximumFractionDigits: decimal_places,
      }).format(value);
  }
}

function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

interface TrendIndicatorProps {
  value: number;
  period: 'day' | 'week' | 'month';
}

function TrendIndicator({ value, period }: TrendIndicatorProps) {
  const periodLabel = {
    day: 'за день',
    week: 'за неделю',
    month: 'за месяц',
  }[period];

  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <div
      className={cn(
        'flex items-center gap-1 mt-2 text-sm',
        isPositive && 'text-green-600',
        !isPositive && !isNeutral && 'text-red-600',
        isNeutral && 'text-muted-foreground'
      )}
    >
      {isPositive ? (
        <TrendingUp className="h-4 w-4" />
      ) : isNeutral ? (
        <Minus className="h-4 w-4" />
      ) : (
        <TrendingDown className="h-4 w-4" />
      )}
      <span>
        {isPositive && '+'}
        {value.toFixed(1)}% {periodLabel}
      </span>
    </div>
  );
}

export default KPICard;
