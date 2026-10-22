import * as THREE from 'three';
import { buildSizeCm } from '../data/products';
import type { FlowerType, Product, Variant } from '../data/schema';
import { cmToM, mToCm } from '../lib/units';
import { addFlower, addLeaf, addSprig, addStem, HEAD_RADIUS } from './flowers';
import { ellipsoid, frame, jitter, PartBag, rng, surface, wireTube } from './geom';

/**
 * Buket dibangun langsung pada ukuran target (meter), origin = tengah dasar pegangan, +y ke atas,
 * depan buket menghadap +z. Lalu dikalibrasi dengan SATU skala uniform agar tinggi Box3 = tinggi data.
 */
export interface BuiltBouquet {
  object: THREE.Group;
  /** Titik genggam (pusat pita) dalam koordinat lokal objek, sudah termasuk skala kalibrasi. */
  gripLocal: THREE.Vector3;
  /** Ukuran model terukur (Box3) setelah kalibrasi, cm. */
  measuredCm: { heightCm: number; widthCm: number; depthCm: number };
  targetCm: { heightCm: number; widthCm: number; depthCm: number };
  calibrationScale: number;
  triangles: number;
  /** Box3 dalam ruang lokal root (tidak terpengaruh posisi di scene). */
  localBox: THREE.Box3;
  /** Geometri + transform relatif terhadap root, untuk uji tabrakan tanpa bergantung pada induk scene. */
  parts: { geometry: THREE.BufferGeometry; rel: THREE.Matrix4 }[];
}

export const GRIP_FRACTION = 0.36;

interface Head {
  type: FlowerType;
  color: string;
  scale: number;
}

function colorOf(v: Variant, key: string, fallback: string) {
  return v.palette[key] ?? fallback;
}

