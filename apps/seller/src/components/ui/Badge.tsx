import type { ReactNode } from 'react';
type Variant = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple';
const v: Record<Variant, string> = {
  gray: 'bg-gray-100 text-gray-700', blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700', yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700',
};
export default function Badge({ children, variant = 'gray', className = '' }: { children: ReactNode; variant?: Variant; className?: string }) {
  return <span className={`badge ${v[variant]} ${className}`}>{children}</span>;
}
