/**
 * Workflow Engine for B2B Import Quotation Platform
 * Handles collaborative multi-role workflow management
 */

import { createClient } from '@/lib/supabase/client';
import {
  Quote,
  WorkflowTemplate,
  WorkflowStep,
  RoleAssignment,
  UserRole,
  QuoteStatus,
  ExtendedUser,
  RoleInput,
  ApiResponse,
} from '@/lib/types/platform';

export interface WorkflowContext {
  quote: Quote;
  currentStep: WorkflowStep;
  template: WorkflowTemplate;
  assignedUsers: ExtendedUser[];
  pendingRoles: UserRole[];
  completedRoles: UserRole[];
}

export interface WorkflowTransition {
  from_step: string;
  to_step: string;
  required_roles: UserRole[];
  conditions: WorkflowCondition[];
}

export interface WorkflowCondition {
  type: 'role_completed' | 'field_required' | 'approval_needed';
  role?: UserRole;
  field?: string;
  value?: unknown;
}

export class WorkflowEngine {
  private supabase = createClient();

  // ============================================================================
  // WORKFLOW INITIALIZATION
  // ============================================================================

  /**
   * Initialize workflow for a new quote
   */
  async initializeWorkflow(
    quoteId: string,
    workflowTemplateId: string,
    organizationId: string
  ): Promise<ApiResponse<WorkflowContext>> {
    try {
      // Get workflow template
      const { data: template, error: templateError } = await this.supabase
        .from('workflow_templates')
        .select('*')
        .eq('id', workflowTemplateId)
        .single();

      if (templateError || !template) {
        return {
          success: false,
          error: 'Workflow template not found',
        };
      }

      // Get quote
      const { data: quote, error: quoteError } = await this.supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

      if (quoteError || !quote) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      const steps = template.steps as WorkflowStep[];
      const firstStep = steps.find((step) => step.order === 1);

      if (!firstStep) {
        return {
          success: false,
          error: 'No first step found in workflow template',
        };
      }

      // Create initial role assignments
      await this.createInitialRoleAssignments(quoteId, steps, organizationId);

      // Update quote status
      await this.supabase
        .from('quotes')
        .update({
          current_step: firstStep.id,
          status: this.getStatusForStep(firstStep),
        })
        .eq('id', quoteId);

      return {
        success: true,
        data: {
          quote: quote as Quote,
          currentStep: firstStep,
          template: template as WorkflowTemplate,
          assignedUsers: [],
          pendingRoles: [firstStep.role],
          completedRoles: [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize workflow',
      };
    }
  }

  /**
   * Create initial role assignments for workflow steps
   */
  private async createInitialRoleAssignments(
    quoteId: string,
    steps: WorkflowStep[],
    organizationId: string
  ): Promise<void> {
    const assignments: Record<string, unknown>[] = [];

    for (const step of steps) {
      // Auto-assign if rules are defined
      let assignedUserId: string | undefined;

      if (step.auto_assign && step.assignment_rules) {
        assignedUserId = await this.findBestAssignee(step, organizationId);
      }

      assignments.push({
        quote_id: quoteId,
        role: step.role,
        assigned_to: assignedUserId,
        assigned_by: 'system',
        status: step.order === 1 ? 'pending' : 'pending',
        due_date: step.sla_deadline
          ? new Date(Date.now() + step.sla_deadline * 60 * 60 * 1000).toISOString()
          : undefined,
        brand_filter: undefined,
      });
    }

    await this.supabase.from('role_assignments').insert(assignments);
  }

  // ============================================================================
  // WORKFLOW PROGRESSION
  // ============================================================================

  /**
   * Progress workflow to next step after role completion
   */
  async progressWorkflow(
    quoteId: string,
    completedRole: UserRole,
    _userId: string
  ): Promise<ApiResponse<WorkflowContext>> {
    try {
      // Get current workflow state
      const workflowState = await this.getWorkflowState(quoteId);
      if (!workflowState.success || !workflowState.data) {
        return workflowState;
      }

      const { quote, template } = workflowState.data;
      const steps = template.steps as WorkflowStep[];
      const currentStep = steps.find((step) => step.id === quote.current_step);

      if (!currentStep) {
        return {
          success: false,
          error: 'Current step not found',
        };
      }

      // Mark role as completed
      await this.supabase
        .from('role_assignments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('quote_id', quoteId)
        .eq('role', completedRole);

      // Check if current step is fully completed
      const stepCompleted = await this.isStepCompleted(quoteId, currentStep);

      if (!stepCompleted) {
        // Step not yet completed, return current state
        return workflowState;
      }

      // Find next step
      const nextStep = steps.find((step) => step.order === currentStep.order + 1);

      if (!nextStep) {
        // Workflow completed
        await this.completeWorkflow(quoteId);
        return workflowState;
      }

      // Check if next step dependencies are met
      const dependenciesMet = await this.checkStepDependencies(quoteId, nextStep);

      if (!dependenciesMet) {
        return {
          success: false,
          error: 'Step dependencies not met',
        };
      }

      // Progress to next step
      await this.supabase
        .from('quotes')
        .update({
          current_step: nextStep.id,
          status: this.getStatusForStep(nextStep),
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      // Activate next step assignments
      await this.activateStepAssignments(quoteId, nextStep);

      return {
        success: true,
        data: {
          ...workflowState.data,
          currentStep: nextStep,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to progress workflow',
      };
    }
  }

  /**
   * Handle concurrent procurement manager workflows
   */
  async handleConcurrentProcurement(
    quoteId: string,
    procurementManagerId: string,
    _roleInputData: Record<string, unknown>
  ): Promise<ApiResponse<{ requiresChoice: boolean; options?: RoleInput[] }>> {
    try {
      // Check if other procurement managers have already submitted
      const { data: existingInputs, error } = await this.supabase
        .from('quote_items')
        .select('role_inputs')
        .eq('quote_id', quoteId);

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      const procurementInputs: RoleInput[] = [];

      for (const item of existingInputs || []) {
        const roleInputs = item.role_inputs as Record<string, RoleInput>;
        const procurementData = Object.values(roleInputs || {}).filter(
          (input) => input.user_id !== procurementManagerId && input.status === 'completed'
        );
        procurementInputs.push(...procurementData);
      }

      if (procurementInputs.length > 0) {
        // Multiple procurement options available - sales manager needs to choose
        return {
          success: true,
          data: {
            requiresChoice: true,
            options: procurementInputs,
          },
        };
      }

      // First procurement manager to complete
      return {
        success: true,
        data: {
          requiresChoice: false,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to handle concurrent procurement',
      };
    }
  }

  // ============================================================================
  // WORKFLOW STATE MANAGEMENT
  // ============================================================================

  /**
   * Get current workflow state
   */
  async getWorkflowState(quoteId: string): Promise<ApiResponse<WorkflowContext>> {
    try {
      // Get quote with all related data
      const { data: quote, error: quoteError } = await this.supabase
        .from('quotes')
        .select(
          `
          *,
          workflow_template:workflow_templates(*),
          role_assignments(*)
        `
        )
        .eq('id', quoteId)
        .single();

      if (quoteError || !quote) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      const template = quote.workflow_template as WorkflowTemplate;
      const steps = template.steps as WorkflowStep[];
      const currentStep = steps.find((step) => step.id === quote.current_step);

      if (!currentStep) {
        return {
          success: false,
          error: 'Current step not found',
        };
      }

      const assignments = quote.role_assignments as RoleAssignment[];
      const pendingRoles = assignments
        .filter((a) => a.status === 'pending' || a.status === 'in_progress')
        .map((a) => a.role);
      const completedRoles = assignments.filter((a) => a.status === 'completed').map((a) => a.role);

      return {
        success: true,
        data: {
          quote: quote as Quote,
          currentStep,
          template,
          assignedUsers: [],
          pendingRoles,
          completedRoles,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get workflow state',
      };
    }
  }

  /**
   * Check if a workflow step is completed
   */
  private async isStepCompleted(quoteId: string, step: WorkflowStep): Promise<boolean> {
    const { data: assignments } = await this.supabase
      .from('role_assignments')
      .select('status')
      .eq('quote_id', quoteId)
      .eq('role', step.role);

    return assignments?.every((a) => a.status === 'completed') || false;
  }

  /**
   * Check if step dependencies are met
   */
  private async checkStepDependencies(quoteId: string, step: WorkflowStep): Promise<boolean> {
    if (!step.dependencies || step.dependencies.length === 0) {
      return true;
    }

    // Check all dependency steps are completed
    for (const depId of step.dependencies) {
      const { data: assignments } = await this.supabase
        .from('role_assignments')
        .select('status')
        .eq('quote_id', quoteId);

      // Find assignments for the dependency step role
      const depCompleted = assignments?.some((a) => a.status === 'completed');
      if (!depCompleted) {
        return false;
      }
    }

    return true;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Find best assignee for a workflow step
   */
  private async findBestAssignee(
    step: WorkflowStep,
    organizationId: string
  ): Promise<string | undefined> {
    if (!step.assignment_rules) return undefined;

    const { data: users } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('role', step.role);

    if (!users || users.length === 0) return undefined;

    // Simple assignment - return first available user
    // TODO: Implement sophisticated assignment rules
    return users[0].id;
  }

  /**
   * Get quote status for workflow step
   */
  private getStatusForStep(step: WorkflowStep): QuoteStatus {
    const statusMap: Record<UserRole, QuoteStatus> = {
      sales_manager: 'draft',
      procurement_manager: 'procurement_pending',
      customs_manager: 'customs_pending',
      logistics_manager: 'logistics_pending',
      admin: 'approval_pending',
      sourcing_manager: 'sourcing_pending',
      fulfillment_manager: 'fulfillment_pending',
      marketing_manager: 'draft',
      production_manager: 'production_pending',
      materials_manager: 'materials_pending',
      quality_manager: 'quality_pending',
      finance_manager: 'approval_pending',
      department_manager: 'approval_pending',
      director: 'approval_pending',
      custom_role: 'draft',
    };

    return statusMap[step.role] || 'draft';
  }

  /**
   * Activate assignments for a workflow step
   */
  private async activateStepAssignments(quoteId: string, step: WorkflowStep): Promise<void> {
    await this.supabase
      .from('role_assignments')
      .update({ status: 'pending' })
      .eq('quote_id', quoteId)
      .eq('role', step.role);
  }

  /**
   * Complete the entire workflow
   */
  private async completeWorkflow(quoteId: string): Promise<void> {
    await this.supabase
      .from('quotes')
      .update({
        status: 'sales_completion',
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId);
  }
}

// Export singleton instance
export const workflowEngine = new WorkflowEngine();
