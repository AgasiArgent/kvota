import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    positive: boolean;
  };
  className?: string;
  valueClassName?: string;
}

export default function StatCard({
  label,
  value,
  trend,
  className,
  valueClassName,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border/50 bg-card/50 p-5',
        'backdrop-blur-sm',
        className
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-foreground/60">{label}</p>
      <p className={cn('mt-2 text-2xl font-semibold tabular-nums tracking-tight', valueClassName)}>
        {value}
      </p>
      {trend && (
        <p
          className={cn(
            'mt-2 text-xs font-medium',
            trend.positive ? 'text-emerald-400' : 'text-red-400'
          )}
        >
          {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </p>
      )}
    </div>
  );
}
