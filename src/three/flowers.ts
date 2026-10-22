import * as THREE from 'three';
import type { FlowerType } from '../data/schema';
import { ellipsoid, jitter, petalLoop, shade, surface, wireTube, type PartBag, type Rng } from './geom';

/**
 * Komponen bunga kawat bulu. Satuan meter. Ruang lokal kepala bunga: pangkal di origin, menghadap +y.
 * Kelopak pipe cleaner = kawat dililit rapat sehingga tampak "terisi" dan bergaris: dimodelkan sebagai
 * permukaan melengkung bertekstur rusuk lilitan + bingkai tabung kawat di tepinya.
 */
export const WIRE_R = 0.0034; // pipe cleaner ±7 mm termasuk bulu

export interface Detail {
  /** segmen radial tabung kawat */
  radial: number;
  /** subdivisi permukaan kelopak [lintang, panjang] */
  petal: [number, number];
}
export const DETAIL_STANDARD: Detail = { radial: 5, petal: [6, 8] };
export const DETAIL_HIGH: Detail = { radial: 8, petal: [10, 14] };

export interface FlowerColors {
  petal: string;
  center: string;
}

/** Seberapa jauh kepala bunga menonjol sepanjang arah hadapnya (m); bunga pendek dimajukan saat penataan. */
export const HEAD_DEPTH: Record<FlowerType, number> = {
  tulip: 0.068,
  lily: 0.045,
  daisy: 0.012,
  sunflower: 0.016,
  gerbera: 0.012,
  rose: 0.036,
};

/** Radius horizontal kira-kira kepala bunga (untuk penataan). */
export const HEAD_RADIUS: Record<FlowerType, number> = {
  tulip: 0.031,
  lily: 0.092,
  daisy: 0.03,
  sunflower: 0.058,
  gerbera: 0.045,
  rose: 0.034,
};

export interface PetalShape {
  len: number;
  width: number;
  /** lengkung melintang (cekung ke +z): 0 datar, 1 sangat cekung */
  cup: number;
  /** lengkung memanjang: positif = ujung melengkung ke dalam (ke sumbu bunga), negatif = ke luar */
  curve: number;
  /** 0 ujung bulat, 1 runcing */
  sharp: number;
  /** posisi lebar maksimum sepanjang kelopak (0..1) */
  widest?: number;
}

function halfWidth(s: PetalShape, v: number) {
  const w = s.widest ?? 0.55;
  const rise = Math.sin(Math.min(1, v / w) * Math.PI * 0.5) ** 0.75;
  const fall = v <= w ? 1 : Math.cos(((v - w) / (1 - w)) * Math.PI * 0.5) ** (0.55 + s.sharp * 0.9);
  return (s.width / 2) * Math.max(0.12, rise) * fall;
}

function petalPoint(s: PetalShape, u: number, v: number, out: THREE.Vector3) {
  const hw = halfWidth(s, v);
  const x = u * hw;
  // cekung melintang: tepi maju ke +z; lengkung memanjang: ujung maju sebanding v²
  const z = s.cup * (u * u - 0.35) * hw * 0.9 + s.curve * s.len * v * v;
  return out.set(x, s.len * v, z);
}

/** Permukaan kelopak terisi + bingkai kawat. Pangkal di origin, mengarah +y, sisi dalam menghadap +z. */
export function addPetal(bag: PartBag, m: THREE.Matrix4, color: string, s: PetalShape, d: Detail, opts: { rim?: boolean; base?: number; rimColor?: string } = {}) {
  const [nu, nv] = d.petal;
  const g = surface((u, v, out) => petalPoint(s, u * 2 - 1, v, out), nu, nv);
  const base = opts.base ?? 0.78;
  // pangkal sedikit lebih gelap, tepi sedikit lebih terang → kedalaman seperti foto
  shade(g, (u, v) => base + (1 - base) * Math.min(1, v * 1.6) + 0.05 * Math.abs(u * 2 - 1));
  bag.add({ kind: 'petal', color }, g, m);
  if (opts.rim !== false) {
    const pts: THREE.Vector3[] = [];
    const n = 16;
    for (let i = 0; i <= n; i++) pts.push(petalPoint(s, -1, i / n, new THREE.Vector3()));
    for (let i = n - 1; i >= 1; i--) pts.push(petalPoint(s, 1, i / n, new THREE.Vector3()));
    bag.add({ kind: 'fuzz', color: opts.rimColor ?? color }, wireTube(pts, WIRE_R * 0.8, true, 2, d.radial), m);
  }
}

