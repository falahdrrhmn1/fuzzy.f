'use client';

import Image from 'next/image';
import { Component, type ReactNode } from 'react';
import type { Product, Variant } from '../../data/schema';

export class SceneErrorBoundary extends Component<{ fallback: ReactNode; resetKey: string; children: ReactNode }, { failed: boolean; key: string }> {
  state = { failed: false, key: this.props.resetKey };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  static getDerivedStateFromProps(props: { resetKey: string }, state: { failed: boolean; key: string }) {
    // ganti produk → coba render 3D lagi
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }
  componentDidCatch(err: unknown) {
    console.error('[fuzzy-flo] 3D gagal dirender:', err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Tampilan pengganti saat 3D tidak tersedia: foto asli + ukuran. */
export function PhotoFallback({ product, variant, reason }: { product: Product; variant: Variant; reason: string }) {
  const d = product.dimensions;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center" role="status">
      <div className="relative aspect-[4/5] h-[min(60%,420px)] overflow-hidden rounded-2xl bg-cream">
        <Image src={variant.photos[0]!} alt={`Foto ${product.name}`} fill sizes="320px" className="object-cover" />
      </div>
      <div>
        <p className="font-display text-lg">{product.name}</p>
        <p className="text-sm tabular-nums">{d ? `± ${d.heightCm} × ${d.widthCm} cm (tinggi × lebar)` : 'Ukuran belum tersedia'}</p>
        <p className="mt-2 max-w-sm text-xs text-ink-soft">{reason}</p>
      </div>
    </div>
  );
}

export function CanvasLoading() {
  return (
    <div className="flex h-full items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-ink-soft">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blush border-t-rose" />
        Menyiapkan model 3D…
      </div>
    </div>
  );
}
