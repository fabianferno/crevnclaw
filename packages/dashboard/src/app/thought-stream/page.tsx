'use client';

import { ThoughtStream } from '../../components/thought-stream';

export default function ThoughtStreamPage() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3100';
  const token = process.env.NEXT_PUBLIC_WS_TOKEN || '';

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-[var(--card-border)] flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Thought Stream</h2>
          <p className="text-sm text-[var(--muted)] mt-1">Live agent monologue and tool execution</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--success)]">
          <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse-dot" />
          Live
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <ThoughtStream wsUrl={wsUrl} token={token} />
      </div>
    </div>
  );
}