interface WhorlSpec {
  count: number;
  shape: PetalShape;
  /** sudut kelopak dari sumbu bunga (rad): 0 = tegak, π/2 = mendatar */
  tilt: number;
  phase?: number;
  lift?: number;
  radius?: number;
  rim?: boolean;
  base?: number;
}

function whorl(bag: PartBag, m: THREE.Matrix4, color: string, w: WhorlSpec, r: Rng, scale: number, d: Detail) {
  for (let i = 0; i < w.count; i++) {
    const phi = (w.phase ?? 0) + (i / w.count) * Math.PI * 2 + jitter(r, 0.07);
    const k = scale * (1 + jitter(r, 0.06));
    const s: PetalShape = { ...w.shape, len: w.shape.len * k, width: w.shape.width * k };
    // kelopak menghadap ke luar: sisi dalam (+z lokal) diarahkan ke sumbu bunga
    const pm = new THREE.Matrix4()
      .makeRotationY(phi)
      .multiply(new THREE.Matrix4().makeTranslation(0, (w.lift ?? 0) * scale, (w.radius ?? 0) * scale))
      .multiply(new THREE.Matrix4().makeRotationX(w.tilt + jitter(r, 0.06)))
      .multiply(new THREE.Matrix4().makeRotationY(Math.PI));
    addPetal(bag, m.clone().multiply(pm), color, s, d, { rim: w.rim, base: w.base });
  }
}

export function addFlower(bag: PartBag, type: FlowerType, m: THREE.Matrix4, c: FlowerColors, r: Rng, scale: number, d: Detail) {
  const fuzz = (color: string) => ({ kind: 'fuzz' as const, color });
  switch (type) {
    case 'tulip': {
      // cangkir telur: 3 kelopak luar + 3 dalam, sangat cekung, ujung masuk ke dalam
      const outer: PetalShape = { len: 0.07, width: 0.057, cup: 1.05, curve: 0.22, sharp: 0.25, widest: 0.5 };
      whorl(bag, m, c.petal, { count: 3, shape: outer, tilt: 0.3, radius: 0.004 }, r, scale, d);
      whorl(bag, m, c.petal, { count: 3, shape: { ...outer, len: 0.066, width: 0.053 }, tilt: 0.18, phase: Math.PI / 3, radius: 0.002, base: 0.72 }, r, scale, d);
      bag.add(fuzz(c.petal), ellipsoid(new THREE.Vector3(0, 0.014 * scale, 0), 0.014 * scale, 0.016 * scale, 0.014 * scale, undefined, 10, 8), m);
      break;
    }
    case 'lily': {
      const p: PetalShape = { len: 0.095, width: 0.07, cup: 1.05, curve: -0.16, sharp: 0.2, widest: 0.56 };
      whorl(bag, m, c.petal, { count: 3, shape: p, tilt: 0.88, radius: 0.004 }, r, scale, d);
      whorl(bag, m, c.petal, { count: 3, shape: { ...p, width: 0.056, len: 0.092 }, tilt: 0.78, phase: Math.PI / 3, radius: 0.003, lift: 0.002 }, r, scale, d);
      const stamen = fuzz(c.center);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const tip = new THREE.Vector3(Math.cos(a) * 0.016, 0.05, Math.sin(a) * 0.016).multiplyScalar(scale);
        bag.add(stamen, wireTube([new THREE.Vector3(0, 0, 0), tip.clone().multiplyScalar(0.5).setY(tip.y * 0.6), tip], 0.0015, false, 4, d.radial), m);
        bag.add(stamen, ellipsoid(tip, 0.004 * scale, 0.006 * scale, 0.004 * scale, undefined, 8, 6), m);
      }
      bag.add(fuzz(c.petal), ellipsoid(new THREE.Vector3(0, 0.006 * scale, 0), 0.011 * scale, 0.01 * scale, 0.011 * scale, undefined, 10, 8), m);
      break;
    }
    case 'daisy':
      whorl(bag, m, c.petal, { count: 11, shape: { len: 0.03, width: 0.0125, cup: 0.35, curve: -0.08, sharp: 0.1 }, tilt: 1.38, radius: 0.006, rim: false, base: 0.86 }, r, scale, d);
      bag.add(fuzz(c.center), ellipsoid(new THREE.Vector3(0, 0.003 * scale, 0), 0.0095 * scale, 0.007 * scale, 0.0095 * scale, undefined, 12, 8), m);
      break;
    case 'sunflower':
      whorl(bag, m, c.petal, { count: 13, shape: { len: 0.042, width: 0.017, cup: 0.4, curve: -0.12, sharp: 0.55 }, tilt: 1.32, radius: 0.022 }, r, scale, d);
      whorl(bag, m, c.petal, { count: 13, shape: { len: 0.036, width: 0.015, cup: 0.4, curve: -0.05, sharp: 0.55 }, tilt: 1.12, radius: 0.02, phase: Math.PI / 13, base: 0.7 }, r, scale, d);
      bag.add({ kind: 'petal', color: c.center }, shade(ellipsoid(new THREE.Vector3(0, 0.005 * scale, 0), 0.026 * scale, 0.011 * scale, 0.026 * scale, undefined, 18, 10), () => 0.9), m);
      break;
    case 'gerbera':
      whorl(bag, m, c.petal, { count: 18, shape: { len: 0.038, width: 0.009, cup: 0.3, curve: -0.06, sharp: 0.2 }, tilt: 1.38, radius: 0.008, rim: false }, r, scale, d);
      whorl(bag, m, c.petal, { count: 12, shape: { len: 0.022, width: 0.007, cup: 0.3, curve: 0, sharp: 0.2 }, tilt: 0.95, radius: 0.006, phase: 0.2, lift: 0.003, rim: false, base: 0.7 }, r, scale, d);
      bag.add(fuzz(c.center), ellipsoid(new THREE.Vector3(0, 0.004 * scale, 0), 0.009 * scale, 0.006 * scale, 0.009 * scale, undefined, 10, 8), m);
      break;
    case 'rose': {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 44; i++) {
        const t = i / 44;
        const a = t * Math.PI * 7;
        const rad = (0.003 + 0.02 * t) * scale;
        pts.push(new THREE.Vector3(Math.cos(a) * rad, (0.036 - 0.016 * t * t) * scale, Math.sin(a) * rad));
      }
      bag.add(fuzz(c.petal), wireTube(pts, WIRE_R, false, 3, d.radial), m);
      whorl(bag, m, c.petal, { count: 5, shape: { len: 0.036, width: 0.034, cup: 0.9, curve: 0.12, sharp: 0.1 }, tilt: 0.55, radius: 0.004 }, r, scale, d);
      break;
    }
  }
}

