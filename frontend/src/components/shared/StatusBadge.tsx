import React from 'react';
import { cn } from '@/lib/utils';

type StatusType =
  | 'draft'
  | 'awaiting_financial_approval'
  | 'financially_approved'
  | 'rejected_by_finance'
  | 'sent_back_for_revision'
  | 'ready_to_send'
  | 'sent_to_customer'
  | 'accepted_by_customer'
  | 'rejected_by_customer'
  | 'expired'
  | 'cancelled';

interface StatusConfig {
  label: string;
  dotColor: string;
  bgColor: string;
  textColor: string;
}

// Using 400 variants for better contrast on dark backgrounds
const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  draft: {
    label: 'Черновик',
    dotColor: 'bg-zinc-400',
    bgColor: 'bg-zinc-400/15',
    textColor: 'text-zinc-400',
  },
  awaiting_financial_approval: {
    label: 'На утверждении',
    dotColor: 'bg-amber-400',
    bgColor: 'bg-amber-400/15',
    textColor: 'text-amber-400',
  },
  financially_approved: {
    label: 'Утверждено',
    dotColor: 'bg-emerald-400',
    bgColor: 'bg-emerald-400/15',
    textColor: 'text-emerald-400',
  },
  rejected_by_finance: {
    label: 'Отклонено',
    dotColor: 'bg-red-400',
    bgColor: 'bg-red-400/15',
    textColor: 'text-red-400',
  },
  sent_back_for_revision: {
    label: 'На доработке',
    dotColor: 'bg-violet-400',
    bgColor: 'bg-violet-400/15',
    textColor: 'text-violet-400',
  },
  ready_to_send: {
    label: 'Готово к отправке',
    dotColor: 'bg-sky-400',
    bgColor: 'bg-sky-400/15',
    textColor: 'text-sky-400',
  },
  sent_to_customer: {
    label: 'Отправлено',
    dotColor: 'bg-blue-400',
    bgColor: 'bg-blue-400/15',
    textColor: 'text-blue-400',
  },
  accepted_by_customer: {
    label: 'Принято',
    dotColor: 'bg-emerald-400',
    bgColor: 'bg-emerald-400/15',
    textColor: 'text-emerald-400',
  },
  rejected_by_customer: {
    label: 'Отклонено клиентом',
    dotColor: 'bg-red-400',
    bgColor: 'bg-red-400/15',
    textColor: 'text-red-400',
  },
  expired: {
    label: 'Истекло',
    dotColor: 'bg-zinc-500',
    bgColor: 'bg-zinc-500/15',
    textColor: 'text-zinc-500',
  },
  cancelled: {
    label: 'Отменено',
    dotColor: 'bg-zinc-500',
    bgColor: 'bg-zinc-500/15',
    textColor: 'text-zinc-500',
  },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as StatusType] || {
    label: status,
    dotColor: 'bg-gray-400',
    bgColor: 'bg-gray-400/10',
    textColor: 'text-gray-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.bgColor,
        config.textColor,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
      {config.label}
    </span>
  );
}
