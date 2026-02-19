import { describe, it, expect, vi } from 'vitest';
import { DockerExecutor } from '../executor.js';

describe('DockerExecutor', () => {
  it('creates container with correct options', async () => {
    const mockContainer = {
      start: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue({ StatusCode: 0 }),
      logs: vi.fn().mockResolvedValue(Buffer.from('hello world')),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const mockDocker = {
      createContainer: vi.fn().mockResolvedValue(mockContainer),
    };

    const executor = new DockerExecutor(mockDocker as any, {
      cpuLimit: 1,
      memoryLimit: '512m',
      timeoutMs: 30000,
    });

    const result = await executor.execute({
      image: 'alpine:latest',
      command: ['echo', 'hello world'],
    });

    expect(result.exit_code).toBe(0);
    expect(mockDocker.createContainer).toHaveBeenCalled();
    expect(mockContainer.remove).toHaveBeenCalled();
  });

  it('panic kills all active containers', async () => {
    const mockContainer = {
      start: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockImplementation(() => new Promise(() => {})), // never resolves
      logs: vi.fn().mockResolvedValue(Buffer.from('')),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const mockDocker = {
      createContainer: vi.fn().mockResolvedValue(mockContainer),
    };

    const executor = new DockerExecutor(mockDocker as any, {
      cpuLimit: 1,
      memoryLimit: '512m',
      timeoutMs: 60000,
    });

    // Start a long-running execution (don't await)
    const execPromise = executor.execute({
      image: 'alpine:latest',
      command: ['sleep', '999'],
    }).catch(() => {}); // will reject due to panic

    // Give it time to start
    await new Promise(r => setTimeout(r, 50));

    await executor.panicKill();
    expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
  });
});
