import { clamp, HEIGHT_RANGE_CM, WEIGHT_RANGE_KG, type Sex } from '../lib/anthropometry';

export type Mode = 'inspect' | 'compare' | 'hold';
export type CameraPreset = 'default' | 'front' | 'side' | 'back' | 'top';
/** standard = Ringan (HP biasa), high = Bagus (bayangan, AO, bulu, detail tinggi) */
export type Quality = 'standard' | 'high';
export const QUALITIES: { id: Quality; label: string; hint: string }[] = [
  { id: 'standard', label: 'Ringan', hint: 'Cepat, cocok untuk HP' },
  { id: 'high', label: 'Bagus', hint: 'Bayangan, kedalaman & bulu lebih nyata' },
];

export interface StudioState {
  productId: string;
  variantId: string;
  mode: Mode;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  showGuides: boolean;
  ortho: boolean;
  autoRotate: boolean;
  quality: Quality;
  /** Preset kamera + nonce agar klik ulang preset yang sama tetap memicu animasi. */
  camera: { preset: CameraPreset; nonce: number };
}

export type StudioAction =
  | { type: 'product'; productId: string; variantId: string; canCompare: boolean }
  | { type: 'variant'; variantId: string }
  | { type: 'mode'; mode: Mode }
  | { type: 'sex'; sex: Sex }
  | { type: 'height'; cm: number }
  | { type: 'weight'; kg: number }
  | { type: 'toggle'; key: 'showGuides' | 'ortho' | 'autoRotate' }
  | { type: 'camera'; preset: CameraPreset }
  | { type: 'quality'; quality: Quality };

export function initialState(productId: string, variantId: string): StudioState {
  return {
    productId,
    variantId,
    mode: 'inspect',
    sex: 'female',
    heightCm: HEIGHT_RANGE_CM.default,
    weightKg: WEIGHT_RANGE_KG.default,
    showGuides: true,
    ortho: false,
    autoRotate: false,
    quality: 'standard',
    camera: { preset: 'default', nonce: 0 },
  };
}

const reframe = (s: StudioState, preset: StudioState['camera']['preset'] = 'default') => ({ preset, nonce: s.camera.nonce + 1 });

export function studioReducer(s: StudioState, a: StudioAction): StudioState {
  switch (a.type) {
    case 'product':
      return {
        ...s,
        productId: a.productId,
        variantId: a.variantId,
        // produk tanpa ukuran tidak boleh tampil dalam mode perbandingan
        mode: a.canCompare ? s.mode : 'inspect',
        ortho: a.canCompare ? s.ortho : false,
        camera: reframe(s),
      };
    case 'variant':
      return { ...s, variantId: a.variantId };
    case 'mode':
      return { ...s, mode: a.mode, ortho: a.mode === 'compare' ? s.ortho : false, camera: reframe(s, a.mode === 'compare' ? 'front' : 'default') };
    case 'sex':
      return { ...s, sex: a.sex };
    case 'height':
      return { ...s, heightCm: Math.round(clamp(a.cm, HEIGHT_RANGE_CM.min, HEIGHT_RANGE_CM.max)) };
    case 'weight':
      return { ...s, weightKg: Math.round(clamp(a.kg, WEIGHT_RANGE_KG.min, WEIGHT_RANGE_KG.max)) };
    case 'toggle':
      return { ...s, [a.key]: !s[a.key], camera: a.key === 'ortho' ? reframe(s, 'front') : s.camera };
    case 'camera':
      return { ...s, camera: reframe(s, a.preset) };
    case 'quality':
      return { ...s, quality: a.quality };
  }
}
