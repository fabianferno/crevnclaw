import { EventEmitter } from 'node:events';
import type { WorkflowDefinition, WorkflowStep, WorkflowState } from '@crevnclaw/types';
import { freezeState, thawState } from './freeze.js';

export type ActionHandler = (
  step: WorkflowStep,
  context: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

export interface WorkflowEngineConfig {
  freezePath: string;
  actionHandler: ActionHandler;
}

export class WorkflowEngine extends EventEmitter {
  private config: WorkflowEngineConfig;
  private definition: WorkflowDefinition | null = null;
  private state: WorkflowState | null = null;

  constructor(config: WorkflowEngineConfig) {
    super();
    this.config = config;
  }

  async run(definition: WorkflowDefinition, initialContext: Record<string, unknown> = {}): Promise<WorkflowState> {
    this.definition = definition;

    if (!definition.steps.length) {
      throw new Error('Workflow has no steps');
    }

    this.state = {
      workflow_name: definition.name,
      current_step: definition.steps[0].id,
      status: 'running',
      context: { ...initialContext },
    };

    this.emit('start', this.state);

    return this.executeFromCurrentStep();
  }

  async approve(approved: boolean): Promise<WorkflowState> {
    if (!this.definition || !this.state) {
      // Try to thaw from frozen state
      throw new Error('No workflow state to approve. Call run() first or thaw a frozen state.');
    }

    if (this.state.status !== 'waiting_approval') {
      throw new Error(`Cannot approve workflow in status: ${this.state.status}`);
    }

    const currentStep = this.findStep(this.state.current_step);
    if (!currentStep || currentStep.type !== 'approval') {
      throw new Error('Current step is not an approval step');
    }

    const nextStepId = approved ? currentStep.on_approve : currentStep.on_reject;

    if (!nextStepId) {
      this.state.status = approved ? 'completed' : 'failed';
      this.emit(approved ? 'complete' : 'failed', this.state);
      return this.state;
    }

    this.state.current_step = nextStepId;
    this.state.status = 'running';
    this.emit('approved', { approved, nextStep: nextStepId });

    return this.executeFromCurrentStep();
  }

  loadFrozenState(definition: WorkflowDefinition): WorkflowState {
    this.definition = definition;
    this.state = thawState(this.config.freezePath);
    return this.state;
  }

  getState(): WorkflowState | null {
    return this.state;
  }

  private async executeFromCurrentStep(): Promise<WorkflowState> {
    while (this.state && this.state.status === 'running') {
      const step = this.findStep(this.state.current_step);

      if (!step) {
        this.state.status = 'failed';
        this.emit('failed', this.state);
        throw new Error(`Step not found: ${this.state.current_step}`);
      }

      this.emit('step', step);

      if (step.type === 'approval') {
        this.state.status = 'waiting_approval';
        freezeState(this.state, this.config.freezePath);
        this.emit('waiting_approval', step);
        return this.state;
      }

      if (step.type === 'action') {
        try {
          const result = await this.config.actionHandler(step, this.state.context);
          this.state.context = { ...this.state.context, ...result };
        } catch (err: any) {
          this.state.status = 'failed';
          this.state.context.error = err.message;
          this.emit('failed', this.state);
          return this.state;
        }
      }

      if (step.type === 'conditional') {
        // Conditional steps: evaluate by checking context for a truthy value matching step.action
        const conditionValue = this.state.context[step.action ?? ''];
        const nextStepId = conditionValue ? step.on_approve : step.on_reject;
        if (nextStepId) {
          this.state.current_step = nextStepId;
          continue;
        }
        // No next step means we're done
        this.state.status = 'completed';
        this.emit('complete', this.state);
        return this.state;
      }

      // Move to next step
      if (step.next) {
        this.state.current_step = step.next;
      } else {
        this.state.status = 'completed';
        this.emit('complete', this.state);
        return this.state;
      }
    }

    return this.state!;
  }

  private findStep(id: string): WorkflowStep | undefined {
    return this.definition?.steps.find(s => s.id === id);
  }
}