export function buildBouquet(product: Product, variant: Variant, seed = 1): BuiltBouquet {
  const target = buildSizeCm(product);
  const H = cmToM(target.heightCm);
  const W = cmToM(target.widthCm);
  const D = cmToM(target.depthCm);
  const r = rng(seed * 9973 + product.id.length);
  const bag = new PartBag();
  const gripY = H * GRIP_FRACTION;
  const grip = new THREE.Vector3(0, gripY, 0);
  const stemC = colorOf(variant, 'stem', '#6E9B4E');
  const leafC = colorOf(variant, 'leaf', '#86B35A');

  // ---- kepala bunga: besar di tengah, kecil diselipkan acak ----
  const heads: Head[] = [];
  for (const f of product.recipe.flowers) {
    for (let i = 0; i < f.count; i++) heads.push({ type: f.type, color: colorOf(variant, f.color, '#E9B8B5'), scale: f.scale ?? 1 });
  }
  heads.sort((a, b) => HEAD_RADIUS[b.type] * b.scale - HEAD_RADIUS[a.type] * a.scale);
  const big = heads.filter((h) => HEAD_RADIUS[h.type] >= 0.05);
  const small = heads.filter((h) => HEAD_RADIUS[h.type] < 0.05);
  for (let i = small.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [small[i], small[j]] = [small[j]!, small[i]!];
  }
  const order = [...big, ...small];
  const n = order.length;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const Rx = W * 0.3;
  const Rz = D * 0.3;
  const domeTop = H * 0.84;
  const headPositions: THREE.Vector3[] = [];
  order.forEach((h, i) => {
    const rad = Math.sqrt((i + 0.6) / (n + 0.6));
    const ang = i * golden + 0.4;
    const x = Math.sin(ang) * rad * Rx + jitter(r, 0.006);
    const z = Math.cos(ang) * rad * Rz + D * 0.06 + jitter(r, 0.006);
    const y = domeTop - rad * rad * H * 0.12 + jitter(r, 0.008);
    const p = new THREE.Vector3(x, y, z);
    const dir = new THREE.Vector3(x * 2.2, H * 0.5, z * 2.2 + D * 0.35).normalize();
    const c = { petal: h.color, center: colorOf(variant, h.type === 'sunflower' ? 'disk' : 'center', h.type === 'lily' ? '#F5EBD8' : '#F2C94C') };
    addFlower(bag, h.type, frame(p, dir, r() * Math.PI * 2), c, r, h.scale);
    headPositions.push(p);
    const off = new THREE.Vector3(Math.cos(i * 2.4) * 0.01, 0, Math.sin(i * 2.4) * 0.01);
    addStem(bag, p, grip.clone().add(off), 0.02, stemC);
  });

  for (let i = 0; i < product.recipe.leaves; i++) {
    const ang = (i / Math.max(1, product.recipe.leaves)) * Math.PI * 2 + 0.7;
    const base = new THREE.Vector3(Math.sin(ang) * W * 0.16, H * 0.7, Math.cos(ang) * D * 0.16);
    addLeaf(bag, frame(base, new THREE.Vector3(Math.sin(ang) * 0.8, 1, Math.cos(ang) * 0.8), ang), leafC, r);
  }
  for (let i = 0; i < product.recipe.sprigs; i++) {
    const ang = (i / Math.max(1, product.recipe.sprigs)) * Math.PI * 2 + 0.2;
    const base = new THREE.Vector3(Math.sin(ang) * W * 0.18, H * 0.74, Math.cos(ang) * D * 0.15);
    addSprig(bag, frame(base, new THREE.Vector3(Math.sin(ang) * 0.5, 1, Math.cos(ang) * 0.5)), leafC, r);
  }

  // ---- kertas pembungkus: lembar mengipas dari titik ikat, belakang tinggi, depan rendah ----
  const wrapC = colorOf(variant, 'wrapper', '#F3EADF');
  const rg = W * 0.075;
  const sheets = product.recipe.wrapperSheets;
  for (let j = 0; j < sheets; j++) {
    const theta = (j / sheets) * Math.PI * 2 + jitter(r, 0.12);
    const span = (1.45 * Math.PI) / sheets;
    const layer = 1 + (j % 2) * 0.018;
    const geom = surface((u, v, out) => {
      const a = theta + (u * 2 - 1) * span;
      const back = (1 - Math.cos(a)) / 2; // 0 depan, 1 belakang
      const topY = gripY + (H * (0.64 + 0.36 * back ** 0.8) - gripY) * (1 - 0.06 * Math.abs(u * 2 - 1));
      const rad = (rg + (W / 2 - rg) * v ** 0.62) * layer * (1 + 0.025 * Math.sin(u * Math.PI * 3) * v);
      out.set(Math.sin(a) * rad, gripY + (topY - gripY) * v, Math.cos(a) * rad * (D / W));
    }, 10, 12);
    bag.add({ kind: 'paper', color: wrapC }, geom);
  }
  if (product.recipe.meshLayer) {
    const meshC = colorOf(variant, 'mesh', '#FFFFFF');
    for (let j = 0; j < 5; j++) {
      const theta = ((j - 2) / 5) * Math.PI * 1.3;
      const span = 0.42;
      bag.add({ kind: 'mesh', color: meshC }, surface((u, v, out) => {
        const a = theta + (u * 2 - 1) * span;
        const topY = H * (0.62 + 0.05 * Math.abs(Math.sin(a)));
        const rad = (rg * 1.1 + (W / 2 * 0.97 - rg) * v ** 0.55) * (1 + 0.06 * Math.sin(u * Math.PI * 6 + j) * v * v);
        out.set(Math.sin(a) * rad, gripY + (topY - gripY) * v, Math.cos(a) * rad * (D / W) * 1.02);
      }, 14, 10));
    }
  }
  if (product.recipe.cellophane) {
    const celC = colorOf(variant, 'cello', '#DDEBF2');
    for (let j = 0; j < 3; j++) {
      const theta = Math.PI + (j - 1) * 0.9;
      bag.add({ kind: 'cello', color: celC }, surface((u, v, out) => {
        const a = theta + (u * 2 - 1) * 0.5;
        const rad = (rg + (W / 2 * 0.92 - rg) * v ** 0.7) * 1.01;
        out.set(Math.sin(a) * rad, gripY + (H * 0.97 - gripY) * v, Math.cos(a) * rad * (D / W));
      }, 8, 10));
    }
  }

  // ---- selongsong pegangan di bawah titik ikat ----
  const sleeve: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    sleeve.push(new THREE.Vector2(W * (0.16 - 0.085 * t ** 0.9), gripY * t));
  }
  const sleeveGeom = new THREE.LatheGeometry(sleeve, 28);
  sleeveGeom.scale(1, 1, D / W + (1 - D / W) * 0.6);
  bag.add({ kind: 'paper', color: wrapC }, sleeveGeom);

  // ---- pita di titik ikat ----
  const ribC = colorOf(variant, 'ribbon', '#E9B8B5');
  const k = W / 0.4;
  const ribbon = { kind: 'ribbon' as const, color: ribC };
  const band = new THREE.TorusGeometry(rg * 1.08, 0.006 * k, 6, 28).rotateX(Math.PI / 2).scale(1, 1.6, D / W + (1 - D / W) * 0.6);
  band.translate(0, gripY, 0);
  bag.add(ribbon, band);
  const knot = new THREE.Vector3(0, gripY, rg * 1.08 * (D / W + (1 - D / W) * 0.6) + 0.006);
  for (const side of [-1, 1]) {
    const loop = new THREE.TorusGeometry(0.03 * k, 0.0065 * k, 6, 20).scale(1, 0.55, 0.35);
    loop.applyMatrix4(new THREE.Matrix4().compose(knot.clone().add(new THREE.Vector3(side * 0.027 * k, 0.004, 0.006)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side * 0.35, side * 0.25)), new THREE.Vector3(1, 1, 1)));
    bag.add(ribbon, loop);
    const tail = [knot.clone(), knot.clone().add(new THREE.Vector3(side * 0.02 * k, -0.06 * k, 0.012)), knot.clone().add(new THREE.Vector3(side * 0.035 * k, -0.12 * k, 0.008))];
    bag.add(ribbon, wireTube(tail, 0.005 * k, false, 4).scale(1, 1, 1));
  }
  bag.add(ribbon, ellipsoid(knot, 0.01 * k, 0.009 * k, 0.008 * k));

  if (product.recipe.fairyLights) {
    const glow = { kind: 'glow' as const, color: colorOf(variant, 'light', '#FFD27A') };
    for (let i = 0; i < 20; i++) {
      const h = headPositions[i % headPositions.length];
      if (!h) break;
      bag.add(glow, ellipsoid(h.clone().add(new THREE.Vector3(jitter(r, 0.03), jitter(r, 0.03) - 0.02, jitter(r, 0.03) + 0.02)), 0.005, 0.005, 0.005, undefined, 8, 6));
    }
  }

  const object = bag.toGroup(`bouquet:${product.id}:${variant.id}`);
  return calibrate(object, grip, target);
}

