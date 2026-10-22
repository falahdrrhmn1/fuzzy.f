import * as THREE from 'three';
import { BREADTH, girthScale, LANDMARK, SEGMENT, type Sex } from '../lib/anthropometry';
import { cmToM, mToCm } from '../lib/units';
import { ellipsoid, ellipticLoft, PartBag, taper, type Ring } from './geom';

/**
 * Avatar procedural (tanpa aset pihak ketiga → bebas lisensi). Proporsi dari tabel antropometri,
 * berdiri di y=0, menghadap +z. Tinggi Box3 = tinggi badan (rambut termasuk, seperti stadiometer).
 */
export interface AvatarParams {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  pose: 'standing' | 'holding';
  /** Titik genggam (dunia, meter) untuk pose holding; default = defaultGrip(). */
  grip?: THREE.Vector3;
}

export interface BuiltAvatar {
  object: THREE.Group;
  measuredCm: { heightCm: number; widthCm: number; depthCm: number };
  /** Titik pusat genggaman kedua tangan (dunia, meter). Hanya pose holding. */
  handGrip: THREE.Vector3 | null;
  /** true bila kedua pergelangan mencapai target IK (tidak terentang melebihi panjang lengan). */
  reached: boolean;
  shoulderHalfWidth: number;
}

const SKIN = { kind: 'skin' as const, color: '#D8C3B4' };
const HAIR = { kind: 'hair' as const, color: '#4E3B32' };

/** Profil torso: setengah lebar (a) & setengah kedalaman (b) di tiap tinggi, sudah termasuk faktor berat. */
export function torsoRings(p: Pick<AvatarParams, 'sex' | 'heightCm' | 'weightKg'>): Ring[] {
  const H = cmToM(p.heightCm);
  const B = BREADTH[p.sex];
  const g = girthScale(p.heightCm, p.weightKg);
  const gw = g ** 0.85;
  const fem = p.sex === 'female';
  const rows: [number, number, number, number][] = [
    // [y/H, setengah lebar/H, rasio kedalaman, ekstra perut]
    [LANDMARK.crotch - 0.005, B.hip / 2 * 0.9, 0.72, 0],
    [LANDMARK.hip, B.hip / 2, 0.72, 0],
    [0.565, (B.hip + B.waist) / 4, 0.74, 0.3],
    [LANDMARK.waist, B.waist / 2, 0.78, 1],
    [0.66, (B.waist + B.chest) / 4, 0.76, 0.6],
    [LANDMARK.chest, B.chest / 2, fem ? 0.8 : 0.7, 0.2],
    [0.78, B.shoulder / 2 * 0.8, 0.62, 0],
    [0.81, B.shoulder / 2 * 0.62, 0.55, 0],
    [0.828, 0.032, 0.9, 0],
  ];
  return rows.map(([y, a, d, belly]) => ({
    y: y * H,
    a: a * H * gw,
    b: a * H * d * g * (1 + belly * Math.max(0, g - 1) * 0.6),
  }));
}

/** Koordinat z permukaan depan tubuh pada tinggi y (meter); -Infinity bila di luar torso/kepala. */
export function bodyFrontZ(p: Pick<AvatarParams, 'sex' | 'heightCm' | 'weightKg'>, y: number): { z: number; halfWidth: number } | null {
  const H = cmToM(p.heightCm);
  if (y > LANDMARK.chin * H) return y <= H ? { z: 0.07 * H, halfWidth: 0.06 * H } : null;
  if (y > 0.828 * H) return { z: 0.03 * H, halfWidth: 0.03 * H };
  const rings = torsoRings(p);
  const first = rings[0];
  if (!first || y < first.y) return null;
  for (let i = 0; i < rings.length - 1; i++) {
    const r0 = rings[i]!;
    const r1 = rings[i + 1]!;
    if (y >= r0.y && y <= r1.y) {
      const t = (y - r0.y) / (r1.y - r0.y);
      return { z: r0.b + (r1.b - r0.b) * t, halfWidth: r0.a + (r1.a - r0.a) * t };
    }
  }
  return null;
}

