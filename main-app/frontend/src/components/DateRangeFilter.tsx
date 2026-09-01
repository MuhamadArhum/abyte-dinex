import { Calendar } from 'lucide-react';
import { localToday, localMonthStart } from '../utils/dateUtils';

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
  onApply?: () => void;
  applyLabel?: string;
  /** false = render controls only (embed inside existing filter card); true (default) = render with its own white card wrapper */
  standalone?: boolean;
}

const DateRangeFilter = ({
  dateFrom, dateTo, onFromChange, onToChange,
  onApply, applyLabel = 'Apply', standalone = true
}: DateRangeFilterProps) => {

  const handlePreset = (preset: string) => {
    const today = localToday();
    let from = today;
    if (preset === 'week') {
      const d = new Date();
      const w = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6);
      from = `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}-${String(w.getDate()).padStart(2, '0')}`;
    } else if (preset === 'month') {
      from = localMonthStart();
    }
    onFromChange(from);
    onToChange(today);
  };

  const inner = (
    <>
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {[['today', 'Today'], ['week', 'This Week'], ['month', 'This Month']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => handlePreset(key)}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 hover:bg-white hover:shadow transition-all"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Calendar size={18} className="text-gray-400" />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onFromChange(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onToChange(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>
      {onApply && (
        <button
          onClick={onApply}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition"
        >
          {applyLabel}
        </button>
      )}
    </>
  );

  if (!standalone) return <>{inner}</>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-wrap items-center gap-4">
      {inner}
    </div>
  );
};

export default DateRangeFilter;
