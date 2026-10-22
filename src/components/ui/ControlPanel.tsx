'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { canCompare, PRODUCTS } from '../../data/products';
import type { Product, Variant } from '../../data/schema';
import { bmi, bmiCategory, HEIGHT_RANGE_CM, WEIGHT_RANGE_KG } from '../../lib/anthropometry';
import { QUALITIES, type Quality, type StudioAction, type StudioState } from '../../state/studio';
import type { SceneInfo } from '../scene/StudioCanvas';

type Tab = 'produk' | 'ukuran' | 'avatar' | 'tampilan';
type Snap = 'peek' | 'half' | 'full';
const TABS: { id: Tab; label: string }[] = [
  { id: 'produk', label: 'Produk' },
  { id: 'ukuran', label: 'Ukuran' },
  { id: 'avatar', label: 'Avatar' },
  { id: 'tampilan', label: 'Tampilan' },
];

interface Props {
  product: Product;
  variant: Variant;
  state: StudioState;
  dispatch: Dispatch<StudioAction>;
  info: SceneInfo | null;
  onSelectProduct: (id: string) => void;
  onQuality: (q: Quality) => void;
}

export function ControlPanel({ product, variant, state, dispatch, info, onSelectProduct, onQuality }: Props) {
  const [tab, setTab] = useState<Tab>('produk');
  const [snap, setSnap] = useState<Snap>('peek');
  const [photo, setPhoto] = useState<string | null>(null);
  const drag = useSheetDrag(snap, setSnap);
  const d = product.dimensions;
  const comparable = canCompare(product);

  const openTab = (t: Tab) => {
    setTab(t);
    if (snap === 'peek') setSnap('half');
  };

  return (
    <aside className="ff-panel" data-snap={snap} data-dragging={drag.dragging} aria-label="Pengaturan">
      {/* kepala sheet (mobile) */}
      <div className="ff-sheet-only shrink-0 px-4 pt-2" {...drag.handlers}>
        <button
          type="button"
          className="mx-auto mb-2 block h-6 w-full"
          aria-label={snap === 'peek' ? 'Buka panel' : 'Perkecil panel'}
          onClick={() => setSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek')}
        >
          <span className="mx-auto block h-1.5 w-11 rounded-full bg-line" />
        </button>
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-display text-lg">{product.name}</p>
          <p className="shrink-0 text-sm tabular-nums text-ink-soft">{d ? `± ${d.heightCm} × ${d.widthCm} cm` : 'Ukuran: tanya admin'}</p>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-2" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`min-h-[40px] shrink-0 rounded-full px-4 text-sm ${tab === t.id ? 'bg-ink text-paper' : 'bg-cream text-ink-soft'}`}
              onClick={() => openTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ff-sheet-body">
        <Section id="produk" tab={tab} title={product.name} heading>
          <p className="text-sm text-ink-soft">{product.sizeLabel}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="ff-chip" data-tone="rose">Model 3D representatif</span>
            <span className="ff-chip" data-tone={d ? undefined : 'warn'}>{d ? 'Ukuran dari penjual (±)' : 'Ukuran belum tersedia'}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed">{product.composition}.</p>
          <p className="text-sm leading-relaxed text-ink-soft">{product.wrapping}.</p>

          {product.variants.length > 1 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">Warna</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={v.id === variant.id}
                    className="ff-btn !min-h-[40px] !px-3 text-sm"
                    onClick={() => dispatch({ type: 'variant', variantId: v.id })}
                  >
                    <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: v.palette['tulip'] ?? v.palette['lily'] ?? v.palette['wrapper'] }} />
                    {v.label}
                  </button>
                ))}
              </div>
              {!variant.sizeConfirmed && d && (
                <p className="mt-2 text-xs text-[#7a5a24]">Foto warna ini tanpa keterangan ukuran; ukuran mengikuti varian utama dan belum dikonfirmasi.</p>
              )}
            </div>
          )}

          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">Foto asli</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {variant.photos.map((src) => (
                <button key={src} type="button" className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-cream" onClick={() => setPhoto(src)} aria-label="Perbesar foto">
                  <Image src={src.replace('.jpg', '-thumb.jpg')} alt="" fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">Buket lain</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {PRODUCTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectProduct(p.id)}
                  aria-current={p.id === product.id}
                  className={`w-20 shrink-0 text-left ${p.id === product.id ? 'opacity-100' : 'opacity-75 hover:opacity-100'}`}
                >
                  <span className={`relative block h-24 w-20 overflow-hidden rounded-xl bg-cream ${p.id === product.id ? 'ring-2 ring-rose' : ''}`}>
                    <Image src={p.variants[0]!.photos[0]!.replace('.jpg', '-thumb.jpg')} alt="" fill sizes="80px" className="object-cover" />
                  </span>
                  <span className="mt-1 block truncate text-xs">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section id="ukuran" tab={tab} title="Ukuran">
          {d ? (
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-ink-soft">Tinggi (penjual)</dt>
              <dd className="tabular-nums">± {d.heightCm} cm</dd>
              <dt className="text-ink-soft">Lebar (penjual)</dt>
              <dd className="tabular-nums">± {d.widthCm} cm</dd>
              <dt className="text-ink-soft">Kedalaman</dt>
              <dd className="tabular-nums">≈ {d.estimatedDepthCm} cm <span className="text-xs text-ink-soft">(estimasi)</span></dd>
              <dt className="col-span-2 mt-3 text-xs font-medium uppercase tracking-wide text-ink-soft">Model 3D terukur</dt>
              <dt className="text-ink-soft">T × L × K</dt>
              <dd className="tabular-nums">
                {info ? `${info.bouquetCm.heightCm.toFixed(1)} × ${info.bouquetCm.widthCm.toFixed(1)} × ${info.bouquetCm.depthCm.toFixed(1)} cm` : '…'}
              </dd>
            </dl>
          ) : (
            <p className="text-sm">Ukuran buket ini belum tercantum di katalog. Silakan tanyakan admin sebelum memesan.</p>
          )}
          <p className="mt-3 rounded-xl bg-cream px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
            Model 3D adalah representasi berdasarkan foto dan ukuran dari penjual (±). Detail bentuk, bagian belakang, dan kedalaman adalah
            perkiraan. {d && <>{d.interpretation}.</>} Zoom kamera tidak mengubah ukuran objek.
          </p>
        </Section>

        <Section id="avatar" tab={tab} title="Avatar pembanding">
          {!comparable ? (
            <p className="text-sm text-ink-soft">Tidak tersedia untuk produk tanpa ukuran.</p>
          ) : (
            <>
              {state.mode === 'inspect' && (
                <button type="button" className="ff-btn mb-4 w-full" onClick={() => dispatch({ type: 'mode', mode: 'compare' })}>
                  Bandingkan dengan tinggi badan
                </button>
              )}
              <div className="ff-seg mb-4 w-full" role="group" aria-label="Jenis kelamin avatar">
                {(['female', 'male'] as const).map((s) => (
                  <button key={s} type="button" className="flex-1" aria-pressed={state.sex === s} onClick={() => dispatch({ type: 'sex', sex: s })}>
                    {s === 'female' ? 'Perempuan' : 'Laki-laki'}
                  </button>
                ))}
              </div>
              <NumberSlider
                label="Tinggi badan"
                unit="cm"
                value={state.heightCm}
                min={HEIGHT_RANGE_CM.min}
                max={HEIGHT_RANGE_CM.max}
                onChange={(cm) => dispatch({ type: 'height', cm })}
              />
              <NumberSlider
                label="Berat badan"
                unit="kg"
                value={state.weightKg}
                min={WEIGHT_RANGE_KG.min}
                max={WEIGHT_RANGE_KG.max}
                onChange={(kg) => dispatch({ type: 'weight', kg })}
              />
              <p className="mt-1 text-xs text-ink-soft">
                BMI {bmi(state.heightCm, state.weightKg).toFixed(1)} ({bmiCategory(bmi(state.heightCm, state.weightKg))}). Berat hanya mengubah
                lebar tubuh avatar sebagai perkiraan; bentuk tubuh asli bisa berbeda.
              </p>
              {info?.avatarCm && (
                <p className="mt-2 text-xs tabular-nums text-ink-soft">
                  Tinggi avatar terukur: {info.avatarCm.heightCm.toFixed(1)} cm
                  {info.hold && info.hold.pushedForwardCm > 0.5 && ` · buket digeser ${info.hold.pushedForwardCm.toFixed(0)} cm ke depan agar tidak menembus badan`}
                </p>
              )}
            </>
          )}
        </Section>

        <Section id="tampilan" tab={tab} title="Tampilan">
          <p className="mb-2 text-sm">Kualitas render</p>
          <div className="ff-seg mb-1 w-full" role="group" aria-label="Kualitas render">
            {QUALITIES.map((q) => (
              <button key={q.id} type="button" className="flex-1" aria-pressed={state.quality === q.id} onClick={() => onQuality(q.id)}>
                {q.label}
              </button>
            ))}
          </div>
          <p className="mb-3 text-xs text-ink-soft">{QUALITIES.find((q) => q.id === state.quality)?.hint}. Ukuran tidak berubah antar mode.</p>
          <div className="flex flex-col gap-2">
            <Toggle label="Garis ukur" checked={state.showGuides} onChange={() => dispatch({ type: 'toggle', key: 'showGuides' })} />
            <Toggle
              label="Tanpa distorsi perspektif (ortografis)"
              hint="Hanya di mode Bandingkan. Tampilan datar agar tinggi dapat dibandingkan apa adanya."
              checked={state.ortho}
              disabled={state.mode !== 'compare'}
              onChange={() => dispatch({ type: 'toggle', key: 'ortho' })}
            />
            <Toggle label="Putar otomatis" checked={state.autoRotate} onChange={() => dispatch({ type: 'toggle', key: 'autoRotate' })} />
          </div>
          {info && <p className="mt-3 text-xs text-ink-soft tabular-nums">Detail model: {Math.round(info.triangles / 1000)}k segitiga.</p>}
        </Section>
      </div>

      {photo && <Lightbox src={photo} alt={product.name} onClose={() => setPhoto(null)} />}
    </aside>
  );
}

