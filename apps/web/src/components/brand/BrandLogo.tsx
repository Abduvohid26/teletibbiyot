import { BRAND } from '@ishifo/shared';
import { cn } from '@/lib/utils';

/**
 * iShifo logotipi (navy fon, oltin stetoskop va nurlar).
 * Kichik o'lchamlar uchun 128px, kattalari uchun 512px nusxa yuklanadi.
 */
export function BrandLogo({ size = 36, className }: { size?: number; className?: string }) {
  const src = size > 64 ? '/brand/ishifo-logo-512.webp' : '/brand/ishifo-logo-128.webp';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={size}
      height={size}
      alt={BRAND.name}
      decoding="async"
      className={cn('shrink-0 rounded-xl object-cover shadow-sm', className)}
      style={{ width: size, height: size }}
    />
  );
}
