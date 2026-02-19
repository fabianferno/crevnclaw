import yaml from 'js-yaml';
import { z } from 'zod';
import type { WorkflowDefinition, WorkflowStep } from '@crevnclaw/types';

const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['action', 'approval', 'conditional']),
  action: z.string().optional(),
  args: z.record(z.unknown()).optional(),
  next: z.string().optional(),
  on_approve: z.string().optional(),
  on_reject: z.string().optional(),
});

const WorkflowDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  steps: z.array(WorkflowStepSchema).min(1),
});

export function parseWorkflowYaml(yamlContent: string): WorkflowDefinition {
  const raw = yaml.load(yamlContent);
  return WorkflowDefinitionSchema.parse(raw);
}

export function validateWorkflow(definition: unknown): WorkflowDefinition {
  return WorkflowDefinitionSchema.parse(definition);
}
