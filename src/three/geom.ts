import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getMaterial, matId, type MatKey } from './materials';

/** PRNG deterministik (mulberry32) agar variasi "handmade" stabil antar render. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = ReturnType<typeof rng>;
export const jitter = (r: Rng, amount: number) => (r() * 2 - 1) * amount;

/** Kumpulan geometri per material; digabung jadi satu mesh per material (sedikit draw call). */
export class PartBag {
  private parts = new Map<string, { key: MatKey; geoms: THREE.BufferGeometry[] }>();

  add(key: MatKey, geom: THREE.BufferGeometry, matrix?: THREE.Matrix4) {
    const g = normalizeAttributes(geom);
    if (matrix) g.applyMatrix4(matrix);
    const id = matId(key);
    const slot = this.parts.get(id) ?? { key, geoms: [] };
    slot.geoms.push(g);
    this.parts.set(id, slot);
  }

  toGroup(name: string): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    for (const { key, geoms } of this.parts.values()) {
      const merged = mergeGeometries(geoms, false);
      geoms.forEach((g) => g.dispose());
      if (!merged) throw new Error(`Gagal menggabungkan geometri ${matId(key)}`);
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, getMaterial(key));
      mesh.name = matId(key);
      // Lapisan transparan dirender setelah yang padat.
      if (key.kind === 'mesh' || key.kind === 'cello') mesh.renderOrder = 2;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}

/** Samakan atribut (position, normal, uv; indexed; tanpa groups) agar bisa di-merge. */
function normalizeAttributes(geom: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geom.index ? geom : indexify(geom);
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  }
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) {
    const count = g.getAttribute('position').count;
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
  }
  g.clearGroups();
  return g;
}

function indexify(geom: THREE.BufferGeometry) {
  const count = geom.getAttribute('position').count;
  const idx = Array.from({ length: count }, (_, i) => i);
  geom.setIndex(idx);
  return geom;
}

/** Tabung kawat bulu sepanjang titik-titik (tertutup untuk loop kelopak). */
export function wireTube(points: THREE.Vector3[], radius: number, closed: boolean, segmentsPerPoint = 2) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.TubeGeometry(curve, Math.max(8, points.length * segmentsPerPoint), radius, 5, closed);
}

export interface LoopOpts {
  /** Lengkung ke arah +z sebanding (y/len)^2; negatif = melengkung ke -z. */
  cup?: number;
  /** 0 = ujung bulat, 1 = ujung runcing. */
  sharp?: number;
  wobble?: number;
  r?: Rng;
}

/**
 * Loop kelopak di bidang XY: pangkal di origin, ujung di (0,len,0), normal +z.
 * Kawat pipe cleaner membentuk kelopak dengan satu loop tertutup.
 */
export function petalLoop(len: number, width: number, opts: LoopOpts = {}, n = 18): THREE.Vector3[] {
  const { cup = 0, sharp = 0, wobble = 0, r } = opts;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const t = (1 - Math.cos(a)) / 2; // 0 di pangkal, 1 di ujung
    const narrowTip = 1 - sharp * 0.75 * t ** 3;
    const narrowBase = 0.35 + 0.65 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5);
    let x = (width / 2) * Math.sin(a) * narrowTip * narrowBase;
    let y = len * t;
    if (r && wobble) {
      x += jitter(r, wobble * width);
      y += jitter(r, wobble * len * 0.5);
    }
    pts.push(new THREE.Vector3(x, y, cup * len * t * t));
  }
  return pts;
}

/** Permukaan parametrik indexed (u,v ∈ [0,1]) dengan uv, untuk kertas pembungkus. */
export function surface(fn: (u: number, v: number, out: THREE.Vector3) => void, nu: number, nv: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      fn(i / nu, j / nv, p);
      pos.push(p.x, p.y, p.z);
      uv.push(i / nu, j / nv);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      const b = a + nu + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export interface Ring {
  y: number;
  /** setengah lebar (x) */
  a: number;
  /** setengah kedalaman (z) */
  b: number;
  x?: number;
  z?: number;
}

/** Loft elips dari bawah ke atas (torso, kaki). Ujung atas & bawah ditutup. */
export function ellipticLoft(rings: Ring[], seg = 20) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  rings.forEach((r, j) => {
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      pos.push((r.x ?? 0) + Math.sin(t) * r.a, r.y, (r.z ?? 0) + Math.cos(t) * r.b);
      uv.push(i / seg, j / (rings.length - 1));
    }
  });
  const row = seg + 1;
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * row + i;
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  for (const [ri, flip] of [[0, true], [rings.length - 1, false]] as const) {
    const r = rings[ri];
    if (!r) continue;
    const c = pos.length / 3;
    pos.push(r.x ?? 0, r.y, r.z ?? 0);
    uv.push(0.5, ri === 0 ? 0 : 1);
    for (let i = 0; i < seg; i++) {
      const a = ri * row + i;
      if (flip) idx.push(c, a + 1, a);
      else idx.push(c, a, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);

/** Silinder meruncing dari A (radius rA) ke B (radius rB). */
export function taper(A: THREE.Vector3, B: THREE.Vector3, rA: number, rB: number, radial = 12) {
  const dir = new THREE.Vector3().subVectors(B, A);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(rB, rA, len, radial, 1, true);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()),
    new THREE.Vector3(1, 1, 1),
  );
  g.applyMatrix4(m);
  return g;
}

/** Elipsoid berpusat di c dengan sumbu y diarahkan ke `dir`. */
export function ellipsoid(c: THREE.Vector3, rx: number, ry: number, rz: number, dir: THREE.Vector3 = UP, w = 16, h = 12) {
  const g = new THREE.SphereGeometry(1, w, h);
  const m = new THREE.Matrix4().compose(
    c,
    new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()),
    new THREE.Vector3(rx, ry, rz),
  );
  g.applyMatrix4(m);
  return g;
}

/** Matriks: posisi p, sumbu +y lokal diarahkan ke dir, lalu diputar `spin` di sekitar sumbu itu. */
export function frame(p: THREE.Vector3, dir: THREE.Vector3, spin = 0, scale = 1) {
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin));
  return new THREE.Matrix4().compose(p, q, new THREE.Vector3(scale, scale, scale));
}
