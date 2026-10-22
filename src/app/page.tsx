import Image from 'next/image';
import Link from 'next/link';
import { PRODUCTS } from '../data/products';

export default function CatalogPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 lg:px-6">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">Buket kawat bulu, dalam ukuran sebenarnya.</h1>
        <p className="mt-3 text-ink-soft">
          Pilih buket, putar modelnya, lalu bandingkan dengan tinggi badanmu, termasuk saat buket dipegang.
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {PRODUCTS.map((p) => {
          const v = p.variants[0]!;
          const thumb = v.photos[0]!.replace('.jpg', '-thumb.jpg');
          return (
            <li key={p.id}>
              <Link href={`/studio/${p.id}`} className="group block">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-cream">
                  <Image
                    src={thumb}
                    alt={`Foto ${p.name}`}
                    fill
                    sizes="(min-width:1024px) 22vw, (min-width:640px) 30vw, 46vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  {p.variants.length > 1 && (
                    <span className="absolute bottom-2 left-2 ff-chip bg-surface/90">{p.variants.length} warna</span>
                  )}
                </div>
                <div className="mt-2.5">
                  <h2 className="font-display text-[1.05rem] leading-snug">{p.name}</h2>
                  <p className="text-sm text-ink-soft">{p.sizeLabel}</p>
                  <p className="mt-1 text-sm font-medium tabular-nums">
                    {p.dimensions ? `± ${p.dimensions.heightCm} × ${p.dimensions.widthCm} cm` : 'Ukuran: tanyakan admin'}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-12 max-w-2xl text-xs leading-relaxed text-ink-soft">
        Ukuran berasal dari keterangan katalog penjual (±) dan belum diukur ulang. Model 3D adalah representasi yang dibuat
        dari foto, bukan hasil pemindaian, sehingga detail bentuk dan bagian belakang buket merupakan perkiraan.
      </p>
    </main>
  );
}
