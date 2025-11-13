'use client';

import { Card, Steps, Row, Col, Space, Typography, Alert, Progress } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import WorkflowStateBadge from './WorkflowStateBadge';
import type { WorkflowStatus } from '@/lib/api/workflow-service';

const { Text, Title } = Typography;

interface WorkflowStatusCardProps {
  workflow: WorkflowStatus;
  workflowMode: 'simple' | 'multi_role';
}

const MULTI_ROLE_STEPS = [
  { title: 'Черновик', description: 'Создание КП' },
  { title: 'Закупки', description: 'Цены и условия' },
  { title: 'Логистика/Таможня', description: 'Расходы' },
  { title: 'Продажи', description: 'Наценка' },
  { title: 'Финансы', description: 'Утверждение' },
  { title: 'Руководство', description: 'Подпись' },
  { title: 'Готово', description: 'Утверждено' },
];

const SIMPLE_STEPS = [
  { title: 'Черновик', description: 'Создание КП' },
  { title: 'Финансы', description: 'Утверждение' },
  { title: 'Руководство', description: 'Подпись' },
  { title: 'Готово', description: 'Утверждено' },
];

function getCurrentStepIndex(state: string, mode: string): number {
  if (mode === 'multi_role') {
    const stateToStep: Record<string, number> = {
      draft: 0,
      awaiting_procurement: 1,
      awaiting_logistics_customs: 2,
      awaiting_sales_review: 3,
      awaiting_financial_approval: 4,
      awaiting_senior_approval: 5,
      approved: 6,
      rejected: 6,
    };
    return stateToStep[state] || 0;
  } else {
    const stateToStep: Record<string, number> = {
      draft: 0,
      awaiting_financial_approval: 1,
      awaiting_senior_approval: 2,
      approved: 3,
      rejected: 3,
    };
    return stateToStep[state] || 0;
  }
}

function getRoleLabel(role?: string): string {
  const labels: Record<string, string> = {
    sales_manager: 'Менеджер по продажам',
    procurement_manager: 'Менеджер по закупкам',
    logistics_manager: 'Менеджер по логистике',
    customs_manager: 'Таможенный менеджер',
    financial_manager: 'Финансовый менеджер',
    ceo: 'Генеральный директор',
    cfo: 'Финансовый директор',
    top_sales_manager: 'Руководитель продаж',
  };
  return labels[role || ''] || role || 'Не назначено';
}

export default function WorkflowStatusCard({ workflow, workflowMode }: WorkflowStatusCardProps) {
  const steps = workflowMode === 'multi_role' ? MULTI_ROLE_STEPS : SIMPLE_STEPS;
  const currentStep = getCurrentStepIndex(workflow.current_state, workflowMode);
  const stepStatus = workflow.current_state === 'rejected' ? 'error' : 'process';

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Current status */}
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <WorkflowStateBadge state={workflow.current_state} />
              {workflow.current_assignee_role && (
                <Text type="secondary">
                  Назначено: <Text strong>{getRoleLabel(workflow.current_assignee_role)}</Text>
                </Text>
              )}
            </Space>
          </Col>
        </Row>

        {/* Progress steps */}
        <Steps current={currentStep} status={stepStatus} items={steps} size="small" />

        {/* Parallel tasks indicator */}
        {workflow.current_state === 'awaiting_logistics_customs' &&
          workflowMode === 'multi_role' && (
            <Row gutter={16}>
              <Col span={12}>
                <Card
                  size="small"
                  style={{
                    backgroundColor: workflow.logistics_complete ? '#f6ffed' : '#fff',
                    borderColor: workflow.logistics_complete ? '#52c41a' : '#d9d9d9',
                  }}
                >
                  <Space>
                    {workflow.logistics_complete ? (
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    ) : (
                      <ClockCircleOutlined style={{ color: '#faad14' }} />
                    )}
                    <Text>Логистика</Text>
                  </Space>
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  size="small"
                  style={{
                    backgroundColor: workflow.customs_complete ? '#f6ffed' : '#fff',
                    borderColor: workflow.customs_complete ? '#52c41a' : '#d9d9d9',
                  }}
                >
                  <Space>
                    {workflow.customs_complete ? (
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    ) : (
                      <ClockCircleOutlined style={{ color: '#faad14' }} />
                    )}
                    <Text>Таможня</Text>
                  </Space>
                </Card>
              </Col>
            </Row>
          )}

        {/* Multi-senior approval progress */}
        {workflow.current_state === 'awaiting_senior_approval' &&
          workflow.senior_approvals_required > 1 && (
            <Alert
              message={`Требуется ${workflow.senior_approvals_required} утверждений`}
              description={
                <Progress
                  percent={
                    (workflow.senior_approvals_received / workflow.senior_approvals_required) * 100
                  }
                  format={() =>
                    `${workflow.senior_approvals_received} из ${workflow.senior_approvals_required}`
                  }
                />
              }
              type="info"
              showIcon
            />
          )}
      </Space>
    </Card>
  );
}
