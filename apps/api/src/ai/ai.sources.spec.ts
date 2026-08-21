import { sanitizeSourceUrls } from './ai.service';

type Article = { title: string; url?: string; sourceType?: string };

function build(articles: Article[]) {
  return {
    summary: 's',
    diagnoses: [],
    triageLevel: 'LOW',
    recommendations: [],
    redFlags: [],
    clinicalConclusion: { scientificArticles: articles },
  } as never;
}

function articlesOf(result: unknown): Article[] {
  const cc = (result as { clinicalConclusion?: { scientificArticles?: Article[] } }).clinicalConclusion;
  return cc?.scientificArticles ?? [];
}

describe('sanitizeSourceUrls', () => {
  it('barqaror manbalar havolasini saqlaydi', () => {
    const out = sanitizeSourceUrls(
      build([
        { title: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/' },
        { title: 'DOI', url: 'https://doi.org/10.1000/abc' },
        { title: 'WHO', url: 'https://icd.who.int/browse10' },
      ]),
    );
    expect(articlesOf(out).map((a) => a.url)).toEqual([
      'https://pubmed.ncbi.nlm.nih.gov/12345678/',
      'https://doi.org/10.1000/abc',
      'https://icd.who.int/browse10',
    ]);
  });

  it("o'ylab topilgan milliy chuqur havolani tushiradi, nomini saqlaydi", () => {
    const out = sanitizeSourceUrls(
      build([{ title: 'Allergik rinofaringit protokoli', url: 'https://www.ssv.uz/allergik-rinofaringit' }]),
    );
    const [article] = articlesOf(out);
    expect(article.url).toBeUndefined();
    expect(article.title).toBe('Allergik rinofaringit protokoli');
  });

  it('notoʻgʻri URL va boshqa sxemalarni tushiradi', () => {
    const out = sanitizeSourceUrls(
      build([
        { title: 'Buzuq', url: 'not-a-url' },
        { title: 'Javascript', url: 'javascript:alert(1)' },
      ]),
    );
    expect(articlesOf(out).every((a) => a.url === undefined)).toBe(true);
  });

  it("o'xshash domenni ishonchli deb hisoblamaydi", () => {
    const out = sanitizeSourceUrls(build([{ title: 'Soxta', url: 'https://doi.org.evil.com/10.1/x' }]));
    expect(articlesOf(out)[0].url).toBeUndefined();
  });

  it('clinicalConclusion yoki manbalar bo\'lmasa o\'zgartirmaydi', () => {
    const input = { summary: 's', triageLevel: 'LOW' } as never;
    expect(sanitizeSourceUrls(input)).toBe(input);
  });
});
