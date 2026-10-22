import * as THREE from 'three';

/**
 * Material di-cache per (jenis, warna) agar dipakai ulang antar buket.
 * Semua tekstur dibuat sebagai DataTexture → aman dijalankan di Node (test) tanpa `document`.
 */
export type MatKind = 'fuzz' | 'paper' | 'mesh' | 'cello' | 'ribbon' | 'glow' | 'skin' | 'hair';
export interface MatKey {
  kind: MatKind;
  color: string;
}
export const matId = (k: MatKey) => `${k.kind}:${k.color.toLowerCase()}`;

let fuzzNormal: THREE.DataTexture | null = null;

/** Normal map serat: tonjolan acak rapat yang memanjang melingkari tabung (arah v pada TubeGeometry). */
function getFuzzNormal(): THREE.DataTexture {
  if (fuzzNormal) return fuzzNormal;
  const n = 64;
  const h = new Float32Array(n * n);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const x0 = Math.floor(rnd() * n);
    const y0 = Math.floor(rnd() * n);
    const len = 3 + Math.floor(rnd() * 6);
    const amp = 0.5 + rnd() * 0.5;
    for (let k = 0; k < len; k++) {
      const x = (x0 + Math.round((rnd() - 0.5) * 1.2)) % n;
      const y = (y0 + k) % n;
      const idx = y * n + ((x + n) % n);
      h[idx] = (h[idx] ?? 0) + amp;
    }
  }
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const at = (xx: number, yy: number) => h[((yy + n) % n) * n + ((xx + n) % n)] ?? 0;
      const dx = at(x + 1, y) - at(x - 1, y);
      const dy = at(x, y + 1) - at(x, y - 1);
      const v = new THREE.Vector3(-dx * 0.9, -dy * 0.9, 1).normalize();
      const o = (y * n + x) * 4;
      data[o] = (v.x * 0.5 + 0.5) * 255;
      data[o + 1] = (v.y * 0.5 + 0.5) * 255;
      data[o + 2] = (v.z * 0.5 + 0.5) * 255;
      data[o + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 2);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  fuzzNormal = t;
  return t;
}

const cache = new Map<string, THREE.Material>();

export function getMaterial(k: MatKey): THREE.Material {
  const id = matId(k);
  const hit = cache.get(id);
  if (hit) return hit;
  const color = new THREE.Color(k.color);
  let m: THREE.Material;
  switch (k.kind) {
    case 'fuzz':
      m = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.95,
        metalness: 0,
        sheen: 1,
        sheenRoughness: 0.55,
        sheenColor: color.clone().lerp(new THREE.Color('#ffffff'), 0.45),
        normalMap: getFuzzNormal(),
        normalScale: new THREE.Vector2(1.1, 1.1),
      });
      break;
    case 'paper':
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
      break;
    case 'mesh':
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
      break;
    case 'cello':
      m = new THREE.MeshPhysicalMaterial({
        color, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false,
        iridescence: 1, iridescenceIOR: 1.4,
      });
      break;
    case 'ribbon':
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0, side: THREE.DoubleSide });
      break;
    case 'glow':
      m = new THREE.MeshBasicMaterial({ color });
      break;
    case 'hair':
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
      break;
    case 'skin':
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 });
      break;
  }
  m.name = id;
  cache.set(id, m);
  return m;
}

/** Dipanggil saat aplikasi benar-benar ditutup / test selesai. Material dipakai bersama, jadi jangan dispose per buket. */
export function disposeAllMaterials() {
  cache.forEach((m) => m.dispose());
  cache.clear();
  fuzzNormal?.dispose();
  fuzzNormal = null;
}
