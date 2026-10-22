import * as THREE from 'three';

/**
 * Material di-cache per (jenis, warna, motif) agar dipakai ulang antar buket.
 * Semua tekstur dibuat sebagai DataTexture → aman dijalankan di Node (test) tanpa `document`.
 */
export type MatKind = 'fuzz' | 'petal' | 'fur' | 'paper' | 'mesh' | 'cello' | 'ribbon' | 'glow' | 'skin' | 'hair' | 'cloth' | 'shoe';
export type PaperPattern = 'plain' | 'check' | 'stripe';
export interface MatKey {
  kind: MatKind;
  color: string;
  pattern?: PaperPattern;
}
export const matId = (k: MatKey) => `${k.kind}:${k.color.toLowerCase()}${k.pattern && k.pattern !== 'plain' ? `:${k.pattern}` : ''}`;

function prng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function toTexture(data: Uint8Array<ArrayBuffer>, n: number, repeat: [number, number], format: THREE.PixelFormat = THREE.RGBAFormat) {
  const t = new THREE.DataTexture(data, n, n, format);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Height field → normal map RGBA. */
function heightToNormal(h: Float32Array, n: number, strength: number) {
  const at = (x: number, y: number) => h[((y + n) % n) * n + ((x + n) % n)] ?? 0;
  const data = new Uint8Array(n * n * 4);
  const v = new THREE.Vector3();
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      v.set(-(at(x + 1, y) - at(x - 1, y)) * strength, -(at(x, y + 1) - at(x, y - 1)) * strength, 1).normalize();
      const o = (y * n + x) * 4;
      data[o] = (v.x * 0.5 + 0.5) * 255;
      data[o + 1] = (v.y * 0.5 + 0.5) * 255;
      data[o + 2] = (v.z * 0.5 + 0.5) * 255;
      data[o + 3] = 255;
    }
  }
  return data;
}

function addFibers(h: Float32Array, n: number, count: number, seed: number, amp: number) {
  const rnd = prng(seed);
  for (let i = 0; i < count; i++) {
    const x0 = Math.floor(rnd() * n);
    const y0 = Math.floor(rnd() * n);
    const len = 3 + Math.floor(rnd() * 6);
    const a = (0.5 + rnd() * 0.5) * amp;
    for (let k = 0; k < len; k++) {
      const idx = ((y0 + k) % n) * n + ((x0 + Math.round((rnd() - 0.5) * 1.2) + n) % n);
      h[idx] = (h[idx] ?? 0) + a;
    }
  }
}

const tex = new Map<string, THREE.DataTexture>();
function cached(id: string, make: () => THREE.DataTexture) {
  let t = tex.get(id);
  if (!t) {
    t = make();
    tex.set(id, t);
  }
  return t;
}

/** Serat bulu melingkari tabung kawat (TubeGeometry: uv.x sepanjang, uv.y keliling). */
const fiberNormal = () =>
  cached('fiber', () => {
    const n = 64;
    const h = new Float32Array(n * n);
    addFibers(h, n, 900, 7, 1);
    return toTexture(heightToNormal(h, n, 0.9), n, [14, 2]);
  });

/** Kelopak terisi: rusuk lilitan kawat memanjang (variasi di uv.x) + serat halus. */
const ridgeNormal = () =>
  cached('ridge', () => {
    const n = 64;
    const h = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = 1.6 * (0.5 - 0.5 * Math.cos((x / n) * Math.PI * 2 * 7));
    addFibers(h, n, 700, 11, 0.7);
    return toTexture(heightToNormal(h, n, 0.55), n, [1, 1]);
  });

/** Alpha ujung serat untuk "shell fur" (mode Bagus). */
const furAlpha = () =>
  cached('fur', () => {
    const n = 128;
    const data = new Uint8Array(n * n * 4);
    const rnd = prng(23);
    for (let i = 0; i < n * n; i++) {
      const on = rnd() < 0.34 ? 255 : 0;
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 255;
      data[i * 4 + 3] = on;
    }
    const t = toTexture(data, n, [26, 7]);
    t.magFilter = THREE.NearestFilter;
    return t;
  });

/** Motif kertas pembungkus: abu-abu yang dikalikan dengan warna kertas (garis halus lebih gelap). */
const patternMap = (p: PaperPattern) =>
  cached(`pat:${p}`, () => {
    const n = 64;
    const data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let v = 1;
        if (p === 'check') {
          const lx = x % 16 < 3;
          const ly = y % 16 < 3;
          v = lx && ly ? 0.84 : lx || ly ? 0.91 : 1;
        } else if (p === 'stripe') {
          v = (x + y) % 16 < 4 ? 0.9 : 1;
        }
        const o = (y * n + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = v * 255;
        data[o + 3] = 255;
      }
    }
    return toTexture(data, n, [9, 9]);
  });

