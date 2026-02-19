export type WorkflowStatus = 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed';

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'action' | 'approval' | 'conditional';
  action?: string;
  args?: Record<string, unknown>;
  next?: string;
  on_approve?: string;
  on_reject?: string;
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export interface WorkflowState {
  workflow_name: string;
  current_step: string;
  status: WorkflowStatus;
  context: Record<string, unknown>;
  frozen_at?: string;
}
