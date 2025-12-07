'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, Info } from 'lucide-react';
import WorkflowStateBadge from './WorkflowStateBadge';
import type { WorkflowStatus } from '@/lib/api/workflow-service';
import { cn } from '@/lib/utils';

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

export function WorkflowStatusCard({ workflow, workflowMode }: WorkflowStatusCardProps) {
  const steps = workflowMode === 'multi_role' ? MULTI_ROLE_STEPS : SIMPLE_STEPS;
  const currentStep = getCurrentStepIndex(workflow.current_state, workflowMode);
  const isRejected = workflow.current_state === 'rejected';

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* Current status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WorkflowStateBadge state={workflow.current_state} />
            {workflow.current_assignee_role && (
              <span className="text-sm text-muted-foreground">
                Назначено:{' '}
                <span className="font-medium">{getRoleLabel(workflow.current_assignee_role)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-1">
          {steps.map((step, index) => (
            <div key={step.title} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2',
                    index < currentStep && 'bg-primary border-primary text-primary-foreground',
                    index === currentStep &&
                      !isRejected &&
                      'border-primary text-primary bg-primary/10',
                    index === currentStep &&
                      isRejected &&
                      'border-destructive text-destructive bg-destructive/10',
                    index > currentStep && 'border-muted-foreground/30 text-muted-foreground/50'
                  )}
                >
                  {index < currentStep ? <CheckCircle className="h-4 w-4" /> : index + 1}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      'text-xs font-medium',
                      index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-2 mt-[-1.5rem]',
                    index < currentStep ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Parallel tasks indicator */}
        {workflow.current_state === 'awaiting_logistics_customs' &&
          workflowMode === 'multi_role' && (
            <div className="grid grid-cols-2 gap-4">
              <div
                className={cn(
                  'p-3 rounded-lg border flex items-center gap-2',
                  workflow.logistics_complete
                    ? 'bg-green-500/10 border-green-500'
                    : 'bg-muted border-muted-foreground/30'
                )}
              >
                {workflow.logistics_complete ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Clock className="h-4 w-4 text-amber-500" />
                )}
                <span className="text-sm">Логистика</span>
              </div>
              <div
                className={cn(
                  'p-3 rounded-lg border flex items-center gap-2',
                  workflow.customs_complete
                    ? 'bg-green-500/10 border-green-500'
                    : 'bg-muted border-muted-foreground/30'
                )}
              >
                {workflow.customs_complete ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Clock className="h-4 w-4 text-amber-500" />
                )}
                <span className="text-sm">Таможня</span>
              </div>
            </div>
          )}

        {/* Multi-senior approval progress */}
        {workflow.current_state === 'awaiting_senior_approval' &&
          workflow.senior_approvals_required > 1 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Требуется {workflow.senior_approvals_required} утверждений</AlertTitle>
              <AlertDescription className="mt-2">
                <div className="flex items-center gap-3">
                  <Progress
                    value={
                      (workflow.senior_approvals_received / workflow.senior_approvals_required) *
                      100
                    }
                    className="flex-1"
                  />
                  <span className="text-sm font-medium">
                    {workflow.senior_approvals_received} из {workflow.senior_approvals_required}
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          )}
      </CardContent>
    </Card>
  );
}

// Keep default export for backward compatibility
export default WorkflowStatusCard;
