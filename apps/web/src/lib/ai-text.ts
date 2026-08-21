/**
 * AI javobini o'qiladigan bloklarga ajratadi.
 *
 * Modeldan oddiy matn so'ralgan bo'lsa ham, u ko'pincha markdown qaytaradi
 * (`**qalin**`, `1.` ro'yxat, `- ` band). Xom holda ko'rsatilsa yulduzchalar
 * ko'rinib qoladi va butun javob bitta uzun blokka aylanadi.
 */

export type AiTextBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: Array<{ marker: string; text: string }> };

export interface AiInlineSegment {
  text: string;
  bold: boolean;
}

const ORDERED_ITEM = /^\s*(\d{1,2})[.)]\s+(.*)$/;
const BULLET_ITEM = /^\s*[-*•–]\s+(.*)$/;

/** `**qalin**` bo'laklarini ajratadi; juftlanmagan yulduzchalar oddiy matn sifatida qoladi */
export function parseInline(text: string): AiInlineSegment[] {
  const segments: AiInlineSegment[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text))) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index), bold: false });
    segments.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), bold: false });

  return segments.filter((s) => s.text.length > 0);
}

/** Butunlay qalin va qisqa qator — sarlavha deb qaraladi */
function isHeading(line: string): boolean {
  const m = /^\*\*(.+?)\*\*:?$/.exec(line.trim());
  return !!m && m[1].length <= 80;
}

export function parseAiText(raw: string): AiTextBlock[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: AiTextBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: Array<{ marker: string; text: string }> } | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ').trim() });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({ kind: 'list', ordered: list.ordered, items: list.items });
    list = null;
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    if (isHeading(trimmed)) {
      flushAll();
      blocks.push({ kind: 'heading', text: trimmed.replace(/^\*\*|\*\*:?$/g, '').trim() });
      continue;
    }

    const ordered = ORDERED_ITEM.exec(trimmed);
    if (ordered) {
      flushParagraph();
      // "1. 1.Matn" kabi takroriy raqamlashni tozalaymiz
      const body = ordered[2].replace(new RegExp(`^${ordered[1]}[.)]\\s*`), '').trim();
      if (!list?.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push({ marker: `${ordered[1]}.`, text: body });
      continue;
    }

    const bullet = BULLET_ITEM.exec(trimmed);
    if (bullet) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push({ marker: '•', text: bullet[1].trim() });
      continue;
    }

    // Ro'yxat davomidagi o'ralgan qator — oxirgi bandga qo'shiladi
    if (list?.items.length) {
      list.items[list.items.length - 1].text += ` ${trimmed}`;
      continue;
    }

    paragraph.push(trimmed);
  }

  flushAll();
  return blocks;
}
