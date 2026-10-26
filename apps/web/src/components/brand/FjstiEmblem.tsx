import { BRAND } from '@ishifo/shared';
import { cn } from '@/lib/utils';

/**
 * FJSTI (Farg'ona jamoat salomatligi tibbiyot instituti) emblemasi —
 * platformani qo'llab-quvvatlovchi institut belgisi.
 * Kichik o'lchamlar uchun 128px, kattalari uchun 512px nusxa yuklanadi.
 */
export function FjstiEmblem({ size = 32, className }: { size?: number; className?: string }) {
  const src = size > 64 ? '/brand/fjsti-emblem-512.webp' : '/brand/fjsti-emblem-128.webp';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={size}
      height={size}
      alt={BRAND.supporter}
      title={BRAND.supporter}
      loading="lazy"
      decoding="async"
      className={cn('shrink-0 rounded-full object-cover ring-1 ring-black/10', className)}
      style={{ width: size, height: size }}
    />
  );
}