function Section({ id, tab, title, heading, children }: { id: Tab; tab: Tab; title: string; heading?: boolean; children: ReactNode }) {
  return (
    <section className="ff-sec px-4 py-4 lg:px-5 lg:py-5" data-active={tab === id} aria-label={title}>
      {heading ? (
        <h1 className="mb-1 hidden font-display text-2xl leading-tight lg:block">{title}</h1>
      ) : (
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-soft">{title}</h2>
      )}
      {children}
    </section>
  );
}

function NumberSlider({ label, unit, value, min, max, onChange }: { label: string; unit: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const id = `ff-${label.replace(/\s/g, '-')}`;
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm">{label}</label>
        <span className="flex items-center gap-1.5 text-sm">
          <input
            className="ff-num"
            inputMode="numeric"
            aria-label={`${label} (${unit})`}
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => onChange(Number(text) || value)}
            onKeyDown={(e) => e.key === 'Enter' && onChange(Number(text) || value)}
          />
          <span className="w-6 text-ink-soft">{unit}</span>
        </span>
      </div>
      <input id={id} type="range" className="ff-range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <div className="flex justify-between text-[11px] text-ink-soft tabular-nums">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <label className={`flex min-h-[44px] items-start justify-between gap-4 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span className="pt-2.5 text-sm">
        {label}
        {hint && <span className="mt-0.5 block text-xs text-ink-soft">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="mt-2.5 h-5 w-5 shrink-0 accent-rose" checked={checked && !disabled} disabled={disabled} onChange={onChange} />
    </label>
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4" role="dialog" aria-modal="true" aria-label={`Foto ${alt}`} onClick={onClose}>
      <div className="relative h-[min(85svh,900px)] w-[min(92vw,640px)]" onClick={(e) => e.stopPropagation()}>
        <Image src={src} alt={`Foto ${alt}`} fill sizes="640px" className="rounded-2xl object-contain" />
      </div>
      <button type="button" className="ff-btn absolute right-4 top-4" onClick={onClose}>
        Tutup
      </button>
    </div>
  );
}

/** Seret kepala sheet ke atas/bawah untuk berpindah snap (peek → half → full). */
function useSheetDrag(snap: Snap, setSnap: (s: Snap) => void) {
  const start = useRef<{ y: number; t: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const order: Snap[] = ['peek', 'half', 'full'];
  return {
    dragging,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('[role="tab"]')) return;
        start.current = { y: e.clientY, t: Date.now() };
        setDragging(true);
      },
      onPointerUp: (e: React.PointerEvent) => {
        const s = start.current;
        start.current = null;
        setDragging(false);
        if (!s) return;
        const dy = e.clientY - s.y;
        if (Math.abs(dy) < 30) return;
        const i = order.indexOf(snap) + (dy < 0 ? 1 : -1);
        setSnap(order[Math.max(0, Math.min(order.length - 1, i))]!);
      },
      onPointerCancel: () => {
        start.current = null;
        setDragging(false);
      },
    },
  };
}
