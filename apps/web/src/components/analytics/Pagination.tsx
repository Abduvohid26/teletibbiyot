'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, totalPages, total, onPage }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
      <p className="text-xs text-slate-500">{total} ta natija</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="btn-secondary !py-1.5 !px-3 !text-xs disabled:opacity-40"
        >
          Oldingi
        </button>
        <span className="text-xs font-medium text-slate-600 px-2">{page} / {totalPages}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="btn-secondary !py-1.5 !px-3 !text-xs disabled:opacity-40"
        >
          Keyingi
        </button>
      </div>
    </div>
  );
}
