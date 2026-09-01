// =============================================================
// sanitize.ts - XSS Prevention Utilities
// Use these whenever rendering user-supplied text in HTML context.
// =============================================================

// Characters that are dangerous in HTML context
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

/**
 * Escape a string for safe insertion as text content or attribute value.
 * Use this when you must set innerHTML or build HTML strings.
 * Prefer React's default rendering (JSX) over innerHTML wherever possible.
 */
export function escapeHtml(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text).replace(/[&<>"'/]/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

/**
 * Strip all HTML tags from a string (plain text only).
 * Useful for displaying user-provided text that might contain tags.
 */
export function stripTags(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text).replace(/<[^>]*>/g, '');
}

/**
 * Sanitize a URL — block javascript:, data:, vbscript: schemes.
 * Returns '#' for unsafe URLs.
 */
export function sanitizeUrl(url: unknown): string {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:')
  ) {
    return '#';
  }
  return url.trim();
}

/**
 * Sanitize user text for display in a React component.
 * Returns a plain string (tags stripped, HTML-safe).
 * Use as: <span>{sanitizeDisplay(userInput)}</span>
 */
export function sanitizeDisplay(text: unknown): string {
  return stripTags(escapeHtml(text));
}

/**
 * Sanitize a search query — remove special regex/SQL chars, limit length.
 * Use before sending user search input to the API.
 */
export function sanitizeSearchQuery(query: unknown, maxLength = 200): string {
  if (!query || typeof query !== 'string') return '';
  return query
    .trim()
    .slice(0, maxLength)
    .replace(/[<>"']/g, ''); // Remove chars that could cause issues in query strings
}

/**
 * Sanitize a filename for display or download.
 * Strips path traversal and special chars.
 */
export function sanitizeFilename(name: unknown): string {
  if (!name || typeof name !== 'string') return 'file';
  return name
    .replace(/[^a-zA-Z0-9._\-\s]/g, '')
    .replace(/\.{2,}/g, '.')
    .trim()
    .slice(0, 255);
}
