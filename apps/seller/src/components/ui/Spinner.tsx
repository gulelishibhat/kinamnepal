export default function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = { sm: 'h-4 w-4', md: 'h-7 w-7', lg: 'h-12 w-12' }[size];
  return <div className={`animate-spin rounded-full border-2 border-gray-200 border-t-primary-600 ${s} ${className}`} role="status" aria-label="Loading" />;
}
