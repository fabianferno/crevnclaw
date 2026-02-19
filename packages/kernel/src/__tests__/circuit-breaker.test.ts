import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker } from '../circuit-breaker.js';

function createMockLedger(dailySpend = 0, hourlyLoops = 0) {
  return {
    getDailySpend: vi.fn().mockReturnValue(dailySpend),
    getHourlyLoopCount: vi.fn().mockReturnValue(hourlyLoops),
    record: vi.fn(),
  } as any;
}

const defaultConfig = {
  max_daily_spend: 10,
  max_loops_per_hour: 100,
};

describe('CircuitBreaker', () => {
  it('is not tripped when under limits', () => {
    const ledger = createMockLedger(5, 50);
    const breaker = new CircuitBreaker(defaultConfig, ledger);

    expect(breaker.isTripped()).toBe(false);
    expect(breaker.tripReason()).toBeNull();
  });

  it('is tripped when daily spend exceeds limit', () => {
    const ledger = createMockLedger(10, 50);
    const breaker = new CircuitBreaker(defaultConfig, ledger);

    expect(breaker.isTripped()).toBe(true);
    expect(breaker.tripReason()).toContain('Daily spend limit exceeded');
  });

  it('is tripped when hourly loops exceed limit', () => {
    const ledger = createMockLedger(5, 100);
    const breaker = new CircuitBreaker(defaultConfig, ledger);

    expect(breaker.isTripped()).toBe(true);
    expect(breaker.tripReason()).toContain('Hourly loop limit exceeded');
  });

  it('check() throws when tripped', () => {
    const ledger = createMockLedger(15, 50);
    const breaker = new CircuitBreaker(defaultConfig, ledger);

    expect(() => breaker.check()).toThrow('Circuit breaker tripped');
  });

  it('check() does not throw when not tripped', () => {
    const ledger = createMockLedger(5, 50);
    const breaker = new CircuitBreaker(defaultConfig, ledger);

    expect(() => breaker.check()).not.toThrow();
  });

  it('emits tripped event when check() finds breach', () => {
    const ledger = createMockLedger(15, 50);
    const breaker = new CircuitBreaker(defaultConfig, ledger);
    const handler = vi.fn();
    breaker.on('tripped', handler);

    try {
      breaker.check();
    } catch {
      // expected
    }

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(expect.stringContaining('Daily spend limit exceeded'));
  });

  it('does not emit tripped event when under limits', () => {
    const ledger = createMockLedger(5, 50);
    const breaker = new CircuitBreaker(defaultConfig, ledger);
    const handler = vi.fn();
    breaker.on('tripped', handler);

    breaker.check();

    expect(handler).not.toHaveBeenCalled();
  });

  it('reports spend amounts in trip reason', () => {
    const ledger = createMockLedger(12.50, 50);
    const breaker = new CircuitBreaker(defaultConfig, ledger);

    const reason = breaker.tripReason();
    expect(reason).toContain('$12.50');
    expect(reason).toContain('$10.00');
  });

  it('reports loop counts in trip reason', () => {
    const ledger = createMockLedger(0, 150);
    const breaker = new CircuitBreaker(defaultConfig, ledger);

    const reason = breaker.tripReason();
    expect(reason).toContain('150');
    expect(reason).toContain('100');
  });
});
