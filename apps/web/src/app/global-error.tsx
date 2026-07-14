'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uz">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 font-sans">
        <h1 className="text-xl font-semibold text-slate-900">Tizim xatoligi</h1>
        <p className="max-w-md text-center text-sm text-slate-600">
          Kutilmagan xatolik. Sahifani yangilang yoki keyinroq qayta kiring.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Qayta urinish
        </button>
      </body>
    </html>
  );
}