export function shoulderJoint(p: Pick<AvatarParams, 'sex' | 'heightCm' | 'weightKg'>, side: 1 | -1) {
  const H = cmToM(p.heightCm);
  const g = girthScale(p.heightCm, p.weightKg);
  return new THREE.Vector3(side * (BREADTH[p.sex].shoulder / 2 - 0.028) * H * g ** 0.5, 0.81 * H, -0.004 * H);
}

/** Titik genggam default: depan perut atas, di depan permukaan tubuh. */
export function defaultGrip(p: Pick<AvatarParams, 'sex' | 'heightCm' | 'weightKg'>) {
  const H = cmToM(p.heightCm);
  const y = 0.6 * H;
  const front = bodyFrontZ(p, y)?.z ?? 0.1 * H;
  return new THREE.Vector3(0, y, front + 0.075 * H);
}

/** IK dua tulang analitis. Mengembalikan siku & pergelangan; `reached` false bila target di luar jangkauan. */
export function solveArm(S: THREE.Vector3, T: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3) {
  const toT = new THREE.Vector3().subVectors(T, S);
  const d0 = toT.length();
  const reached = d0 <= (l1 + l2) * 0.999;
  const d = Math.min(Math.max(d0, Math.abs(l1 - l2) + 1e-4), (l1 + l2) * 0.999);
  const dir = toT.normalize();
  const a = (l1 * l1 + d * d - l2 * l2) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const E = S.clone().add(dir.clone().multiplyScalar(a)).add(perp.multiplyScalar(h));
  const Wr = S.clone().add(dir.multiplyScalar(d));
  return { E, W: Wr, reached };
}

