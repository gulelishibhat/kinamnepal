// Display helpers for the HamroBazaar-style storefront.

/** Rs 1,25,000 style — no decimals, thousands separators. */
export function formatPrice(value: string | number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Rs 0';
  return `Rs ${Math.round(n).toLocaleString('en-IN')}`;
}

/** "3 hours ago" / "2 days ago" relative time from an ISO date string. */
export function timeAgo(date: string | Date | undefined | null): string {
  if (!date) return '';
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < 0) return 'just now';

  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const month = Math.floor(day / 30);
  const year = Math.floor(day / 365);

  if (sec < 60) return 'just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  if (month < 12) return `${month} month${month === 1 ? '' : 's'} ago`;
  return `${year} year${year === 1 ? '' : 's'} ago`;
}

export type Condition = 'brand_new' | 'like_new' | 'used';

const CONDITION_LABELS: Record<Condition, string> = {
  brand_new: 'Brand New',
  like_new: 'Like New',
  used: 'Used',
};

export function conditionLabel(condition: string | undefined | null): string | null {
  if (!condition) return null;
  return CONDITION_LABELS[condition as Condition] ?? null;
}

/** Tailwind classes for a condition badge, HamroBazaar palette. */
export function conditionBadgeClasses(condition: string | undefined | null): string {
  switch (condition) {
    case 'brand_new':
      return 'bg-green-100 text-green-700';
    case 'like_new':
      return 'bg-blue-100 text-blue-700';
    case 'used':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}
