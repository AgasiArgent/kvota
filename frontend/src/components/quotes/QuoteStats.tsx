import React from 'react';
import StatCard from '@/components/shared/StatCard';
import { cn } from '@/lib/utils';

interface QuoteStatsProps {
  totalQuotes: number;
  approvedQuotes: number;
  pendingQuotes: number;
  totalProfitUsd: number;
  className?: string;
}

export default function QuoteStats({
  totalQuotes,
  approvedQuotes,
  pendingQuotes,
  totalProfitUsd,
  className,
}: QuoteStatsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className={cn('grid grid-cols-2 gap-4 lg:grid-cols-4', className)}>
      <StatCard label="Всего КП" value={totalQuotes} />
      <StatCard label="Утверждено" value={approvedQuotes} valueClassName="text-emerald-400" />
      <StatCard label="На утверждении" value={pendingQuotes} valueClassName="text-amber-400" />
      <StatCard
        label="Прибыль"
        value={formatCurrency(totalProfitUsd)}
        valueClassName={totalProfitUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}
      />
    </div>
  );
}
