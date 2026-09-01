import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  onItemsPerPageChange?: (limit: number) => void;
}

const PRESET_LIMITS = [10, 20, 25, 50, 100];

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  onItemsPerPageChange
}) => {
  const isCustom = !PRESET_LIMITS.includes(itemsPerPage);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue]         = useState('');
  const customInputRef = useRef<HTMLInputElement>(null);

  // Focus custom input when it appears
  useEffect(() => {
    if (showCustomInput && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [showCustomInput]);

  if (totalPages <= 1 && !onItemsPerPageChange) return null;

  // ── Page buttons ────────────────────────────────────────────
  const renderPageButtons = () => {
    const buttons: React.ReactNode[] = [];
    const maxVisible = 5;

    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end   = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

    if (start > 1) {
      buttons.push(
        <button
          key={1}
          onClick={() => onPageChange(1)}
          className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
        >1</button>
      );
      if (start > 2) {
        buttons.push(
          <span key="s-ellipsis" className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-500 ring-1 ring-inset ring-gray-300">
            …
          </span>
        );
      }
    }

    for (let p = start; p <= end; p++) {
      buttons.push(
        <button
          key={p}
          onClick={() => onPageChange(p)}
          aria-current={p === currentPage ? 'page' : undefined}
          className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold transition-colors ${
            p === currentPage
              ? 'z-10 bg-emerald-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600'
              : 'text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-emerald-50 hover:text-emerald-700'
          }`}
        >{p}</button>
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        buttons.push(
          <span key="e-ellipsis" className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-500 ring-1 ring-inset ring-gray-300">
            …
          </span>
        );
      }
      buttons.push(
        <button
          key={totalPages}
          onClick={() => onPageChange(totalPages)}
          className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
        >{totalPages}</button>
      );
    }

    return buttons;
  };

  // ── Per-page selector handler ───────────────────────────────
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      setCustomValue('');
      setShowCustomInput(true);
    } else {
      setShowCustomInput(false);
      onItemsPerPageChange?.(Number(val));
    }
  };

  const applyCustom = () => {
    const num = parseInt(customValue);
    if (!num || num < 1) return;
    const clamped = Math.min(num, 1000);
    setShowCustomInput(false);
    onItemsPerPageChange?.(clamped);
  };

  const handleCustomKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') applyCustom();
    if (e.key === 'Escape') setShowCustomInput(false);
  };

  // ── Derived values ──────────────────────────────────────────
  const startItem = totalItems === 0 ? 0 : Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
  const endItem   = Math.min(currentPage * itemsPerPage, totalItems);

  // Select value: show "custom" if current limit is not a preset
  const selectValue = isCustom ? 'custom' : String(itemsPerPage);

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4 rounded-b-xl">

      {/* ── Mobile ───────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-between sm:hidden gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>

        <span className="text-sm text-gray-600 font-medium">
          {currentPage} / {totalPages || 1}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Desktop ──────────────────────────────────────────── */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between gap-4">

        {/* Left: result info + per-page selector */}
        <div className="flex items-center gap-4 flex-wrap">
          <p className="text-sm text-gray-600 whitespace-nowrap">
            Showing{' '}
            <span className="font-semibold text-gray-800">{startItem}</span>
            {' '}–{' '}
            <span className="font-semibold text-gray-800">{endItem}</span>
            {' '}of{' '}
            <span className="font-semibold text-gray-800">{totalItems}</span>
            {' '}results
          </p>

          {/* Per-page controls — always visible when callback provided */}
          {onItemsPerPageChange && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 whitespace-nowrap">Per page:</label>

              {/* Preset + Custom dropdown */}
              {!showCustomInput ? (
                <select
                  value={selectValue}
                  onChange={handleSelectChange}
                  className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white text-gray-700 transition-colors cursor-pointer"
                >
                  {PRESET_LIMITS.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                  <option value="custom">
                    {isCustom ? `${itemsPerPage} (custom)` : 'Custom...'}
                  </option>
                </select>
              ) : (
                /* Custom number input */
                <div className="flex items-center gap-1.5">
                  <input
                    ref={customInputRef}
                    type="number"
                    min={1}
                    max={1000}
                    value={customValue}
                    onChange={e => setCustomValue(e.target.value)}
                    onKeyDown={handleCustomKey}
                    placeholder="e.g. 75"
                    className="w-24 text-sm border border-emerald-400 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-gray-700"
                  />
                  <button
                    onClick={applyCustom}
                    className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    title="Apply"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setShowCustomInput(false)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-1"
                    title="Cancel"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Show current custom value as badge */}
              {isCustom && !showCustomInput && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                  {itemsPerPage} / page
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: page navigation */}
        <nav
          className="isolate inline-flex -space-x-px rounded-lg shadow-sm overflow-hidden border border-gray-300 flex-shrink-0"
          aria-label="Pagination"
        >
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-2.5 py-2 text-gray-500 bg-white hover:bg-emerald-50 hover:text-emerald-600 focus:z-20 focus:outline-offset-0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-r border-gray-300"
          >
            <span className="sr-only">Previous</span>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          {renderPageButtons()}

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="relative inline-flex items-center px-2.5 py-2 text-gray-500 bg-white hover:bg-emerald-50 hover:text-emerald-600 focus:z-20 focus:outline-offset-0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-l border-gray-300"
          >
            <span className="sr-only">Next</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  );
};

export default Pagination;
