import * as THREE from 'three';
import type { FlowerType } from '../data/schema';
import { ellipsoid, jitter, petalLoop, wireTube, type PartBag, type Rng } from './geom';

/**
 * Komponen bunga kawat bulu. Satuan meter. Ruang lokal kepala bunga: pangkal di origin, menghadap +y.
 * Tiap kelopak = loop kawat; kelopak "terisi" = beberapa loop konsentris (seperti lilitan aslinya).
 */
export const WIRE_R = 0.0034; // pipe cleaner ±7 mm termasuk bulu

export interface FlowerColors {
  petal: string;
  center: string;
}

/** Radius horizontal kira-kira kepala bunga (untuk penataan). */
export const HEAD_RADIUS: Record<FlowerType, number> = {
  tulip: 0.03,
  lily: 0.075,
  daisy: 0.025,
  sunflower: 0.05,
  gerbera: 0.042,
  rose: 0.035,
};

interface WhorlSpec {
  count: number;
  len: number;
  width: number;
  /** sudut kelopak dari sumbu bunga (rad): 0 = tegak, π/2 = mendatar */
  tilt: number;
  cup: number;
  sharp?: number;
  loops: number[]; // skala loop konsentris
  phase?: number;
  lift?: number;
}

function whorl(bag: PartBag, m: THREE.Matrix4, color: string, s: WhorlSpec, r: Rng, scale: number) {
  const key = { kind: 'fuzz' as const, color };
  for (let i = 0; i < s.count; i++) {
    const phi = (s.phase ?? 0) + (i / s.count) * Math.PI * 2 + jitter(r, 0.08);
    const tilt = s.tilt + jitter(r, 0.08);
    const k = scale * (1 + jitter(r, 0.07));
    const pm = new THREE.Matrix4()
      .makeRotationY(phi)
      .multiply(new THREE.Matrix4().makeTranslation(0, (s.lift ?? 0) * scale, 0))
      .multiply(new THREE.Matrix4().makeRotationX(tilt));
    for (const f of s.loops) {
      const pts = petalLoop(s.len * k * f, s.width * k * f, { cup: s.cup, sharp: s.sharp, wobble: 0.02, r });
      bag.add(key, wireTube(pts, WIRE_R, true), m.clone().multiply(pm));
    }
  }
}

export function addFlower(bag: PartBag, type: FlowerType, m: THREE.Matrix4, c: FlowerColors, r: Rng, scale = 1) {
  const fuzz = (color: string) => ({ kind: 'fuzz' as const, color });
  switch (type) {
    case 'tulip':
      // dua lingkar 3 kelopak membentuk cangkir; ujung melengkung ke dalam (cup < 0)
      whorl(bag, m, c.petal, { count: 3, len: 0.056, width: 0.036, tilt: 0.34, cup: -0.32, loops: [1, 0.7, 0.42] }, r, scale);
      whorl(bag, m, c.petal, { count: 3, len: 0.052, width: 0.034, tilt: 0.2, cup: -0.3, loops: [1, 0.62], phase: Math.PI / 3 }, r, scale);
      bag.add(fuzz(c.petal), ellipsoid(new THREE.Vector3(0, 0.012 * scale, 0), 0.012 * scale, 0.012 * scale, 0.012 * scale), m);
      break;
    case 'lily': {
      whorl(bag, m, c.petal, { count: 6, len: 0.085, width: 0.034, tilt: 1.0, cup: 0.28, sharp: 1, loops: [1, 0.78, 0.56, 0.34] }, r, scale);
      const stamen = fuzz(c.center);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const tip = new THREE.Vector3(Math.cos(a) * 0.014, 0.045, Math.sin(a) * 0.014).multiplyScalar(scale);
        bag.add(stamen, wireTube([new THREE.Vector3(0, 0, 0), tip.clone().multiplyScalar(0.5).setY(tip.y * 0.55), tip], 0.0014, false, 4), m);
        bag.add(stamen, ellipsoid(tip, 0.0035 * scale, 0.005 * scale, 0.0035 * scale), m);
      }
      break;
    }
    case 'daisy':
      whorl(bag, m, c.petal, { count: 9, len: 0.023, width: 0.0095, tilt: 1.42, cup: 0.05, loops: [1] }, r, scale);
      bag.add(fuzz(c.center), ellipsoid(new THREE.Vector3(0, 0.002 * scale, 0), 0.0085 * scale, 0.006 * scale, 0.0085 * scale), m);
      break;
    case 'sunflower':
      whorl(bag, m, c.petal, { count: 14, len: 0.042, width: 0.014, tilt: 1.4, cup: 0.08, loops: [1, 0.55] }, r, scale);
      bag.add(fuzz(c.center), ellipsoid(new THREE.Vector3(0, 0.004 * scale, 0), 0.025 * scale, 0.009 * scale, 0.025 * scale), m);
      break;
    case 'gerbera':
      whorl(bag, m, c.petal, { count: 16, len: 0.036, width: 0.0075, tilt: 1.38, cup: 0.04, loops: [1] }, r, scale);
      whorl(bag, m, c.petal, { count: 11, len: 0.02, width: 0.006, tilt: 0.95, cup: 0, loops: [1], phase: 0.2, lift: 0.003 }, r, scale);
      bag.add(fuzz(c.center), ellipsoid(new THREE.Vector3(0, 0.004 * scale, 0), 0.008 * scale, 0.005 * scale, 0.008 * scale), m);
      break;
    case 'rose': {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const a = t * Math.PI * 7;
        const rad = (0.003 + 0.022 * t) * scale;
        pts.push(new THREE.Vector3(Math.cos(a) * rad, (0.034 - 0.018 * t * t) * scale, Math.sin(a) * rad));
      }
      bag.add(fuzz(c.petal), wireTube(pts, WIRE_R, false, 3), m);
      whorl(bag, m, c.petal, { count: 5, len: 0.034, width: 0.03, tilt: 0.55, cup: -0.25, loops: [1, 0.6] }, r, scale);
      break;
    }
  }
}

