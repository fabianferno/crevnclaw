import fs from 'node:fs';
import path from 'node:path';
import type { WorkflowState } from '@crevnclaw/types';

export function freezeState(state: WorkflowState, filePath: string): void {
  const frozen: WorkflowState = {
    ...state,
    frozen_at: new Date().toISOString(),
  };
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(frozen, null, 2));
}

export function thawState(filePath: string): WorkflowState {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const state = JSON.parse(raw) as WorkflowState;
  return state;
}

export function hasFrozenState(filePath: string): boolean {
  return fs.existsSync(filePath);
}
