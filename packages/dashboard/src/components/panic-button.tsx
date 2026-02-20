'use client';

import { useState } from 'react';

export function PanicButton({ onPanic }: { onPanic: () => void }) {
  const [killing, setKilling] = useState(false);

  const handlePanic = () => {
    setKilling(true);
    onPanic();
    setTimeout(() => setKilling(false), 3000);
  };

  return (
    <button
      onClick={handlePanic}
      disabled={killing}
      className="relative group bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg shadow-red-900/50 transition-all active:scale-95 border border-red-500/30 hover:border-red-400/50 w-full"
    >
      <span className="relative z-10 flex items-center justify-center gap-3">
        {killing ? (
          <>
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            KILLING ALL PROCESSES...
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 002 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 002 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            EMERGENCY STOP
          </>
        )}
      </span>
      {!killing && (
        <span className="absolute inset-0 rounded-xl bg-red-400/0 group-hover:bg-red-400/10 transition-colors" />
      )}
    </button>
  );
}
