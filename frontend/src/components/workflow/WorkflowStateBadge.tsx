'use client';

import { Tag } from 'antd';
import {
  FileTextOutlined,
  ShoppingCartOutlined,
  CarOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';

type WorkflowState =
  | 'draft'
  | 'awaiting_procurement'
  | 'awaiting_logistics_customs'
  | 'awaiting_sales_review'
  | 'awaiting_financial_approval'
  | 'awaiting_senior_approval'
  | 'approved'
  | 'rejected';

interface WorkflowStateBadgeProps {
  state: WorkflowState;
  size?: 'small' | 'default' | 'large';
}

const STATE_CONFIG = {
  draft: {
    label: 'Черновик',
    color: 'default',
    icon: <FileTextOutlined />,
  },
  awaiting_procurement: {
    label: 'Ожидает закупки',
    color: 'blue',
    icon: <ShoppingCartOutlined />,
  },
  awaiting_logistics_customs: {
    label: 'Логистика и таможня',
    color: 'cyan',
    icon: <CarOutlined />,
  },
  awaiting_sales_review: {
    label: 'Проверка продаж',
    color: 'blue',
    icon: <FileTextOutlined />,
  },
  awaiting_financial_approval: {
    label: 'Финансовое утверждение',
    color: 'orange',
    icon: <DollarOutlined />,
  },
  awaiting_senior_approval: {
    label: 'Подпись руководства',
    color: 'gold',
    icon: <DollarOutlined />,
  },
  approved: {
    label: 'Утверждено',
    color: 'success',
    icon: <CheckCircleOutlined />,
  },
  rejected: {
    label: 'Отклонено',
    color: 'error',
    icon: <CloseCircleOutlined />,
  },
};

export default function WorkflowStateBadge({ state, size = 'default' }: WorkflowStateBadgeProps) {
  const config = STATE_CONFIG[state];

  return (
    <Tag color={config.color} icon={config.icon} style={{ fontSize: size === 'small' ? 12 : 14 }}>
      {config.label}
    </Tag>
  );
}
