import * as THREE from 'three';
import type { Sex } from '../lib/anthropometry';
import { buildAvatar, type BuiltAvatar } from './avatar';
import type { BuiltBouquet } from './bouquet';
import { placeInHands } from './hold';

export type SceneMode = 'inspect' | 'compare' | 'hold';

export interface SceneLayout {
  bouquetMatrix: THREE.Matrix4;
  avatar: BuiltAvatar | null;
  /** Kotak dunia semua objek, untuk framing kamera & garis ukur. */
  bouquetBox: THREE.Box3;
  avatarBox: THREE.Box3 | null;
  frameBox: THREE.Box3;
  holdInfo: { pushedForwardCm: number; penetrationCm: number } | null;
}

const GAP = 0.15; // jarak antar avatar & buket di mode banding (m)

export function computeLayout(
  mode: SceneMode,
  bouquet: BuiltBouquet,
  body: { sex: Sex; heightCm: number; weightKg: number; quality?: 'standard' | 'high' },
): SceneLayout {
  const localBox = bouquet.localBox;
  if (mode === 'inspect') {
    const m = new THREE.Matrix4();
    return { bouquetMatrix: m, avatar: null, bouquetBox: localBox.clone(), avatarBox: null, frameBox: localBox.clone(), holdInfo: null };
  }
  if (mode === 'compare') {
    const avatar = buildAvatar({ ...body, pose: 'standing' });
    const aBox = new THREE.Box3().setFromObject(avatar.object);
    // buket berdiri tegak di lantai, di sisi kiri avatar (kanan layar)
    const x = aBox.max.x + GAP - localBox.min.x;
    const m = new THREE.Matrix4().makeTranslation(x, 0, -(localBox.min.z + localBox.max.z) / 2);
    const bBox = localBox.clone().applyMatrix4(m);
    return { bouquetMatrix: m, avatar, bouquetBox: bBox, avatarBox: aBox, frameBox: aBox.clone().union(bBox), holdInfo: null };
  }
  const place = placeInHands(bouquet, body);
  const avatar = buildAvatar({ ...body, pose: 'holding', grip: place.grip });
  const aBox = new THREE.Box3().setFromObject(avatar.object);
  const bBox = localBox.clone().applyMatrix4(place.matrix);
  return {
    bouquetMatrix: place.matrix,
    avatar,
    bouquetBox: bBox,
    avatarBox: aBox,
    frameBox: aBox.clone().union(bBox),
    holdInfo: { pushedForwardCm: place.pushedForward * 100, penetrationCm: place.penetration * 100 },
  };
}