/**
 * Motif pita berwarna (gingham: garis putih tebal di atas warna pita). Warna dimasukkan ke tekstur
 * karena map hanya bisa menggelapkan; material pita bermotif memakai color putih.
 */
const ribbonMap = (p: PaperPattern, base: THREE.Color) =>
  cached(`rib:${p}:${base.getHexString()}`, () => {
    const n = 32;
    const data = new Uint8Array(n * n * 4);
    const white = new THREE.Color('#ffffff');
    const mid = base.clone().lerp(white, 0.5);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const lx = x % 16 < 6;
        const ly = y % 16 < 6;
        const c = p === 'check' ? (lx && ly ? white : lx || ly ? mid : base) : (x + y) % 16 < 5 ? white : base;
        const o = (y * n + x) * 4;
        const srgb = c.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
        data[o] = srgb.r * 255;
        data[o + 1] = srgb.g * 255;
        data[o + 2] = srgb.b * 255;
        data[o + 3] = 255;
      }
    }
    const t = toTexture(data, n, [1, 7]);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });

const cache = new Map<string, THREE.Material>();

const lighten = (c: THREE.Color, t: number) => c.clone().lerp(new THREE.Color('#ffffff'), t);

export function getMaterial(k: MatKey): THREE.Material {
  const id = matId(k);
  const hit = cache.get(id);
  if (hit) return hit;
  const color = new THREE.Color(k.color);
  let m: THREE.Material;
  switch (k.kind) {
    case 'fuzz':
      m = new THREE.MeshPhysicalMaterial({
        color, vertexColors: true, roughness: 0.95, metalness: 0,
        sheen: 1, sheenRoughness: 0.5, sheenColor: lighten(color, 0.5),
        normalMap: fiberNormal(), normalScale: new THREE.Vector2(1.1, 1.1),
      });
      break;
    case 'petal':
      m = new THREE.MeshPhysicalMaterial({
        color, vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide,
        sheen: 1, sheenRoughness: 0.45, sheenColor: lighten(color, 0.55),
        normalMap: ridgeNormal(), normalScale: new THREE.Vector2(0.6, 0.6),
      });
      break;
    case 'fur':
      m = new THREE.MeshStandardMaterial({
        color: lighten(color, 0.12), vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide,
        alphaMap: furAlpha(), alphaTest: 0.5,
      });
      break;
    case 'paper':
      m = new THREE.MeshStandardMaterial({
        color, vertexColors: true, roughness: 0.66, metalness: 0, side: THREE.DoubleSide,
        map: k.pattern && k.pattern !== 'plain' ? patternMap(k.pattern) : null,
      });
      break;
    case 'mesh':
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
      break;
    case 'cello':
      m = new THREE.MeshPhysicalMaterial({
        color, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false,
        iridescence: 1, iridescenceIOR: 1.4,
      });
      break;
    case 'ribbon':
      if (k.pattern && k.pattern !== 'plain') {
        m = new THREE.MeshPhysicalMaterial({
          color: '#ffffff', map: ribbonMap(k.pattern, new THREE.Color(k.color)), roughness: 0.5, metalness: 0, side: THREE.DoubleSide,
          sheen: 0.5, sheenColor: lighten(color, 0.6),
        });
      } else {
        m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, metalness: 0, side: THREE.DoubleSide, sheen: 0.6, sheenColor: lighten(color, 0.6) });
      }
      break;
    case 'glow':
      m = new THREE.MeshBasicMaterial({ color: color.multiplyScalar(2.2), toneMapped: false });
      break;
    case 'skin':
      m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.58, metalness: 0, sheen: 0.25, sheenColor: new THREE.Color('#f3c8b8') });
      break;
    case 'hair':
      m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, metalness: 0, sheen: 0.6, sheenColor: lighten(color, 0.35) });
      break;
    case 'cloth':
      m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.88, metalness: 0, sheen: 0.7, sheenRoughness: 0.7, sheenColor: lighten(color, 0.35) });
      break;
    case 'shoe':
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0 });
      break;
  }
  m.name = id;
  cache.set(id, m);
  return m;
}

/** Dipanggil saat aplikasi ditutup / test selesai. Material dipakai bersama, jadi jangan dispose per buket. */
export function disposeAllMaterials() {
  cache.forEach((m) => m.dispose());
  cache.clear();
  tex.forEach((t) => t.dispose());
  tex.clear();
}
