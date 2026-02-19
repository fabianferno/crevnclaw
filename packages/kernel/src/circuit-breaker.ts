import { EventEmitter } from 'node:events';
import type { CircuitBreakerConfig } from '@crevnclaw/types';
import type { Ledger } from '@crevnclaw/memory';

export class CircuitBreaker extends EventEmitter {
  private config: CircuitBreakerConfig;
  private ledger: Ledger;

  constructor(config: CircuitBreakerConfig, ledger: Ledger) {
    super();
    this.config = config;
    this.ledger = ledger;
  }

  isTripped(): boolean {
    return this.tripReason() !== null;
  }

  tripReason(): string | null {
    const dailySpend = this.ledger.getDailySpend();
    if (dailySpend >= this.config.max_daily_spend) {
      return `Daily spend limit exceeded: $${dailySpend.toFixed(2)} >= $${this.config.max_daily_spend.toFixed(2)}`;
    }

    const hourlyLoops = this.ledger.getHourlyLoopCount();
    if (hourlyLoops >= this.config.max_loops_per_hour) {
      return `Hourly loop limit exceeded: ${hourlyLoops} >= ${this.config.max_loops_per_hour}`;
    }

    return null;
  }

  check(): void {
    const reason = this.tripReason();
    if (reason) {
      this.emit('tripped', reason);
      throw new Error(`Circuit breaker tripped: ${reason}`);
    }
  }
}
