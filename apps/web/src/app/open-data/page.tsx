import Link from 'next/link';
import { BRAND, brandCopyright } from '@ishifo/shared';
import { BrandName } from '@/components/brand/BrandName';
import { PlatformFooter } from '@/components/layout/PlatformFooter';

export default function OpenDataPage() {
  return (
    <div className="min-h-screen bg-surface py-12 px-4">
      <article className="max-w-3xl mx-auto panel p-8 sm:p-10">
        <div className="mb-6">
          <BrandName size="xl" className="text-slate-900" />
          <p className="mt-2 text-sm text-slate-500">{BRAND.tagline}</p>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Ochiq ma&apos;lumotlar bazasi</h1>
        <p className="text-sm text-slate-500 mb-8">{brandCopyright()} · Mualliflik huquqi va litsenziya ma&apos;lumotlari</p>

        <div className="space-y-4 text-sm text-slate-700">
          <section className="rounded-xl border border-slate-200 p-4">
            <h2 className="font-semibold text-slate-900 mb-2">Platforma</h2>
            <p>
              <BrandName size="sm" /> — {BRAND.tagline}. AI tizimi faqat yordamchi vazifasini bajaradi;
              yakuniy tibbiy qaror malakali shifokorga tegishli.
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 p-4 space-y-2">
            <h2 className="font-semibold text-slate-900 mb-2">Mualliflik va litsenziya</h2>
            <p><span className="font-medium">Ishlab chiqaruvchi:</span> {BRAND.developer}</p>
            <p><span className="font-medium">Qo&apos;llab-quvvatlovchi:</span> {BRAND.supporter}</p>
            <p><span className="font-medium">Patent raqami:</span> {BRAND.patent}</p>
            <p><span className="font-medium">Litsenziyalangan:</span> {BRAND.license}</p>
            <p><span className="font-medium">Sertifikatlangan:</span> {BRAND.certification}</p>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h2 className="font-semibold text-slate-900 mb-2">Ochiq ma&apos;lumotlar</h2>
            <p className="mb-3">
              Platforma ochiq ma&apos;lumotlar tamoyillari asosida ishlaydi. Tibbiy va shaxsiy ma&apos;lumotlar
              maxfiylik qonunlari va bemor roziligi doirasida himoyalangan.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>Platforma metama&apos;lumotlari va litsenziya shartlari ochiq</li>
              <li>Audit jurnali faqat vakolatli foydalanuvchilar uchun</li>
              <li>Bemor ma&apos;lumotlari shifrlangan va RBAC orqali himoyalangan</li>
            </ul>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200">
          <PlatformFooter variant="compact" />
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
