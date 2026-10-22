'use client';

import dynamic from 'next/dynamic';
import { Suspense, useCallback, useEffect, useReducer, useState } from 'react';
import { canCompare, getProduct } from '../data/products';
import { hasWebGL } from '../lib/webgl';
import { initialState, QUALITIES, studioReducer, type CameraPreset, type Mode, type Quality } from '../state/studio';
import type { SceneInfo } from './scene/StudioCanvas';
import { ControlPanel } from './ui/ControlPanel';
import { CanvasLoading, PhotoFallback, SceneErrorBoundary } from './ui/Fallbacks';

// three.js hanya dimuat di halaman studio, di browser.
const StudioCanvas = dynamic(() => import('./scene/StudioCanvas'), { ssr: false, loading: () => <CanvasLoading /> });

const MODES: { id: Mode; label: string; short: string }[] = [
  { id: 'inspect', label: 'Lihat 3D', short: '3D' },
  { id: 'compare', label: 'Bandingkan Ukuran', short: 'Bandingkan' },
  { id: 'hold', label: 'Lihat Saat Dipegang', short: 'Dipegang' },
];

const QUALITY_KEY = 'ff-quality';

const PRESETS: { id: CameraPreset; label: string }[] = [
  { id: 'front', label: 'Depan' },
  { id: 'side', label: 'Samping' },
  { id: 'back', label: 'Belakang' },
  { id: 'top', label: 'Atas' },
];

export function Studio({ initialProductId }: { initialProductId: string }) {
  const first = getProduct(initialProductId)!;
  const [state, dispatch] = useReducer(studioReducer, undefined, () => initialState(first.id, first.variants[0]!.id));
  const product = getProduct(state.productId) ?? first;
  const variant = product.variants.find((v) => v.id === state.variantId) ?? product.variants[0]!;
  const comparable = canCompare(product);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [info, setInfo] = useState<SceneInfo | null>(null);
  const onInfo = useCallback((i: SceneInfo) => setInfo(i), []);

  useEffect(() => setWebgl(hasWebGL()), []);

  // kualitas awal: pilihan tersimpan, atau Bagus untuk layar lebar dengan CPU memadai, selain itu Ringan
  useEffect(() => {
    let q: Quality | null = null;
    try {
      const saved = window.localStorage.getItem(QUALITY_KEY);
      if (saved === 'high' || saved === 'standard') q = saved;
    } catch {
      /* storage diblokir: pakai deteksi */
    }
    if (!q) q = window.matchMedia('(min-width: 1024px)').matches && (navigator.hardwareConcurrency ?? 4) >= 4 ? 'high' : 'standard';
    const forced = new URLSearchParams(window.location.search).get('quality');
    if (forced === 'high' || forced === 'standard') q = forced;
    dispatch({ type: 'quality', quality: q });
  }, []);

  const setQuality = (q: Quality) => {
    dispatch({ type: 'quality', quality: q });
    try {
      window.localStorage.setItem(QUALITY_KEY, q);
    } catch {
      /* abaikan */
    }
  };

  const selectProduct = (id: string) => {
    const p = getProduct(id);
    if (!p || id === state.productId) return;
    dispatch({ type: 'product', productId: p.id, variantId: p.variants[0]!.id, canCompare: canCompare(p) });
    // ganti URL tanpa memuat ulang halaman / kanvas
    window.history.replaceState(null, '', `/studio/${p.id}${window.location.search}`);
    document.title = `${p.name} — Fuzzy Flo 3D`;
  };

  return (
    <main className="ff-studio">
      <section className="ff-viewer" aria-label="Penampil 3D">
        {webgl === false ? (
          <PhotoFallback product={product} variant={variant} reason="Browser ini tidak mendukung WebGL, jadi tampilan 3D tidak bisa dibuka. Berikut foto asli produk." />
        ) : webgl === null ? (
          <CanvasLoading />
        ) : (
          <SceneErrorBoundary
            resetKey={`${product.id}:${variant.id}`}
            fallback={<PhotoFallback product={product} variant={variant} reason="Model 3D gagal dimuat di perangkat ini. Berikut foto asli produk." />}
          >
            <Suspense fallback={<CanvasLoading />}>
              <StudioCanvas product={product} variant={variant} state={state} onInfo={onInfo} />
            </Suspense>
          </SceneErrorBoundary>
        )}

        {/* mode */}
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
          <div className="ff-seg pointer-events-auto max-w-full overflow-x-auto" role="group" aria-label="Mode tampilan">
            {MODES.map((m) => {
              const disabled = m.id !== 'inspect' && !comparable;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={state.mode === m.id}
                  disabled={disabled}
                  title={disabled ? 'Ukuran produk ini belum tersedia' : undefined}
                  onClick={() => dispatch({ type: 'mode', mode: m.id })}
                >
                  <span className="sm:hidden">{m.short}</span>
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* kamera */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-end justify-between gap-3 px-3">
          <div className="ff-seg pointer-events-auto hidden lg:inline-flex" role="group" aria-label="Kualitas tampilan">
            {QUALITIES.map((q) => (
              <button key={q.id} type="button" aria-pressed={state.quality === q.id} title={q.hint} onClick={() => setQuality(q.id)}>
                {q.label}
              </button>
            ))}
          </div>
          <div className="ff-seg pointer-events-auto ml-auto max-w-full overflow-x-auto" role="group" aria-label="Sudut kamera">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="!px-3" onClick={() => dispatch({ type: 'camera', preset: p.id })}>
                {p.label}
              </button>
            ))}
            <button type="button" className="!px-3" onClick={() => dispatch({ type: 'camera', preset: 'default' })} aria-label="Reset kamera">
              Reset
            </button>
          </div>
        </div>
        {!comparable && (
          <p className="absolute left-3 top-16 max-w-[15rem] rounded-xl bg-surface/95 px-3 py-2 text-xs text-ink-soft shadow-sm">
            Ukuran buket ini belum tersedia, jadi perbandingan dengan tubuh dinonaktifkan. Skala model ini tidak mewakili ukuran asli.
          </p>
        )}
      </section>

      <ControlPanel product={product} variant={variant} state={state} dispatch={dispatch} info={info} onSelectProduct={selectProduct} onQuality={setQuality} />
    </main>
  );
}
