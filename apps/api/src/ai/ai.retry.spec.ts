import { AiService } from './ai.service';

/**
 * AI so'rovlari vaqtinchalik xatolarda 3 martagacha qayta urinadi,
 * doimiy xatolarda (kalit noto'g'ri, balans tugagan) — darhol to'xtaydi.
 */
describe('AI qayta urinish', () => {
  const realFetch = global.fetch;
  let service: AiService;

  const ok = (content: string) =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  const fail = (status: number, body = '{}') => new Response(body, { status });

  beforeEach(() => {
    const config = { get: (k: string) => (k === 'OPENAI_API_KEY' ? 'sk-test' : undefined) };
    service = new AiService(
      {} as never, config as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    );
    // Testda kutmaymiz
    (service as unknown as { delay: () => Promise<void> }).delay = () => Promise.resolve();
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  const call = () =>
    (service as unknown as {
      requestOpenAiChat: (m: unknown[]) => Promise<{ ok: boolean; reason?: string; text?: string }>;
    }).requestOpenAiChat([{ role: 'user', content: 'salom' }]);

  it('provayder xatosidan keyin qayta urinib, javob oladi', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(fail(503))
      .mockResolvedValueOnce(fail(502))
      .mockResolvedValueOnce(ok('javob'));
    global.fetch = fetchMock as never;
    const res = await call();
    expect(res).toEqual({ ok: true, text: 'javob' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('tarmoq doim uzilsa — 1 + 3 urinishdan keyin to\'xtaydi', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    global.fetch = fetchMock as never;
    const res = await call();
    expect(res).toEqual({ ok: false, reason: 'network' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('vaqtinchalik 429 — qayta uriniladi', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(fail(429, '{"error":{"code":"rate_limit_exceeded"}}'))
      .mockResolvedValueOnce(ok('keyin'));
    global.fetch = fetchMock as never;
    expect(await call()).toEqual({ ok: true, text: 'keyin' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('balans tugagan (insufficient_quota) yoki kalit noto\'g\'ri — qayta urinilmaydi', async () => {
    let fetchMock = jest.fn().mockResolvedValue(fail(429, '{"error":{"code":"insufficient_quota"}}'));
    global.fetch = fetchMock as never;
    expect(await call()).toEqual({ ok: false, reason: 'quota' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock = jest.fn().mockResolvedValue(fail(401));
    global.fetch = fetchMock as never;
    expect(await call()).toEqual({ ok: false, reason: 'auth' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('tahlil: buzuq JSON kelsa qayta so\'raydi', async () => {
    const good = JSON.stringify({ summary: 'x', triageLevel: 'LOW', diagnoses: [] });
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(ok('{buzuq'))
      .mockResolvedValueOnce(ok(good));
    global.fetch = fetchMock as never;
    const res = await (service as unknown as {
      callOpenAiAnalysis: (d: unknown, l: string) => Promise<{ ok: boolean }>;
    }).callOpenAiAnalysis({}, 'uz');
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
