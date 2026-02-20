'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [maxDailySpend, setMaxDailySpend] = useState('5.00');
  const [maxLoopsPerHour, setMaxLoopsPerHour] = useState('50');
  const [gatewayUrl, setGatewayUrl] = useState('ws://localhost:3100');
  const [token, setToken] = useState('');

  return (
    <div className="p-8 space-y-8 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="text-sm text-[var(--muted)] mt-1">Configure circuit breakers and gateway connection</p>
      </div>

      {/* Circuit Breaker */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Circuit Breaker</h3>

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Max Daily Spend (USD)</label>
          <input
            type="number"
            step="0.50"
            value={maxDailySpend}
            onChange={(e) => setMaxDailySpend(e.target.value)}
            className="w-full p-2.5 bg-[var(--background)] text-white border border-[var(--card-border)] rounded-lg focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Max Loops Per Hour</label>
          <input
            type="number"
            value={maxLoopsPerHour}
            onChange={(e) => setMaxLoopsPerHour(e.target.value)}
            className="w-full p-2.5 bg-[var(--background)] text-white border border-[var(--card-border)] rounded-lg focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
      </div>

      {/* Connection */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Gateway Connection</h3>

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Gateway WebSocket URL</label>
          <input
            type="text"
            value={gatewayUrl}
            onChange={(e) => setGatewayUrl(e.target.value)}
            className="w-full p-2.5 bg-[var(--background)] text-white border border-[var(--card-border)] rounded-lg focus:border-[var(--accent)] focus:outline-none font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Auth Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste pairing token from CLI"
            className="w-full p-2.5 bg-[var(--background)] text-white border border-[var(--card-border)] rounded-lg focus:border-[var(--accent)] focus:outline-none font-mono text-sm"
          />
        </div>
      </div>

      <button className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium py-2.5 px-6 rounded-lg transition-colors">
        Save Settings
      </button>
    </div>
  );
}
