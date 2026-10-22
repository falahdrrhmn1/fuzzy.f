import Image from 'next/image';
import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur-sm lg:px-6">
      <Link href="/" className="flex items-center gap-2.5" aria-label="Fuzzy Flo — katalog">
        <span className="relative block h-9 w-9 overflow-hidden rounded-full">
          <Image src="/brand/logo.png" alt="" fill sizes="36px" className="scale-[1.32] object-cover" priority />
        </span>
        <span className="font-display text-lg leading-none tracking-tight">
          Fuzzy Flo<span className="ml-1.5 hidden text-sm text-ink-soft sm:inline">3D Studio</span>
        </span>
      </Link>
      <nav className="flex items-center gap-1 text-sm">
        <Link href="/" className="rounded-full px-3 py-2 text-ink-soft hover:text-ink">
          Katalog
        </Link>
        <Link href="/studio/pink-tulip-lily" className="rounded-full px-3 py-2 text-ink-soft hover:text-ink">
          3D Studio
        </Link>
      </nav>
    </header>
  );
}