/**
 * Model GLB (hasil Blender/scan) → BuiltBouquet. Model diletakkan berdiri di y=0, dipusatkan di x/z,
 * lalu dikalibrasi ke tinggi data dengan skala uniform yang sama seperti model procedural.
 * Konvensi file: sumbu +Y ke atas, depan buket menghadap +Z.
 */
export function bouquetFromScene(scene: THREE.Object3D, product: Product, gripFraction: number): BuiltBouquet {
  const object = new THREE.Group();
  object.name = `bouquet-glb:${product.id}`;
  const model = scene.clone(true);
  object.add(model);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const c = box.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  const h = box.max.y - box.min.y;
  return calibrate(object, new THREE.Vector3(0, h * gripFraction, 0), buildSizeCm(product));
}

/** Skala uniform agar tinggi Box3 = tinggi target. Tidak pernah non-uniform (proporsi dijaga). */
export function calibrate(object: THREE.Group, grip: THREE.Vector3, target: BuiltBouquet['targetCm']): BuiltBouquet {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const s = cmToM(target.heightCm) / size.y;
  object.scale.setScalar(s);
  // dasar tepat di y = 0
  object.position.y = -box.min.y * s;
  object.updateMatrixWorld(true);
  const after = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  let triangles = 0;
  object.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const g = o.geometry as THREE.BufferGeometry;
      triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    }
  });
  // bungkus agar transform kalibrasi tidak tertimpa saat objek diposisikan scene
  const root = new THREE.Group();
  root.name = object.name;
  root.add(object);
  root.updateMatrixWorld(true);
  const parts: BuiltBouquet['parts'] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) parts.push({ geometry: o.geometry as THREE.BufferGeometry, rel: o.matrixWorld.clone() });
  });
  return {
    localBox: new THREE.Box3().setFromObject(root),
    parts,
    object: root,
    gripLocal: grip.clone().multiplyScalar(s).add(new THREE.Vector3(0, object.position.y, 0)),
    measuredCm: { heightCm: mToCm(after.y), widthCm: mToCm(after.x), depthCm: mToCm(after.z) },
    targetCm: target,
    calibrationScale: s,
    triangles,
  };
}

export function disposeBouquet(b: BuiltBouquet) {
  b.object.traverse((o) => {
    if (o instanceof THREE.Mesh) (o.geometry as THREE.BufferGeometry).dispose();
  });
}
