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

const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  draft: {
    label: 'Черновик',
    dotColor: 'bg-gray-400',
    bgColor: 'bg-gray-400/10',
    textColor: 'text-gray-400',
  },
  awaiting_financial_approval: {
    label: 'На утверждении',
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-500',
  },
  financially_approved: {
    label: 'Утверждено',
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-500',
  },
  rejected_by_finance: {
    label: 'Отклонено',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-500',
  },
  sent_back_for_revision: {
    label: 'На доработке',
    dotColor: 'bg-purple-500',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-500',
  },
  ready_to_send: {
    label: 'Готово к отправке',
    dotColor: 'bg-cyan-500',
    bgColor: 'bg-cyan-500/10',
    textColor: 'text-cyan-500',
  },
  sent_to_customer: {
    label: 'Отправлено',
    dotColor: 'bg-blue-500',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-500',
  },
  accepted_by_customer: {
    label: 'Принято',
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-500',
  },
  rejected_by_customer: {
    label: 'Отклонено клиентом',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-500',
  },
  expired: {
    label: 'Истекло',
    dotColor: 'bg-gray-500',
    bgColor: 'bg-gray-500/10',
    textColor: 'text-gray-500',
  },
  cancelled: {
    label: 'Отменено',
    dotColor: 'bg-gray-500',
    bgColor: 'bg-gray-500/10',
    textColor: 'text-gray-500',
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
