import { groundAttachmentResult } from './attachment-analysis.service';

/**
 * Hujjat tahlili faqat hujjatda yozilgan narsaga tayanishi kerak:
 * model o'ylab topgan ko'rsatkichlar olib tashlanadi.
 */
describe('groundAttachmentResult', () => {
  it("faqat sarlavhali PDF — to'qilgan 'qizil qon hujayralari past' olib tashlanadi", () => {
    const out = groundAttachmentResult(
      {
        transcript: 'Qon tahlili',
        hasResults: true,
        summary: 'Qon tahlili: qizil qon hujayralari past',
        documentType: 'lab',
        findings: [],
        abnormalities: [{ text: 'Qizil qon hujayralari past', quote: 'Qon tahlili' }],
        recommendations: ['Temir preparatlari'],
        confidence: 80,
      },
      'Qon tahlili.pdf',
    );
    expect(out?.hasResults).toBe(false);
    expect(out?.abnormalities).toEqual([]);
    expect(out?.recommendations).toEqual([]);
    expect(out?.summary).toMatch(/natijalari topilmadi/);
  });

  it("model o'zi natija yo'q desa — hamma narsa bo'shatiladi", () => {
    const out = groundAttachmentResult(
      { transcript: '', hasResults: false, summary: 'Bo\'sh forma', findings: ['x'], abnormalities: [] },
      'forma.pdf',
    );
    expect(out?.hasResults).toBe(false);
    expect(out?.findings).toEqual([]);
  });

  it('hujjatdagi haqiqiy qiymat saqlanadi, hujjatda yo\'q raqam tushiriladi', () => {
    const out = groundAttachmentResult(
      {
        transcript: 'Umumiy qon tahlili\nGemoglobin 95 g/l (norma 120-160)\nLeykotsitlar 6,2 x10^9/l',
        hasResults: true,
        summary: 'Gemoglobin pasaygan',
        documentType: 'lab',
        findings: [{ text: 'Leykotsitlar 6.2 x10^9/l — me\'yorda', quote: 'Leykotsitlar 6,2 x10^9/l' }],
        abnormalities: [
          { text: 'Gemoglobin 95 g/l — past', quote: 'Gemoglobin 95 g/l' },
          { text: 'Eritrotsitlar 3.1 — past', quote: 'Eritrotsitlar 3.1' },
          { text: 'Trombotsitlar past', quote: '' },
        ],
        recommendations: ['Temir zaxirasini tekshirish'],
        confidence: 85,
      },
      'tahlil.pdf',
    );
    expect(out?.hasResults).toBe(true);
    expect(out?.abnormalities).toEqual(['Gemoglobin 95 g/l — past']);
    expect(out?.findings).toHaveLength(1);
    expect(out?.droppedUnsupported).toBe(2);
    expect(out?.confidence).toBeLessThanOrEqual(50);
    expect(out?.evidence?.map((e) => e.quote)).toContain('Gemoglobin 95 g/l');
  });

  it("raqami hujjatdagidan farq qiladigan band tushiriladi", () => {
    const out = groundAttachmentResult(
      {
        transcript: 'Gemoglobin 95 g/l',
        summary: 's',
        documentType: 'lab',
        abnormalities: [{ text: 'Gemoglobin 85 g/l — past', quote: 'Gemoglobin 95 g/l' }],
      },
      'a.pdf',
    );
    expect(out?.abnormalities).toEqual([]);
    expect(out?.hasResults).toBe(false);
  });

  it('rentgen tasviridagi vizual topilma iqtibossiz ham saqlanadi', () => {
    const out = groundAttachmentResult(
      {
        transcript: '',
        hasResults: true,
        summary: "O'ng o'pka pastki qismida soyalanish",
        documentType: 'rentgen',
        findings: [{ text: "O'ng pastki bo'lakda infiltrativ soya", quote: '' }],
        abnormalities: [],
        recommendations: ['KT bilan aniqlashtirish'],
        confidence: 60,
      },
      'xray.jpg',
    );
    expect(out?.hasResults).toBe(true);
    expect(out?.findings).toHaveLength(1);
    expect(out?.recommendations).toEqual(['KT bilan aniqlashtirish']);
  });

  it("summary bo'lmasa — yaroqsiz javob", () => {
    expect(groundAttachmentResult({ transcript: 'x' }, 'a.pdf')).toBeNull();
  });
});
