import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-brand-600 mb-2">404</p>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Sahifa topilmadi</h1>
        <p className="text-slate-600 text-sm mb-6">
          So&apos;ralgan manzil mavjud emas yoki ko&apos;chirilgan.
        </p>
        <Link href="/login" className="btn-primary inline-block">
          Bosh sahifaga qaytish
        </Link>
      </div>
    </div>
  );
}
