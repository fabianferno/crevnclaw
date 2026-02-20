'use client';

import { PanicButton } from '../components/panic-button';
import { SpendChart } from '../components/spend-chart';

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-sm text-[var(--muted)] mt-1">Overview of agent activity and resource usage</p>
        </div>
        <PanicButton onPanic={() => {
          console.log('PANIC: Killing all processes');
        }} />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">Active Containers</p>
          <p className="text-3xl font-bold text-white">0</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">Sessions Today</p>
          <p className="text-3xl font-bold text-white">0</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">Memory Facts</p>
          <p className="text-3xl font-bold text-white">0</p>
        </div>
      </div>

      {/* Circuit Breaker */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl">
        <div className="p-5 border-b border-[var(--card-border)]">
          <h3 className="text-lg font-semibold text-white">Circuit Breaker</h3>
        </div>
        <SpendChart currentSpend={0} maxSpend={5.0} loopsThisHour={0} maxLoops={50} />
      </div>
    </div>
  );
}
