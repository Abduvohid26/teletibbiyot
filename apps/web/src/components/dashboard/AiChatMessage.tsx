'use client';

import { Fragment, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { parseAiText, parseInline } from '@/lib/ai-text';

function Inline({ text }: { text: string }) {
  const segments = useMemo(() => parseInline(text), [text]);
  return (
    <>
      {segments.map((seg, i) =>
        seg.bold ? (
          <strong key={i} className="font-semibold text-slate-900">
            {seg.text}
          </strong>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * AI javobini paragraf, sarlavha va ro'yxatlarga ajratib ko'rsatadi.
 * Foydalanuvchi savoli oddiy matn sifatida qoladi.
 */
export function AiChatMessage({ text, role }: { text: string; role: 'user' | 'assistant' }) {
  const blocks = useMemo(() => (role === 'assistant' ? parseAiText(text) : []), [text, role]);

  if (role === 'user') return <>{text}</>;

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        if (block.kind === 'heading') {
          return (
            <p key={i} className="font-semibold text-slate-900 text-[11px] uppercase tracking-wide">
              {block.text}
            </p>
          );
        }

        if (block.kind === 'paragraph') {
          return (
            <p key={i} className="leading-relaxed">
              <Inline text={block.text} />
            </p>
          );
        }

        return (
          <ul key={i} className={cn('space-y-1.5', block.ordered ? 'pl-0.5' : 'pl-0.5')}>
            {block.items.map((item, j) => (
              <li key={j} className="flex gap-1.5 leading-relaxed">
                <span
                  className={cn(
                    'shrink-0 tabular-nums',
                    block.ordered ? 'font-semibold text-violet-600' : 'text-violet-400',
                  )}
                >
                  {item.marker}
                </span>
                <span className="min-w-0">
                  <Inline text={item.text} />
                </span>
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
