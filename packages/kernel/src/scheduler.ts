import { EventEmitter } from 'node:events';

export enum Lane {
  System = 0,
  Interactive = 1,
  Background = 2,
}

interface Task {
  lane: Lane;
  fn: (signal: AbortSignal) => Promise<void>;
  controller: AbortController;
}

export class Scheduler extends EventEmitter {
  private queues: Map<Lane, Task[]> = new Map([
    [Lane.System, []],
    [Lane.Interactive, []],
    [Lane.Background, []],
  ]);
  private runningBackground: Task | null = null;

  enqueue(lane: Lane, fn: (signal: AbortSignal) => Promise<void>): void {
    const controller = new AbortController();
    const task: Task = { lane, fn, controller };
    this.queues.get(lane)!.push(task);
    if (lane === Lane.Interactive && this.runningBackground) {
      this.runningBackground.controller.abort(new Error('Preempted by interactive task'));
      this.runningBackground = null;
    }
    this.emit('enqueue', lane);
  }

  async flush(): Promise<void> {
    for (const lane of [Lane.System, Lane.Interactive, Lane.Background]) {
      const queue = this.queues.get(lane)!;
      while (queue.length > 0) {
        const task = queue.shift()!;
        if (task.controller.signal.aborted) continue;
        if (lane === Lane.Background) this.runningBackground = task;
        try {
          await task.fn(task.controller.signal);
        } catch (err: any) {
          if (err?.message !== 'Preempted by interactive task') this.emit('error', err);
        } finally {
          if (this.runningBackground === task) this.runningBackground = null;
        }
      }
    }
  }
}