/** Daun: loop runcing hijau dengan rusuk tengah. `m` = pangkal daun, daun mengarah +y lokal. */
export function addLeaf(bag: PartBag, m: THREE.Matrix4, color: string, r: Rng, scale = 1) {
  const key = { kind: 'fuzz' as const, color };
  const len = 0.075 * scale * (1 + jitter(r, 0.1));
  bag.add(key, wireTube(petalLoop(len, 0.026 * scale, { cup: 0.15, sharp: 1, wobble: 0.02, r }), WIRE_R, true), m);
  bag.add(key, wireTube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, len * 0.5, 0.004), new THREE.Vector3(0, len * 0.9, 0.012)], WIRE_R * 0.8, false, 4), m);
}

/** Sprig: tangkai bercabang dengan butiran bulat hijau (daun "manik"). */
export function addSprig(bag: PartBag, m: THREE.Matrix4, color: string, r: Rng, scale = 1) {
  const key = { kind: 'fuzz' as const, color };
  const len = 0.13 * scale;
  bag.add(key, wireTube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.006, len * 0.5, 0.004), new THREE.Vector3(0, len, 0)], WIRE_R * 0.8, false, 4), m);
  for (let i = 0; i < 9; i++) {
    const t = 0.25 + (i / 9) * 0.75;
    const side = i % 2 === 0 ? 1 : -1;
    const p = new THREE.Vector3(side * 0.008 * scale, len * t, jitter(r, 0.004));
    const rad = 0.0055 * scale * (1 - t * 0.35);
    bag.add(key, ellipsoid(p, rad, rad * 1.25, rad, new THREE.Vector3(side * 0.4, 1, 0), 8, 6), m);
  }
}

/** Tangkai dari kepala bunga ke titik ikat lalu lurus turun ke dasar pegangan. */
export function addStem(bag: PartBag, head: THREE.Vector3, grip: THREE.Vector3, bottomY: number, color: string) {
  const mid = new THREE.Vector3().lerpVectors(head, grip, 0.55);
  mid.x *= 0.8;
  mid.z *= 0.8;
  const pts = [head.clone(), mid, grip.clone(), new THREE.Vector3(grip.x * 0.6, (grip.y + bottomY) / 2, grip.z * 0.6), new THREE.Vector3(grip.x * 0.5, bottomY, grip.z * 0.5)];
  bag.add({ kind: 'fuzz', color }, wireTube(pts, WIRE_R, false, 4));
}
