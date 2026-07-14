import Link from 'next/link';
import { BrandName } from '@/components/brand/BrandName';
import { PlatformFooter } from '@/components/layout/PlatformFooter';
import { BRAND } from '@ishifo/shared';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface py-12 px-4">
      <article className="max-w-3xl mx-auto panel p-8 sm:p-10 prose prose-slate">
        <p className="not-prose mb-2"><BrandName size="lg" className="text-slate-900" /></p>
        <h1>Maxfiylik siyosati</h1>
        <p className="text-sm text-slate-500">Oxirgi yangilanish: 2026-yil iyul</p>

        <h2>1. Umumiy ma&apos;lumot</h2>
        <p>
          <BrandName size="sm" /> platformasi {BRAND.supporter} (FJSTI) tomonidan
          uzoq masofadan tibbiy konsultatsiya xizmatlarini ko&apos;rsatish uchun ishlatiladi.
        </p>

        <h2>2. Yig&apos;iladigan ma&apos;lumotlar</h2>
        <ul>
          <li>Shaxsiy ma&apos;lumotlar: F.I.Sh., tug&apos;ilgan sana, aloqa ma&apos;lumotlari</li>
          <li>Tibbiy ma&apos;lumotlar: shikoyatlar, anamnez, vital ko&apos;rsatkichlar, tekshiruv natijalari</li>
          <li>Texnik ma&apos;lumotlar: IP manzil, kirish vaqt, audit jurnali</li>
        </ul>

        <h2>3. Ma&apos;lumotlardan foydalanish</h2>
        <p>
          Ma&apos;lumotlar faqat tibbiy konsultatsiya, tashxis va davolash jarayonida,
          shuningdek qonunchilik talablariga muvofiq saqlanadi va ishlatiladi.
        </p>

        <h2>4. Xavfsizlik</h2>
        <p>
          Ma&apos;lumotlar shifrlangan aloqa (HTTPS), rol asosidagi kirish nazorati (RBAC),
          audit jurnali va xavfsiz fayl saqlash (MinIO) orqali himoyalanadi.
        </p>

        <h2>5. Huquqlaringiz</h2>
        <p>
          Bemor yoki vakili ma&apos;lumotlarni ko&apos;rish, tuzatish yoki o&apos;chirish bo&apos;yicha
          muassasa ma&apos;muriyatiga murojaat qilishi mumkin.
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
