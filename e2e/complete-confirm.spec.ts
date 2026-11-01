import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { API_BASE } from './helpers/api-client';
import { loginAs } from './helpers/login';
import { PASSWORD, prepareVideoConsultation, seedDoctorMediaPrefs } from './helpers/video-setup';

/**
 * Yakunlash: bir bosishda emas — "Ha / Yo'q" tasdig'i va ixtiyoriy shifokor izohi.
 * Izoh yozilsa yakuniy tashxisga va PDF ga tushadi.
 */
test('Yakunlash tasdig\'i va izoh PDF da', async ({ browser }) => {
  test.setTimeout(240_000);
  const { consultation, mt } = await prepareVideoConsultation({ start: true });

  // AI tashxisi tayyor bo'lishini kutamiz (bo'lmasa — qo'lda kiritish oynasi ochiladi, bu boshqa sinov)
  const hasDx = await expect
    .poll(async () => {
      const c = await mt.get<{ aiAnalysis?: { diagnoses?: Array<{ name?: string }>; rawResponse?: { aiUnavailable?: boolean } } }>(`/consultations/${consultation.id}`);
      if (c.aiAnalysis?.rawResponse?.aiUnavailable) return 'unavailable';
      return c.aiAnalysis?.diagnoses?.some((d) => d.name) ? 'ready' : 'pending';
    }, { timeout: 120_000, intervals: [3000] })
    .not.toBe('pending')
    .then(async () => (await mt.get<{ aiAnalysis?: { rawResponse?: { aiUnavailable?: boolean } } }>(`/consultations/${consultation.id}`)).aiAnalysis?.rawResponse?.aiUnavailable !== true);
  test.skip(!hasDx, 'AI tashxis bermadi — bu sinov AI tashxisi bilan yakunlash uchun');

  const page = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
  await seedDoctorMediaPrefs(page);
  try {
    await loginAs(page, 'doctor@ishifo.uz', PASSWORD, /\/dashboard/);
    await page.goto('/dashboard');
    const completeBtn = page.getByRole('button', { name: /^Yakunlash/ }).first();
    await completeBtn.click();
    const dialog = page.getByRole('dialog', { name: 'Konsultatsiyani yakunlaysizmi?' });
    await expect(dialog).toBeVisible();

    // "Yo'q" — hech narsa o'zgarmaydi
    await dialog.getByRole('button', { name: "Yo'q, qaytish" }).click();
    await expect(dialog).toHaveCount(0);
    expect((await mt.get<{ status: string }>(`/consultations/${consultation.id}`)).status).toBe('IN_PROGRESS');

    // "Ha" + izoh
    const note = 'Nazorat 2 haftadan keyin, ibuprofen 400 mg kuniga 2 marta';
    await completeBtn.click();
    await page.locator('#complete-notes').fill(note);
    if (process.env.E2E_SHOTS_DIR) {
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/complete-confirm.png` });
    }
    await dialog.getByRole('button', { name: /^Ha, yakunlash/ }).click();
    await expect(dialog).toHaveCount(0, { timeout: 60_000 });

    const done = await mt.get<{ status: string; finalDiagnosis?: { notes?: string } }>(`/consultations/${consultation.id}`);
    expect(done.status).toBe('COMPLETED');
    expect(done.finalDiagnosis?.notes).toBe(note);

    // PDF da izoh bor
    const res = await fetch(`${API_BASE}/api/ai/consultations/${consultation.id}/analysis-pdf?locale=uz`, {
      headers: { Authorization: `Bearer ${mt.accessToken}`, 'X-Ishifo-Client': 'web' },
    });
    expect(res.ok).toBe(true);
    const dir = mkdtempSync(join(tmpdir(), 'pdf-'));
    const file = join(dir, 'x.pdf');
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    let text = '';
    try {
      text = execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
    } catch {
      test.info().annotations.push({ type: 'note', description: 'pdftotext yo\'q — PDF matni tekshirilmadi' });
      return;
    }
    expect(text).toContain('ibuprofen 400 mg');
  } finally {
    await mt.completeActiveConsultationIfAny().catch(() => undefined);
  }
});
