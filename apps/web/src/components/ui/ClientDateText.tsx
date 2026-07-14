'use client';

import { useEffect, useState, useMemo } from 'react';

type ClientDateTextProps = {
  format: Intl.DateTimeFormatOptions;
  locale?: string;
  value?: Date | string | number;
  fallback?: string;
  className?: string;
};

/** SSR/client hydration xatosiz sana/vaqt ko'rsatish */
export function ClientDateText({
  format,
  locale = 'uz-UZ',
  value,
  fallback = '—',
  className,
}: ClientDateTextProps) {
  const [text, setText] = useState(fallback);
  const formatKey = useMemo(() => JSON.stringify(format), [format]);

  useEffect(() => {
    const date = value != null ? new Date(value) : new Date();
    setText(date.toLocaleString(locale, format));
  }, [formatKey, locale, value, format]);

  return <span className={className}>{text}</span>;
}
