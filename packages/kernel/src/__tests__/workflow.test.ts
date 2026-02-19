import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseWorkflowYaml, validateWorkflow } from '../workflow/parser.js';
import { freezeState, thawState, hasFrozenState } from '../workflow/freeze.js';
import { WorkflowEngine } from '../workflow/engine.js';
import type { WorkflowDefinition, WorkflowState } from '@crevnclaw/types';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const sampleYaml = `
name: deploy-app
description: Deploy application workflow
steps:
  - id: build
    name: Build Application
    type: action
    action: build
    args:
      target: production
    next: review
  - id: review
    name: Review Deployment
    type: approval
    on_approve: deploy
    on_reject: cancel
  - id: deploy
    name: Deploy to Production
    type: action
    action: deploy
    args:
      env: production
  - id: cancel
    name: Cancel Deployment
    type: action
    action: notify
    args:
      message: Deployment cancelled
`;

describe('Workflow Parser', () => {
  it('parses valid YAML workflow definition', () => {
    const definition = parseWorkflowYaml(sampleYaml);

    expect(definition.name).toBe('deploy-app');
    expect(definition.description).toBe('Deploy application workflow');
    expect(definition.steps).toHaveLength(4);
    expect(definition.steps[0].id).toBe('build');
    expect(definition.steps[0].type).toBe('action');
    expect(definition.steps[0].args).toEqual({ target: 'production' });
    expect(definition.steps[1].type).toBe('approval');
    expect(definition.steps[1].on_approve).toBe('deploy');
    expect(definition.steps[1].on_reject).toBe('cancel');
  });

  it('throws on invalid YAML', () => {
    expect(() => parseWorkflowYaml('not: valid: yaml: {')).toThrow();
  });

  it('throws on missing required fields', () => {
    const invalidYaml = `
name: test
steps: []
`;
    expect(() => parseWorkflowYaml(invalidYaml)).toThrow();
  });

  it('validates workflow definition objects', () => {
    const valid = {
      name: 'test',
      description: 'test workflow',
      steps: [{ id: 'step1', name: 'Step 1', type: 'action' }],
    };
    const result = validateWorkflow(valid);
    expect(result.name).toBe('test');
  });
});

describe('Workflow Freeze/Thaw', () => {
  let tmpDir: string;
  let freezePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kernel-workflow-'));
    freezePath = path.join(tmpDir, 'frozen-state.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('freezes state to a JSON file', () => {
    const state: WorkflowState = {
      workflow_name: 'test',
      current_step: 'step1',
      status: 'waiting_approval',
      context: { key: 'value' },
    };

    freezeState(state, freezePath);

    expect(fs.existsSync(freezePath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(freezePath, 'utf-8'));
    expect(content.workflow_name).toBe('test');
    expect(content.frozen_at).toBeDefined();
  });

  it('thaws state from a JSON file', () => {
    const state: WorkflowState = {
      workflow_name: 'test',
      current_step: 'step2',
      status: 'waiting_approval',
      context: { data: 42 },
    };

    freezeState(state, freezePath);
    const thawed = thawState(freezePath);

    expect(thawed.workflow_name).toBe('test');
    expect(thawed.current_step).toBe('step2');
    expect(thawed.status).toBe('waiting_approval');
    expect(thawed.context.data).toBe(42);
    expect(thawed.frozen_at).toBeDefined();
  });

  it('hasFrozenState returns true when file exists', () => {
    freezeState(
      { workflow_name: 'test', current_step: 'step1', status: 'waiting_approval', context: {} },
      freezePath,
    );
    expect(hasFrozenState(freezePath)).toBe(true);
  });

  it('hasFrozenState returns false when file does not exist', () => {
    expect(hasFrozenState(freezePath)).toBe(false);
  });
});

