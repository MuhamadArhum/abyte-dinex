import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  onItemsPerPageChange?: (limit: number) => void;
}

const LIMITS = [10, 20, 50, 100];

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  onItemsPerPageChange,
}) => {
  if (totalPages <= 1 && !onItemsPerPageChange) return null;

  const safeTotal = Math.max(1, totalPages);
  const from = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const to   = Math.min(currentPage * itemsPerPage, totalItems);

  const btn = (base: string) =>
    `${base} inline-flex items-center justify-center h-9 rounded-lg border border-gray-200 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed`;

  /* page number pills — show up to 5 */
  const pages: number[] = [];
  let start = Math.max(1, currentPage - 2);
  const end = Math.min(safeTotal, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 bg-white px-4 py-3 rounded-b-xl">

      {/* Left — result count + rows-per-page */}
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>
          {totalItems === 0
            ? 'No results'
            : <>Showing <strong className="text-gray-800">{from}–{to}</strong> of <strong className="text-gray-800">{totalItems.toLocaleString()}</strong></>
          }
        </span>

        {onItemsPerPageChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">·</span>
            <label className="text-gray-400">Rows:</label>
            <select
              value={LIMITS.includes(itemsPerPage) ? itemsPerPage : ''}
              onChange={e => onItemsPerPageChange(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 cursor-pointer"
            >
              {LIMITS.map(n => <option key={n} value={n}>{n}</option>)}
              {!LIMITS.includes(itemsPerPage) && (
                <option value={itemsPerPage}>{itemsPerPage}</option>
              )}
            </select>
          </div>
        )}
      </div>

      {/* Right — navigation */}
      <div className="flex items-center gap-1">

        {/* First */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={btn('w-9 text-gray-500 hover:bg-gray-50 hover:text-emerald-600')}
          title="First page"
        >
          <ChevronsLeft size={15} />
        </button>

        {/* Prev */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={btn('w-9 text-gray-500 hover:bg-gray-50 hover:text-emerald-600')}
          title="Previous page"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Page pills */}
        <div className="flex items-center gap-1 mx-1">
          {start > 1 && (
            <span className="w-9 text-center text-gray-400 text-sm select-none">…</span>
          )}
          {pages.map(p => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-9 h-9 rounded-lg border text-sm font-medium transition-colors ${
                p === currentPage
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                  : 'border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
              }`}
            >
              {p}
            </button>
          ))}
          {end < safeTotal && (
            <span className="w-9 text-center text-gray-400 text-sm select-none">…</span>
          )}
        </div>

        {/* Page X of Y */}
        <span className="hidden sm:inline-flex items-center px-3 h-9 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap select-none">
          {currentPage} / {safeTotal}
        </span>

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= safeTotal}
          className={btn('w-9 text-gray-500 hover:bg-gray-50 hover:text-emerald-600')}
          title="Next page"
        >
          <ChevronRight size={15} />
        </button>

        {/* Last */}
        <button
          onClick={() => onPageChange(safeTotal)}
          disabled={currentPage >= safeTotal}
          className={btn('w-9 text-gray-500 hover:bg-gray-50 hover:text-emerald-600')}
          title="Last page"
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
