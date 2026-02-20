'use client';

import { MemoryBrowser } from '../../components/memory-browser';

export default function MemoryPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-[var(--card-border)]">
        <h2 className="text-2xl font-bold text-white">Memory</h2>
        <p className="text-sm text-[var(--muted)] mt-1">Browse stored conversations and vector facts</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <MemoryBrowser />
      </div>
    </div>
  );
}
