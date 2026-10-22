import * as THREE from 'three';
import { BREADTH, girthScale, LANDMARK, SEGMENT, type Sex } from '../lib/anthropometry';
import { cmToM, mToCm } from '../lib/units';
import { ellipsoid, ellipticLoft, PartBag, taper, type Ring } from './geom';

/**
 * Avatar procedural (tanpa aset pihak ketiga → bebas lisensi). Proporsi dari tabel antropometri,
 * berdiri di y=0, menghadap +z. Tinggi Box3 = tinggi badan (rambut termasuk, seperti stadiometer).
 * Pakaian sederhana bernada kalem agar perhatian tetap pada buket.
 */
export interface AvatarParams {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  pose: 'standing' | 'holding';
  /** Titik genggam (dunia, meter) untuk pose holding; default = defaultGrip(). */
  grip?: THREE.Vector3;
  quality?: 'standard' | 'high';
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

type Body = Pick<AvatarParams, 'sex' | 'heightCm' | 'weightKg'>;

const SKIN = { kind: 'skin' as const, color: '#E0BFA8' };
const HAIR = { kind: 'hair' as const, color: '#3E2D26' };
const SHOE = { kind: 'shoe' as const, color: '#3A302C' };
const OUTFIT: Record<Sex, { top: string; bottom: string }> = {
  female: { top: '#CFC3D9', bottom: '#8E9C8F' },
  male: { top: '#BFCCD6', bottom: '#4B505A' },
};
/** tebal pakaian di atas kulit (m) — ikut dipakai uji tabrakan */
export const CLOTH = 0.005;

/** Profil torso: setengah lebar (a) & setengah kedalaman (b) di tiap tinggi, sudah termasuk faktor berat. */
export function torsoRings(p: Body): Ring[] {
  const H = cmToM(p.heightCm);
  const B = BREADTH[p.sex];
  const g = girthScale(p.heightCm, p.weightKg);
  const gw = g ** 0.85;
  const fem = p.sex === 'female';
  const rows: [number, number, number, number][] = [
    // [y/H, setengah lebar/H, rasio kedalaman, ekstra perut]
    [LANDMARK.crotch - 0.005, (B.hip / 2) * 0.9, 0.72, 0],
    [LANDMARK.hip, B.hip / 2, 0.72, 0],
    [0.565, (B.hip + B.waist) / 4, 0.74, 0.3],
    [LANDMARK.waist, B.waist / 2, 0.78, 1],
    [0.66, (B.waist + B.chest) / 4, 0.76, 0.6],
    [LANDMARK.chest, B.chest / 2, fem ? 0.82 : 0.7, 0.2],
    [0.78, (B.shoulder / 2) * 0.8, 0.62, 0],
    [0.81, (B.shoulder / 2) * 0.62, 0.55, 0],
    [0.828, 0.032, 0.9, 0],
  ];
  return rows.map(([y, a, d, belly]) => ({
    y: y * H,
    a: a * H * gw,
    b: a * H * d * g * (1 + belly * Math.max(0, g - 1) * 0.6),
  }));
}

const inflate = (rings: Ring[], by: number, k = 1): Ring[] => rings.map((r) => ({ ...r, a: r.a * k + by, b: r.b * k + by }));

/** Permukaan depan tubuh (termasuk pakaian) pada tinggi y (meter); null bila di luar torso/kepala. */
export function bodyFrontZ(p: Body, y: number): { z: number; halfWidth: number } | null {
  const H = cmToM(p.heightCm);
  if (y > LANDMARK.chin * H) return y <= H ? { z: 0.075 * H, halfWidth: 0.06 * H } : null;
  if (y > 0.828 * H) return { z: 0.03 * H, halfWidth: 0.03 * H };
  const rings = torsoRings(p);
  const first = rings[0];
  if (!first || y < first.y) return null;
  for (let i = 0; i < rings.length - 1; i++) {
    const r0 = rings[i]!;
    const r1 = rings[i + 1]!;
    if (y >= r0.y && y <= r1.y) {
      const t = (y - r0.y) / (r1.y - r0.y);
      return { z: r0.b + (r1.b - r0.b) * t + CLOTH, halfWidth: r0.a + (r1.a - r0.a) * t + CLOTH };
    }
  }
  return null;
}

export function shoulderJoint(p: Body, side: 1 | -1) {
  const H = cmToM(p.heightCm);
  const g = girthScale(p.heightCm, p.weightKg);
  return new THREE.Vector3(side * (BREADTH[p.sex].shoulder / 2 - 0.028) * H * g ** 0.5, 0.81 * H, -0.004 * H);
}

/** Titik genggam default: depan perut atas, di depan permukaan tubuh. */
export function defaultGrip(p: Body) {
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
  const hi = p.quality === 'high';
  const seg = hi ? 32 : 22;
  const sph = (n: number) => (hi ? Math.round(n * 1.5) : n);
  const outfit = OUTFIT[p.sex];
  const TOP = { kind: 'cloth' as const, color: outfit.top };
  const BOTTOM = { kind: 'cloth' as const, color: outfit.bottom };
  const bag = new PartBag();
  const torso = torsoRings(p);

  // torso: kulit + atasan; bawahan (rok / celana) menutup panggul
  bag.add(SKIN, ellipticLoft(torso, seg));
  const topFrom = fem ? 0.555 : 0.51;
  bag.add(TOP, ellipticLoft(inflate(torso.filter((r) => r.y >= topFrom * H - 1e-6 && r.y <= 0.812 * H), CLOTH, 1.02), seg));
  const waist = torso.find((r) => Math.abs(r.y - LANDMARK.waist * H) < 1e-6)!;
  const hip = torso.find((r) => Math.abs(r.y - LANDMARK.hip * H) < 1e-6)!;
  if (fem) {
    // rok A-line: pinggang → di bawah lutut
    bag.add(BOTTOM, ellipticLoft([
      { y: 0.335 * H, a: hip.a * 1.32 + CLOTH, b: hip.b * 1.45 + CLOTH },
      { y: 0.45 * H, a: hip.a * 1.16 + CLOTH, b: hip.b * 1.25 + CLOTH },
      { y: LANDMARK.hip * H, a: hip.a * 1.05 + CLOTH, b: hip.b * 1.08 + CLOTH },
      { y: (LANDMARK.waist + 0.005) * H, a: waist.a * 1.03 + CLOTH, b: waist.b * 1.04 + CLOTH },
    ], seg));
  } else {
    bag.add(BOTTOM, ellipticLoft(inflate(torso.filter((r) => r.y <= (LANDMARK.waist + 0.02) * H), CLOTH * 1.2, 1.02), seg));
  }

  // leher + kepala (tengkorak, rahang, hidung, telinga)
  bag.add(SKIN, taper(new THREE.Vector3(0, 0.815 * H, 0), new THREE.Vector3(0, 0.885 * H, 0.004 * H), 0.024 * H * g ** 0.5, 0.021 * H * g ** 0.4, sph(14)));
  bag.add(SKIN, ellipsoid(new THREE.Vector3(0, 0.931 * H, 0.004 * H), 0.055 * H, 0.062 * H, 0.06 * H, undefined, sph(22), sph(16)));
  bag.add(SKIN, ellipsoid(new THREE.Vector3(0, 0.897 * H, 0.006 * H), 0.037 * H, 0.028 * H, 0.04 * H, undefined, sph(16), sph(12)));
  bag.add(SKIN, ellipsoid(new THREE.Vector3(0, 0.918 * H, 0.062 * H), 0.0075 * H, 0.013 * H, 0.009 * H, new THREE.Vector3(0, 1, -0.35), 10, 8));
  for (const s of [-1, 1]) bag.add(SKIN, ellipsoid(new THREE.Vector3(s * 0.054 * H, 0.922 * H, 0.002 * H), 0.006 * H, 0.016 * H, 0.01 * H, undefined, 10, 8));
  // rambut: puncak tepat di H
  if (fem) {
    bag.add(HAIR, ellipsoid(new THREE.Vector3(0, 0.937 * H, -0.006 * H), 0.06 * H, 0.063 * H, 0.064 * H, undefined, sph(22), sph(14)));
    bag.add(HAIR, ellipsoid(new THREE.Vector3(0, 0.875 * H, -0.04 * H), 0.058 * H, 0.072 * H, 0.032 * H, undefined, sph(18), sph(12)));
  } else {
    bag.add(HAIR, ellipsoid(new THREE.Vector3(0, 0.942 * H, -0.008 * H), 0.058 * H, 0.058 * H, 0.062 * H, undefined, sph(22), sph(14)));
  }

  // kaki
  for (const side of [-1, 1] as const) {
    const hx = (side * B.hip) / 2 * 0.5 * H * g ** 0.6;
    const kx = (side * B.hip) / 2 * 0.36 * H;
    const legRings: Ring[] = [
      { y: 0.038 * H, a: 0.016 * H, b: 0.017 * H, x: kx * 0.95 },
      { y: 0.12 * H, a: 0.021 * H * gl, b: 0.022 * H * gl, x: kx },
      { y: 0.215 * H, a: 0.029 * H * gl, b: 0.031 * H * gl, x: kx },
      { y: LANDMARK.knee * H, a: 0.026 * H * gl, b: 0.027 * H * gl, x: kx },
      { y: 0.4 * H, a: 0.04 * H * g ** 0.9, b: 0.041 * H * g ** 0.9, x: (kx + hx) / 2 },
      { y: 0.5 * H, a: 0.05 * H * g ** 0.9 * (fem ? 1.04 : 1), b: 0.05 * H * g ** 0.9, x: hx },
      { y: 0.545 * H, a: 0.048 * H * g ** 0.9, b: 0.05 * H * g ** 0.9, x: hx * 0.9 },
    ];
    bag.add(SKIN, ellipticLoft(legRings, sph(16)));
    if (!fem) bag.add(BOTTOM, ellipticLoft(inflate(legRings.slice(1), CLOTH * 1.4, 1.06), sph(16)));
    // sepatu — dasar tepat di y=0
    const fh = 0.021 * H;
    bag.add(SHOE, ellipsoid(new THREE.Vector3(kx * 1.02, fh, 0.036 * H), 0.032 * H, fh, (SEGMENT.footLength / 2) * H * 1.04, undefined, sph(16), sph(10)));
  }

  // lengan + lengan baju + tangan
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
    const rs = 0.03 * H * gl;
    bag.add(SKIN, ellipsoid(S, rs, rs, rs, undefined, sph(14), sph(10)));
    bag.add(SKIN, taper(S, E, 0.025 * H * gl, 0.019 * H * gl, sph(12)));
    bag.add(SKIN, ellipsoid(E, 0.019 * H * gl, 0.019 * H * gl, 0.019 * H * gl, undefined, 12, 8));
    bag.add(SKIN, taper(E, Wr, 0.019 * H * gl, 0.0135 * H * g ** 0.5, sph(12)));
    // lengan baju pendek
    const sleeveEnd = S.clone().lerp(E, fem ? 0.42 : 0.5);
    bag.add(TOP, ellipsoid(S, rs + CLOTH, rs + CLOTH, rs + CLOTH, undefined, sph(14), sph(10)));
    bag.add(TOP, taper(S, sleeveEnd, 0.025 * H * gl + CLOTH * 1.6, 0.023 * H * gl + CLOTH * 1.6, sph(12)));
    // tangan: telapak + jari + ibu jari
    const hdir = new THREE.Vector3().subVectors(handTip, Wr).normalize();
    const hlen = SEGMENT.hand * H;
    const across = new THREE.Vector3().crossVectors(hdir, new THREE.Vector3(0, 0, 1)).normalize();
    if (across.lengthSq() < 1e-6) across.set(1, 0, 0);
    bag.add(SKIN, ellipsoid(Wr.clone().addScaledVector(hdir, hlen * 0.3), 0.021 * H, hlen * 0.3, 0.011 * H, hdir, 12, 10));
    // saat menggenggam, jari sedikit menekuk ke bawah melingkari tangkai
    const fingerDir = grip ? hdir.clone().add(new THREE.Vector3(0, -0.25, 0)).normalize() : hdir;
    bag.add(SKIN, ellipsoid(Wr.clone().addScaledVector(hdir, hlen * 0.62).addScaledVector(fingerDir, hlen * 0.08), 0.019 * H, hlen * 0.26, 0.0095 * H, fingerDir, 12, 10));
    const thumbBase = Wr.clone().addScaledVector(hdir, hlen * 0.22).addScaledVector(across, side * -0.016 * H);
    const thumbDir = hdir.clone().addScaledVector(across, side * -0.6).add(new THREE.Vector3(0, 0, 0.3)).normalize();
    bag.add(SKIN, ellipsoid(thumbBase.clone().addScaledVector(thumbDir, hlen * 0.2), 0.0075 * H, hlen * 0.22, 0.0075 * H, thumbDir, 10, 8));
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
