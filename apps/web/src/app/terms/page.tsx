import Link from 'next/link';
import { BrandName } from '@/components/brand/BrandName';
import { PlatformFooter } from '@/components/layout/PlatformFooter';
import { BRAND } from '@ishifo/shared';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface py-12 px-4">
      <article className="max-w-3xl mx-auto panel p-8 sm:p-10 prose prose-slate">
        <p className="not-prose mb-2"><BrandName size="lg" className="text-slate-900" /></p>
        <h1>Foydalanish shartlari</h1>
        <p className="text-sm text-slate-500">Oxirgi yangilanish: 2026-yil iyul</p>

        <h2>1. Xizmat haqida</h2>
        <p>
          <BrandName size="sm" /> — masofaviy tibbiy konsultatsiya platformasi. AI tizimi faqat yordamchi
          vazifasini bajaradi; yakuniy tibbiy qaror malakali shifokorga tegishli.
        </p>

        <h2>2. Foydalanuvchi majburiyatlari</h2>
        <ul>
          <li>To&apos;g&apos;ri va to&apos;liq ma&apos;lumot kiritish</li>
          <li>Login ma&apos;lumotlarini maxfiy saqlash</li>
          <li>Bemor roziligini olish (UT operatorlar uchun)</li>
          <li>Tizimdan faqat ruxsat etilgan maqsadlarda foydalanish</li>
        </ul>

        <h2>3. Taqiqlangan harakatlar</h2>
        <ul>
          <li>Ruxsatsiz kirish yoki ma&apos;lumotlarni o&apos;g&apos;irlash</li>
          <li>Noto&apos;g&apos;ri yoki yolg&apos;on tibbiy ma&apos;lumot kiritish</li>
          <li>Tizim xavfsizligini buzishga urinish</li>
        </ul>

        <h2>4. Mas&apos;uliyat cheklovi</h2>
        <p>
          Platforma texnik nosozliklar yoki AI tavsiyalariga asoslanib qabul qilingan
          qarorlar uchun to&apos;liq mas&apos;uliyatni o&apos;z zimmasiga olmaydi.
        </p>

        <h2>5. Aloqa</h2>
        <p>
          Savollar bo&apos;yicha {BRAND.supporterShort} ma&apos;muriyati yoki tizim administratoriga murojaat qiling.
        </p>

        <div className="not-prose mt-10 pt-6 border-t border-slate-200">
          <PlatformFooter />
          <p className="mt-4">
            <Link href="/login" className="text-brand-600 hover:underline text-sm">
              ← Kirish sahifasiga qaytish
            </Link>
          </p>
        </div>
      </article>
    </div>
  );
}
