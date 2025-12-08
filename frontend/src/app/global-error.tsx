'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-zinc-900 text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Что-то пошло не так</h1>
          <p className="text-zinc-400 mb-6">Произошла непредвиденная ошибка</p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-amber-500 text-black rounded hover:bg-amber-400 transition"
          >
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}
