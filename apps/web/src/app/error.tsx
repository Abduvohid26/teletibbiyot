'use client';

import { useEffect } from 'react';

export default function Error({
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
      <h1 className="text-xl font-semibold text-slate-900">Xatolik yuz berdi</h1>
      <p className="max-w-md text-center text-sm text-slate-600">
        Sahifa yuklanmadi. Internet aloqasini tekshiring yoki qayta urinib ko&apos;ring.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Qayta urinish
      </button>
    </div>
  );
}
