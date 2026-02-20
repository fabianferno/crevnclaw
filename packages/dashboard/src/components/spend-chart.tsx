'use client';

interface SpendChartProps {
  currentSpend: number;
  maxSpend: number;
  loopsThisHour: number;
  maxLoops: number;
}

export function SpendChart({
  currentSpend,
  maxSpend,
  loopsThisHour,
  maxLoops,
}: SpendChartProps) {
  const spendPercent = Math.min((currentSpend / maxSpend) * 100, 100);
  const loopPercent = Math.min((loopsThisHour / maxLoops) * 100, 100);

  const barColor = (pct: number) =>
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500';

  const barGlow = (pct: number) =>
    pct >= 90
      ? 'shadow-red-500/30'
      : pct >= 70
        ? 'shadow-yellow-500/30'
        : 'shadow-green-500/30';

  const statusColor = (pct: number) =>
    pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="space-y-6">
      {/* Daily Spend */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-gray-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm text-gray-400 font-medium">Daily Spend</span>
          </div>
          <span className={`text-sm font-mono font-semibold ${statusColor(spendPercent)}`}>
            ${currentSpend.toFixed(2)} / ${maxSpend.toFixed(2)}
          </span>
        </div>
        <div className="h-3 bg-gray-800/80 rounded-full overflow-hidden border border-gray-700/30">
          <div
            className={`h-full ${barColor(spendPercent)} rounded-full transition-all duration-700 ease-out shadow-lg ${barGlow(spendPercent)}`}
            style={{ width: `${spendPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-600">{spendPercent.toFixed(1)}% used</span>
          <span className="text-xs text-gray-600">
            ${(maxSpend - currentSpend).toFixed(2)} remaining
          </span>
        </div>
      </div>

      {/* Loops This Hour */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-gray-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm text-gray-400 font-medium">Loops This Hour</span>
          </div>
          <span className={`text-sm font-mono font-semibold ${statusColor(loopPercent)}`}>
            {loopsThisHour} / {maxLoops}
          </span>
        </div>
        <div className="h-3 bg-gray-800/80 rounded-full overflow-hidden border border-gray-700/30">
          <div
            className={`h-full ${barColor(loopPercent)} rounded-full transition-all duration-700 ease-out shadow-lg ${barGlow(loopPercent)}`}
            style={{ width: `${loopPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-600">{loopPercent.toFixed(1)}% used</span>
          <span className="text-xs text-gray-600">{maxLoops - loopsThisHour} remaining</span>
        </div>
      </div>
    </div>
  );
}
