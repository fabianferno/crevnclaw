'use client';

import { useEffect, useRef, useState } from 'react';
import type { WSMessage } from '../lib/ws';

export function ThoughtStream({ wsUrl, token }: { wsUrl: string; token: string }) {
  const [entries, setEntries] = useState<WSMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`${wsUrl}?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg: WSMessage = JSON.parse(e.data);
        setEntries((prev) => [...prev.slice(-500), msg]);
      } catch {
        // Ignore malformed messages
      }
    };

    return () => {
      ws.close();
    };
  }, [wsUrl, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const typeColors: Record<string, string> = {
    thought: 'text-blue-400',
    tool_call: 'text-yellow-400',
    tool_result: 'text-green-400',
    chat: 'text-white',
    bankrupt: 'text-red-500',
    panic: 'text-red-600',
    status: 'text-gray-400',
    approval_request: 'text-purple-400',
    approval_response: 'text-purple-300',
  };

  const typeBadgeBg: Record<string, string> = {
    thought: 'bg-blue-400/10 border-blue-400/20',
    tool_call: 'bg-yellow-400/10 border-yellow-400/20',
    tool_result: 'bg-green-400/10 border-green-400/20',
    chat: 'bg-white/10 border-white/20',
    bankrupt: 'bg-red-500/10 border-red-500/20',
    panic: 'bg-red-600/10 border-red-600/20',
    status: 'bg-gray-400/10 border-gray-400/20',
    approval_request: 'bg-purple-400/10 border-purple-400/20',
    approval_response: 'bg-purple-300/10 border-purple-300/20',
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-950 font-mono text-sm">
      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-gray-600">
          <div className="w-3 h-3 bg-gray-700 rounded-full animate-pulse-dot mb-4" />
          <p className="text-lg">Waiting for agent activity...</p>
          <p className="text-sm mt-2 text-gray-700">
            Connect to a running kernel to see the thought stream
          </p>
        </div>
      )}
      <div className="p-4 space-y-1">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex gap-3 py-1.5 px-2 rounded hover:bg-white/[0.02] transition-colors"
          >
            <span className="text-gray-600 shrink-0 tabular-nums text-xs leading-6">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
            <span
              className={`shrink-0 text-xs leading-6 px-2 py-0.5 rounded border ${
                typeBadgeBg[entry.type] || 'bg-gray-400/10 border-gray-400/20'
              } ${typeColors[entry.type] || 'text-gray-400'}`}
            >
              {entry.type}
            </span>
            <pre className="text-green-300/90 whitespace-pre-wrap break-all leading-6 flex-1">
              {typeof entry.payload === 'object'
                ? JSON.stringify(entry.payload, null, 2)
                : String(entry.payload)}
            </pre>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
