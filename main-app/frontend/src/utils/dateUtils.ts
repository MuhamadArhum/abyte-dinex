// Returns today's date as YYYY-MM-DD using LOCAL timezone (not UTC)
export const localToday = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Returns first day of current month as YYYY-MM-DD using LOCAL timezone
export const localMonthStart = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
};

// Returns first day of current year as YYYY-MM-DD using LOCAL timezone
export const localYearStart = (): string => {
  return `${new Date().getFullYear()}-01-01`;
};

// Returns YYYY-MM (current month) using LOCAL timezone
export const localMonthStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};
