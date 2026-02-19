export type ExecutionEnvironment = 'docker';

export interface ToolRegistryEntry {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  image: string;
  command: string[];
  env: ExecutionEnvironment;
  timeout_ms?: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
}