export function buildAvatar(p: AvatarParams): BuiltAvatar {
  const H = cmToM(p.heightCm);
  const g = girthScale(p.heightCm, p.weightKg);
  const gl = g ** 0.8;
  const fem = p.sex === 'female';
  const B = BREADTH[p.sex];
  const bag = new PartBag();

  // torso + leher + kepala
  bag.add(SKIN, ellipticLoft(torsoRings(p), 24));
  bag.add(SKIN, taper(new THREE.Vector3(0, 0.815 * H, 0), new THREE.Vector3(0, 0.885 * H, 0.004 * H), 0.024 * H * g ** 0.5, 0.021 * H * g ** 0.4));
  const headC = new THREE.Vector3(0, 0.931 * H, 0.006 * H);
  bag.add(SKIN, ellipsoid(headC, 0.056 * H, 0.063 * H, 0.062 * H, undefined, 20, 16));
  // rambut: puncak tepat di H
  if (fem) {
    bag.add(HAIR, ellipsoid(new THREE.Vector3(0, 0.937 * H, -0.004 * H), 0.06 * H, 0.063 * H, 0.064 * H, undefined, 20, 14));
    bag.add(HAIR, ellipsoid(new THREE.Vector3(0, 0.9 * H, -0.05 * H), 0.03 * H, 0.03 * H, 0.025 * H, undefined, 12, 10));
  } else {
    bag.add(HAIR, ellipsoid(new THREE.Vector3(0, 0.94 * H, -0.006 * H), 0.058 * H, 0.06 * H, 0.062 * H, undefined, 20, 14));
  }

  // kaki
  for (const side of [-1, 1] as const) {
    const hx = side * B.hip / 2 * 0.5 * H * g ** 0.6;
    const kx = side * B.hip / 2 * 0.36 * H;
    const legRings: Ring[] = [
      { y: 0.038 * H, a: 0.016 * H, b: 0.017 * H, x: kx * 0.95 },
      { y: 0.12 * H, a: 0.021 * H * gl, b: 0.022 * H * gl, x: kx },
      { y: 0.215 * H, a: 0.029 * H * gl, b: 0.031 * H * gl, x: kx },
      { y: LANDMARK.knee * H, a: 0.026 * H * gl, b: 0.027 * H * gl, x: kx },
      { y: 0.4 * H, a: 0.04 * H * g ** 0.9, b: 0.041 * H * g ** 0.9, x: (kx + hx) / 2 },
      { y: 0.5 * H, a: 0.05 * H * g ** 0.9 * (fem ? 1.04 : 1), b: 0.05 * H * g ** 0.9, x: hx },
      { y: 0.545 * H, a: 0.048 * H * g ** 0.9, b: 0.05 * H * g ** 0.9, x: hx * 0.9 },
    ];
    bag.add(SKIN, ellipticLoft(legRings, 16));
    // kaki (telapak) — dasar tepat di y=0
    const fh = 0.021 * H;
    bag.add(SKIN, ellipsoid(new THREE.Vector3(kx * 1.02, fh, 0.036 * H), 0.03 * H, fh, SEGMENT.footLength / 2 * H, undefined, 14, 10));
  }

  // lengan
  const l1 = SEGMENT.upperArm * H;
  const l2 = SEGMENT.forearm * H;
  let reached = true;
  let handGrip: THREE.Vector3 | null = null;
  const grip = p.pose === 'holding' ? (p.grip ?? defaultGrip(p)) : null;
  if (grip) handGrip = grip.clone();
  for (const side of [-1, 1] as const) {
    const S = shoulderJoint(p, side);
    let E: THREE.Vector3;
    let Wr: THREE.Vector3;
    let handTip: THREE.Vector3;
    if (grip) {
      // tangan kanan (side -1) di atas, kiri di bawah; menggenggam tangkai dari samping
      const level = grip.clone().add(new THREE.Vector3(0, (side === -1 ? 0.028 : -0.028) * H, 0));
      const target = level.clone().add(new THREE.Vector3(side * 0.045 * H, 0, -0.03 * H));
      const sol = solveArm(S, target, l1, l2, new THREE.Vector3(side * 1, -0.7, -0.9));
      E = sol.E;
      Wr = sol.W;
      reached = reached && sol.reached;
      handTip = level.clone().add(new THREE.Vector3(-side * 0.035 * H, 0, 0.02 * H));
    } else {
      E = S.clone().add(new THREE.Vector3(side * 0.018 * H, -l1, -0.005 * H));
      Wr = E.clone().add(new THREE.Vector3(side * 0.006 * H, -l2, 0.012 * H));
      handTip = Wr.clone().add(new THREE.Vector3(0, -SEGMENT.hand * H, 0.008 * H));
    }
    bag.add(SKIN, ellipsoid(S, 0.03 * H * gl, 0.03 * H * gl, 0.03 * H * gl));
    bag.add(SKIN, taper(S, E, 0.025 * H * gl, 0.019 * H * gl));
    bag.add(SKIN, ellipsoid(E, 0.019 * H * gl, 0.019 * H * gl, 0.019 * H * gl, undefined, 12, 8));
    bag.add(SKIN, taper(E, Wr, 0.019 * H * gl, 0.0135 * H * g ** 0.5));
    const hdir = new THREE.Vector3().subVectors(handTip, Wr).normalize();
    const hlen = SEGMENT.hand * H;
    bag.add(SKIN, ellipsoid(Wr.clone().add(hdir.clone().multiplyScalar(hlen * 0.45)), 0.022 * H, hlen * 0.5, 0.011 * H, hdir, 12, 10));
  }

  const object = bag.toGroup(`avatar:${p.sex}`);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  return {
    object,
    measuredCm: { heightCm: mToCm(size.y), widthCm: mToCm(size.x), depthCm: mToCm(size.z) },
    handGrip,
    reached,
    shoulderHalfWidth: (B.shoulder / 2) * H * g ** 0.5,
  };
}

export function disposeAvatar(a: BuiltAvatar) {
  a.object.traverse((o) => {
    if (o instanceof THREE.Mesh) (o.geometry as THREE.BufferGeometry).dispose();
  });
}