/** Daun kawat: loop runcing hijau dengan rusuk tengah. `m` = pangkal daun, daun mengarah +y lokal. */
export function addLeaf(bag: PartBag, m: THREE.Matrix4, color: string, r: Rng, d: Detail, scale = 1) {
  const len = 0.08 * scale * (1 + jitter(r, 0.1));
  const key = { kind: 'fuzz' as const, color };
  bag.add(key, wireTube(petalLoop(len, 0.028 * scale, { cup: 0.18, sharp: 1, wobble: 0.02, r }), WIRE_R, true, 2, d.radial), m);
  bag.add(key, wireTube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, len * 0.5, 0.004), new THREE.Vector3(0, len * 0.88, 0.012)], WIRE_R * 0.8, false, 4, d.radial), m);
}

/** Sprig: tangkai bercabang dengan butiran bulat hijau (daun "manik"). */
export function addSprig(bag: PartBag, m: THREE.Matrix4, color: string, r: Rng, d: Detail, scale = 1) {
  const key = { kind: 'fuzz' as const, color };
  const len = 0.13 * scale;
  bag.add(key, wireTube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.006, len * 0.5, 0.004), new THREE.Vector3(0, len, 0)], WIRE_R * 0.8, false, 4, d.radial), m);
  for (let i = 0; i < 10; i++) {
    const t = 0.25 + (i / 10) * 0.75;
    const side = i % 2 === 0 ? 1 : -1;
    const p = new THREE.Vector3(side * 0.008 * scale, len * t, jitter(r, 0.004));
    const rad = 0.006 * scale * (1 - t * 0.35);
    bag.add(key, ellipsoid(p, rad, rad * 1.3, rad, new THREE.Vector3(side * 0.4, 1, 0), 8, 6), m);
  }
}

/** Tangkai dari kepala bunga (mundur sepanjang -dir) ke titik ikat lalu lurus turun ke dasar pegangan. */
export function addStem(bag: PartBag, head: THREE.Vector3, dir: THREE.Vector3, grip: THREE.Vector3, bottomY: number, color: string, d: Detail) {
  const back = head.clone().addScaledVector(dir, -0.03);
  const mid = new THREE.Vector3().lerpVectors(back, grip, 0.5);
  mid.x *= 0.7;
  mid.z *= 0.7;
  const pts = [head.clone().addScaledVector(dir, 0.006), back, mid, grip.clone(), new THREE.Vector3(grip.x * 0.6, (grip.y + bottomY) / 2, grip.z * 0.6), new THREE.Vector3(grip.x * 0.5, bottomY, grip.z * 0.5)];
  bag.add({ kind: 'fuzz', color }, wireTube(pts, WIRE_R, false, 4, d.radial));
}
