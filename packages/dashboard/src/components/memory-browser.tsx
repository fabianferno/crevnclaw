'use client';

import { useState } from 'react';

interface MemoryEntry {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  type: 'conversation' | 'fact';
  created_at?: string;
}

export function MemoryBrowser() {
  const [entries] = useState<MemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = entries.filter((e) =>
    e.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="text"
          placeholder="Search memories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-gray-900/80 text-white border border-gray-700/50 rounded-xl focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 focus:outline-none placeholder-gray-500 transition-colors"
        />
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>{entries.length} total memories</span>
        <span className="w-px h-3 bg-gray-700" />
        <span>{entries.filter((e) => e.type === 'fact').length} facts</span>
        <span className="w-px h-3 bg-gray-700" />
        <span>{entries.filter((e) => e.type === 'conversation').length} conversations</span>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 mb-4 text-gray-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <p className="text-lg font-medium">
            {searchQuery ? 'No matching memories' : 'No memories stored yet'}
          </p>
          <p className="text-sm mt-1 text-gray-600">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Memories will appear here as the agent operates'}
          </p>
        </div>
      )}

      {/* Memory entries */}
      <div className="space-y-3">
        {filtered.map((entry) => (
          <div
            key={entry.id}
            className="p-4 bg-gray-900/60 rounded-xl border border-gray-800/50 hover:border-gray-700/50 transition-colors group"
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  entry.type === 'fact'
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                }`}
              >
                {entry.type}
              </span>
              {entry.created_at && (
                <span className="text-xs text-gray-600">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-gray-200 text-sm leading-relaxed">{entry.content}</p>
            {Object.keys(entry.metadata).length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-800/50">
                <p className="text-xs text-gray-600 font-mono">
                  {JSON.stringify(entry.metadata)}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