describe('Workflow Engine', () => {
  let tmpDir: string;
  let freezePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kernel-engine-'));
    freezePath = path.join(tmpDir, 'frozen-state.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const simpleWorkflow: WorkflowDefinition = {
    name: 'simple',
    description: 'Simple workflow',
    steps: [
      { id: 'step1', name: 'Step 1', type: 'action', action: 'doSomething', next: 'step2' },
      { id: 'step2', name: 'Step 2', type: 'action', action: 'doMore' },
    ],
  };

  const approvalWorkflow: WorkflowDefinition = {
    name: 'approval-flow',
    description: 'Workflow with approval',
    steps: [
      { id: 'prepare', name: 'Prepare', type: 'action', action: 'prepare', next: 'review' },
      { id: 'review', name: 'Review', type: 'approval', on_approve: 'execute', on_reject: 'abort' },
      { id: 'execute', name: 'Execute', type: 'action', action: 'execute' },
      { id: 'abort', name: 'Abort', type: 'action', action: 'abort' },
    ],
  };

  it('runs a simple workflow to completion', async () => {
    const actionHandler = vi.fn().mockResolvedValue({});
    const engine = new WorkflowEngine({ freezePath, actionHandler });

    const state = await engine.run(simpleWorkflow);

    expect(state.status).toBe('completed');
    expect(actionHandler).toHaveBeenCalledTimes(2);
  });

  it('pauses at approval gate', async () => {
    const actionHandler = vi.fn().mockResolvedValue({});
    const engine = new WorkflowEngine({ freezePath, actionHandler });

    const state = await engine.run(approvalWorkflow);

    expect(state.status).toBe('waiting_approval');
    expect(state.current_step).toBe('review');
    expect(hasFrozenState(freezePath)).toBe(true);
  });

  it('continues after approval (approved)', async () => {
    const actionHandler = vi.fn().mockResolvedValue({});
    const engine = new WorkflowEngine({ freezePath, actionHandler });

    await engine.run(approvalWorkflow);
    const state = await engine.approve(true);

    expect(state.status).toBe('completed');
    expect(state.current_step).toBe('execute');
    expect(actionHandler).toHaveBeenCalledTimes(2); // prepare + execute
  });

  it('continues after approval (rejected)', async () => {
    const actionHandler = vi.fn().mockResolvedValue({});
    const engine = new WorkflowEngine({ freezePath, actionHandler });

    await engine.run(approvalWorkflow);
    const state = await engine.approve(false);

    expect(state.status).toBe('completed');
    expect(state.current_step).toBe('abort');
    expect(actionHandler).toHaveBeenCalledTimes(2); // prepare + abort
  });

  it('freeze/thaw preserves workflow state', async () => {
    const actionHandler = vi.fn().mockResolvedValue({});
    const engine1 = new WorkflowEngine({ freezePath, actionHandler });

    await engine1.run(approvalWorkflow);

    // Create a new engine (simulating restart) and load frozen state
    const engine2 = new WorkflowEngine({ freezePath, actionHandler });
    const loadedState = engine2.loadFrozenState(approvalWorkflow);

    expect(loadedState.workflow_name).toBe('approval-flow');
    expect(loadedState.current_step).toBe('review');
    expect(loadedState.status).toBe('waiting_approval');

    // Approve and continue
    const finalState = await engine2.approve(true);
    expect(finalState.status).toBe('completed');
  });

  it('emits lifecycle events', async () => {
    const actionHandler = vi.fn().mockResolvedValue({});
    const engine = new WorkflowEngine({ freezePath, actionHandler });

    const events: string[] = [];
    engine.on('start', () => events.push('start'));
    engine.on('step', () => events.push('step'));
    engine.on('complete', () => events.push('complete'));

    await engine.run(simpleWorkflow);

    expect(events).toContain('start');
    expect(events).toContain('step');
    expect(events).toContain('complete');
  });

  it('handles action handler errors gracefully', async () => {
    const actionHandler = vi.fn().mockRejectedValue(new Error('action failed'));
    const engine = new WorkflowEngine({ freezePath, actionHandler });

    const state = await engine.run(simpleWorkflow);

    expect(state.status).toBe('failed');
    expect(state.context.error).toBe('action failed');
  });

  it('action handler return values merge into context', async () => {
    const actionHandler = vi.fn()
      .mockResolvedValueOnce({ buildOutput: 'artifact.zip' })
      .mockResolvedValueOnce({ deployed: true });

    const engine = new WorkflowEngine({ freezePath, actionHandler });
    const state = await engine.run(simpleWorkflow, { initial: 'value' });

    expect(state.context.initial).toBe('value');
    expect(state.context.buildOutput).toBe('artifact.zip');
    expect(state.context.deployed).toBe(true);
  });

  it('emits waiting_approval event at approval gate', async () => {
    const actionHandler = vi.fn().mockResolvedValue({});
    const engine = new WorkflowEngine({ freezePath, actionHandler });

    const waitHandler = vi.fn();
    engine.on('waiting_approval', waitHandler);

    await engine.run(approvalWorkflow);

    expect(waitHandler).toHaveBeenCalledOnce();
    expect(waitHandler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'review', type: 'approval' }),
    );
  });
});
