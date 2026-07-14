import { cn } from '@/lib/utils';

type BrandNameSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeClass: Record<BrandNameSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl',
};

/** iPhone uslubida: i + Shifo */
export function BrandName({
  className,
  size = 'md',
}: {
  className?: string;
  size?: BrandNameSize;
}) {
  return (
    <span className={cn('inline-flex items-baseline font-bold tracking-tight', sizeClass[size], className)}>
      <span className="font-normal">i</span>
      <span>Shifo</span>
    </span>
  );
}
