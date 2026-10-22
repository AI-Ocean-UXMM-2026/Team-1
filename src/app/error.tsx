"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 text-slate-800">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-xs text-center flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-4">
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          An unexpected error occurred while loading this view. You can try
          reloading the component to recover.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="w-full inline-flex items-center justify-center px-4 py-3 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 active:bg-orange-800 transition cursor-pointer shadow-xs"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
