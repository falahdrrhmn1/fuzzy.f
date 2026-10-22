import * as THREE from 'three';
import { cmToM } from '../lib/units';
import { bodyFrontZ, defaultGrip, type AvatarParams } from './avatar';
import type { BuiltBouquet } from './bouquet';

/** Kemiringan buket saat dipegang: kepala bunga condong menjauh dari dada (rad, sekitar sumbu x). */
export const HOLD_TILT = 0.3;
const CLEARANCE = 0.01; // 1 cm dari permukaan tubuh

export interface HoldPlacement {
  /** Titik genggam akhir di dunia (meter) — dipakai juga oleh IK avatar. */
  grip: THREE.Vector3;
  /** Transform dunia untuk objek buket. */
  matrix: THREE.Matrix4;
  /** Penetrasi tersisa (meter) setelah koreksi; 0 = bebas tabrakan. */
  penetration: number;
  /** Berapa jauh titik genggam didorong maju dari default (meter). */
  pushedForward: number;
}

export function bouquetMatrix(grip: THREE.Vector3, b: BuiltBouquet, tilt = HOLD_TILT) {
  return new THREE.Matrix4()
    .makeTranslation(grip.x, grip.y, grip.z)
    .multiply(new THREE.Matrix4().makeRotationX(tilt))
    .multiply(new THREE.Matrix4().makeTranslation(-b.gripLocal.x, -b.gripLocal.y, -b.gripLocal.z));
}

/** Penetrasi terdalam titik-titik buket ke tubuh (meter). Sampling verteks dengan stride. */
export function penetrationDepth(b: BuiltBouquet, m: THREE.Matrix4, body: Pick<AvatarParams, 'sex' | 'heightCm' | 'weightKg'>, stride = 3) {
  let worst = 0;
  const v = new THREE.Vector3();
  b.parts.forEach(({ geometry, rel }) => {
    const pos = geometry.getAttribute('position');
    const world = new THREE.Matrix4().multiplyMatrices(m, rel);
    for (let i = 0; i < pos.count; i += stride) {
      v.fromBufferAttribute(pos, i).applyMatrix4(world);
      const f = bodyFrontZ(body, v.y);
      if (!f || Math.abs(v.x) > f.halfWidth) continue;
      // hanya titik yang berada di dalam/di depan dekat tubuh (bukan di belakang punggung)
      if (v.z < -f.z) continue;
      const need = f.z + CLEARANCE - v.z;
      if (need > worst) worst = need;
    }
  });
  return worst;
}

/** Tempatkan buket di tangan; dorong titik genggam maju sampai tidak menembus tubuh. */
export function placeInHands(b: BuiltBouquet, body: Pick<AvatarParams, 'sex' | 'heightCm' | 'weightKg'>): HoldPlacement {
  const base = defaultGrip(body);
  const grip = base.clone();
  let pen = 0;
  for (let i = 0; i < 6; i++) {
    pen = penetrationDepth(b, bouquetMatrix(grip, b), body);
    if (pen <= 1e-4) {
      pen = 0;
      break;
    }
    grip.z += pen + 0.002;
  }
  const maxPush = cmToM(body.heightCm) * 0.12;
  if (grip.z - base.z > maxPush) grip.z = base.z + maxPush;
  pen = penetrationDepth(b, bouquetMatrix(grip, b), body);
  return { grip, matrix: bouquetMatrix(grip, b), penetration: pen, pushedForward: grip.z - base.z };
}
