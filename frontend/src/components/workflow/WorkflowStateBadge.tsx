'use client';

import { Badge } from '@/components/ui/badge';
import { FileText, ShoppingCart, Truck, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type WorkflowState =
  | 'draft'
  | 'awaiting_procurement'
  | 'awaiting_logistics_customs'
  | 'awaiting_sales_review'
  | 'awaiting_financial_approval'
  | 'financially_approved'
  | 'sent_back_for_revision'
  | 'rejected_by_finance'
  | 'awaiting_senior_approval'
  | 'approved'
  | 'rejected';

interface WorkflowStateBadgeProps {
  state: WorkflowState;
  size?: 'small' | 'default' | 'large';
}

const STATE_CONFIG: Record<
  WorkflowState,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className: string;
    icon: React.ReactNode;
  }
> = {
  draft: {
    label: 'Черновик',
    variant: 'secondary',
    className: '',
    icon: <FileText className="h-3 w-3" />,
  },
  awaiting_procurement: {
    label: 'Ожидает закупки',
    variant: 'default',
    className: 'bg-blue-600 hover:bg-blue-600',
    icon: <ShoppingCart className="h-3 w-3" />,
  },
  awaiting_logistics_customs: {
    label: 'Логистика и таможня',
    variant: 'default',
    className: 'bg-cyan-600 hover:bg-cyan-600',
    icon: <Truck className="h-3 w-3" />,
  },
  awaiting_sales_review: {
    label: 'Проверка продаж',
    variant: 'default',
    className: 'bg-blue-600 hover:bg-blue-600',
    icon: <FileText className="h-3 w-3" />,
  },
  awaiting_financial_approval: {
    label: 'Финансовое утверждение',
    variant: 'default',
    className: 'bg-orange-600 hover:bg-orange-600',
    icon: <DollarSign className="h-3 w-3" />,
  },
  financially_approved: {
    label: 'Финансово утверждено',
    variant: 'default',
    className: 'bg-green-600 hover:bg-green-600',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  sent_back_for_revision: {
    label: 'На доработке',
    variant: 'default',
    className: 'bg-purple-600 hover:bg-purple-600',
    icon: <XCircle className="h-3 w-3" />,
  },
  rejected_by_finance: {
    label: 'Отклонено финансами',
    variant: 'destructive',
    className: '',
    icon: <XCircle className="h-3 w-3" />,
  },
  awaiting_senior_approval: {
    label: 'Подпись руководства',
    variant: 'default',
    className: 'bg-amber-600 hover:bg-amber-600',
    icon: <DollarSign className="h-3 w-3" />,
  },
  approved: {
    label: 'Утверждено',
    variant: 'default',
    className: 'bg-green-600 hover:bg-green-600',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  rejected: {
    label: 'Отклонено',
    variant: 'destructive',
    className: '',
    icon: <XCircle className="h-3 w-3" />,
  },
};

export default function WorkflowStateBadge({ state, size = 'default' }: WorkflowStateBadgeProps) {
  const config = STATE_CONFIG[state];

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'gap-1',
        size === 'small' && 'text-xs px-1.5 py-0',
        size === 'large' && 'text-sm px-3 py-1',
        config.className
      )}
    >
      {config.icon}
      {config.label}
    </Badge>
  );
}
