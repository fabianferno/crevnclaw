import type { ExecutionResult } from '@crevnclaw/types';
import type Dockerode from 'dockerode';

export interface ExecutorConfig {
  cpuLimit: number;
  memoryLimit: string;
  timeoutMs: number;
  hostNetwork?: boolean;
}

export interface ExecuteOptions {
  image: string;
  command: string[];
  env?: Record<string, string>;
  workdir?: string;
}

export class DockerExecutor {
  private docker: Dockerode;
  private config: ExecutorConfig;
  private activeContainers: Set<Dockerode.Container> = new Set();

  constructor(docker: Dockerode, config: ExecutorConfig) {
    this.docker = docker;
    this.config = config;
  }

  async execute(options: ExecuteOptions): Promise<ExecutionResult> {
    const start = Date.now();
    const memBytes = this.parseMemoryLimit(this.config.memoryLimit);

    const container = await this.docker.createContainer({
      Image: options.image,
      Cmd: options.command,
      Env: options.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : undefined,
      WorkingDir: options.workdir,
      NetworkDisabled: !this.config.hostNetwork,
      HostConfig: {
        NanoCpus: this.config.cpuLimit * 1e9,
        Memory: memBytes,
        AutoRemove: false,
      },
    });

    this.activeContainers.add(container);
    try {
      await container.start();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), this.config.timeoutMs)
      );

      const waitResult = await Promise.race([container.wait(), timeoutPromise]);
      const logs = await container.logs({ stdout: true, stderr: true });

      return {
        stdout: logs.toString('utf-8'),
        stderr: '',
        exit_code: (waitResult as any).StatusCode,
        duration_ms: Date.now() - start,
      };
    } finally {
      this.activeContainers.delete(container);
      await container.remove({ force: true }).catch(() => {});
    }
  }

  async panicKill(): Promise<void> {
    const kills = [...this.activeContainers].map(c =>
      c.remove({ force: true }).catch(() => {})
    );
    await Promise.all(kills);
    this.activeContainers.clear();
  }

  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+)(m|g)$/i);
    if (!match) return 512 * 1024 * 1024;
    const val = parseInt(match[1]);
    return match[2].toLowerCase() === 'g' ? val * 1024 * 1024 * 1024 : val * 1024 * 1024;
  }
}
