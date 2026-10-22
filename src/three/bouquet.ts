import * as THREE from 'three';
import { buildSizeCm } from '../data/products';
import type { FlowerType, Product, Variant } from '../data/schema';
import { cmToM, mToCm } from '../lib/units';
import { addFlower, addLeaf, addSprig, addStem, DETAIL_HIGH, DETAIL_STANDARD, HEAD_DEPTH, HEAD_RADIUS, type Detail } from './flowers';
import { ellipsoid, frame, jitter, PartBag, rng, shade, surface } from './geom';

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

export type Quality = 'standard' | 'high';
export const GRIP_FRACTION = 0.36;

interface Head {
  type: FlowerType;
  color: string;
  scale: number;
}

const colorOf = (v: Variant, key: string, fallback: string) => v.palette[key] ?? fallback;
const mix = (a: string, b: string, t: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;

export function buildBouquet(product: Product, variant: Variant, opts: { quality?: Quality; seed?: number } = {}): BuiltBouquet {
  const high = opts.quality === 'high';
  const d: Detail = high ? DETAIL_HIGH : DETAIL_STANDARD;
  const target = buildSizeCm(product);
  const H = cmToM(target.heightCm);
  const W = cmToM(target.widthCm);
  const D = cmToM(target.depthCm);
  const r = rng((opts.seed ?? 1) * 9973 + product.id.length);
  const bag = new PartBag(high ? 2 : 0);
  const recipe = product.recipe;
  const gripY = H * GRIP_FRACTION;
  const grip = new THREE.Vector3(0, gripY, 0);
  const stemC = colorOf(variant, 'stem', '#6E9B4E');
  const leafC = colorOf(variant, 'leaf', '#86B35A');

  // ---- kepala bunga pada "wajah" buket yang menghadap depan-atas (seperti difoto dari depan) ----
  const heads: Head[] = [];
  for (const f of recipe.flowers) for (let i = 0; i < f.count; i++) heads.push({ type: f.type, color: colorOf(variant, f.color, '#E9B8B5'), scale: f.scale ?? 1 });
  heads.sort((a, b) => HEAD_RADIUS[b.type] * b.scale - HEAD_RADIUS[a.type] * a.scale);
  const big = heads.filter((h) => HEAD_RADIUS[h.type] >= 0.05);
  const small = heads.filter((h) => HEAD_RADIUS[h.type] < 0.05);
  for (let i = small.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [small[i], small[j]] = [small[j]!, small[i]!];
  }
  const order = [...big, ...small];
  const n = order.length;
  const area = order.reduce((s, h) => s + Math.PI * (HEAD_RADIUS[h.type] * h.scale) ** 2, 0);
  const R = THREE.MathUtils.clamp(Math.sqrt(area / Math.PI) * 0.95, 0.14 * W, 0.36 * W);
  const C = new THREE.Vector3(0, 0.72 * H, 0.2 * D);
  const n0 = new THREE.Vector3(0, 0.8, 0.6).normalize();
  const e1 = new THREE.Vector3(1, 0, 0);
  const e2 = new THREE.Vector3().crossVectors(n0, e1); // dalam bidang wajah, ke atas-belakang
  const golden = Math.PI * (3 - Math.sqrt(5));
  const deepest = Math.max(...order.map((h) => HEAD_DEPTH[h.type] * h.scale));
  order.forEach((h, i) => {
    const rad = Math.sqrt((i + 0.5) / n);
    const ang = i * golden + 0.5;
    const x = Math.sin(ang) * rad * R + jitter(r, 0.004);
    const y = Math.cos(ang) * rad * R * 0.9 + jitter(r, 0.004);
    const p = C.clone().addScaledVector(e1, x).addScaledVector(e2, y).addScaledVector(n0, -(x * x + y * y) / (R * 2.2));
    const dir = n0.clone().addScaledVector(e1, (x / R) * 0.55).addScaledVector(e2, (y / R) * 0.5).normalize();
    // bunga pendek (daisy, gerbera) diselipkan lebih maju agar tidak tenggelam di antara tulip
    p.addScaledVector(dir, (deepest - HEAD_DEPTH[h.type] * h.scale) * 0.75);
    const c = { petal: h.color, center: colorOf(variant, h.type === 'sunflower' ? 'disk' : 'center', h.type === 'lily' ? '#F5EBD8' : '#F2C94C') };
    addFlower(bag, h.type, frame(p, dir, r() * Math.PI * 2), c, r, h.scale, d);
    const off = new THREE.Vector3(Math.cos(i * 2.4) * 0.01, 0, Math.sin(i * 2.4) * 0.008);
    addStem(bag, p, dir, grip.clone().add(off), 0.02, stemC, d);
  });

  // daun & sprig di tepi wajah buket, mengarah keluar
  const rim = (a: number, k: number) => C.clone().addScaledVector(e1, Math.cos(a) * R * k).addScaledVector(e2, Math.sin(a) * R * k * 0.9).addScaledVector(n0, -0.02);
  for (let i = 0; i < recipe.leaves; i++) {
    const a = (i / Math.max(1, recipe.leaves)) * Math.PI * 2 + 0.6;
    const out = e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a)).addScaledVector(n0, 0.7).normalize();
    addLeaf(bag, frame(rim(a, 0.8), out, a), leafC, r, d);
  }
  for (let i = 0; i < recipe.sprigs; i++) {
    const a = (i / Math.max(1, recipe.sprigs)) * Math.PI * 2 + 1.3;
    const out = e1.clone().multiplyScalar(Math.cos(a) * 0.8).addScaledVector(e2, Math.sin(a) + 0.4).addScaledVector(n0, 0.5).normalize();
    addSprig(bag, frame(rim(a, 0.7), out), leafC, r, d);
  }

  // ---- kertas pembungkus: lembar persegi mengipas dua lapis; lebar dirancang agar pas W ----
  const wrapC = colorOf(variant, 'wrapper', '#F3EADF');
  const wrap2 = colorOf(variant, 'wrapper2', mix(wrapC, '#ffffff', 0.55));
  const pattern = recipe.wrapperPattern;
  const r0 = W * 0.065;
  const N = recipe.wrapperSheets;
  const sheetSeeds = Array.from({ length: N * 2 }, () => [jitter(r, 0.09), jitter(r, 1), jitter(r, 0.05)] as const);
  const sheets = (a: number) => {
    const out: { geom: THREE.BufferGeometry; inner: boolean }[] = [];
    const make = (j: number, inner: boolean) => {
      const [tj, cj, hj] = sheetSeeds[j + (inner ? N : 0)]!;
      const theta = ((j + (inner ? 0.5 : 0)) / N) * Math.PI * 2 + tj;
      const back = (1 - Math.cos(theta)) / 2; // 0 depan, 1 belakang
      const front = Math.abs(Math.sin(theta)) < 0.94 && Math.cos(theta) > 0.3;
      const topY = gripY + (H - gripY) * (0.36 + 0.64 * back ** 0.85) * (inner ? 0.95 : 1) * (1 - Math.abs(hj));
      const Rt = (W / 2) * a * (inner ? 0.88 : 1);
      const base = new THREE.Vector3(Math.sin(theta) * r0 * (inner ? 0.8 : 1), gripY, Math.cos(theta) * r0 * (D / W));
      const top = new THREE.Vector3(Math.sin(theta) * Rt, topY, Math.cos(theta) * Rt * (D / W));
      const dv = new THREE.Vector3().subVectors(top, base);
      const L = dv.length();
      const t = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));
      const radial = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));
      const nOut = new THREE.Vector3().crossVectors(t, dv).normalize();
      if (nOut.dot(radial) < 0) nOut.negate();
      const wt = ((2 * Math.PI * Rt) / N) * (inner ? 1.2 : 1.32);
      const wb = ((2 * Math.PI * r0) / N) * 1.6;
      const flare = front ? 0.16 : 0.08;
      const g = surface((u, v, o) => {
        const s = u * 2 - 1;
        const hw = (wb + (wt - wb) * v ** 0.85) / 2;
        o.copy(base)
          .addScaledVector(dv, v + 0.05 * cj * s * v ** 3)
          .addScaledVector(t, s * hw)
          .addScaledVector(nOut, -0.3 * s * s * hw * v + flare * L * v * v);
      }, high ? 10 : 6, high ? 12 : 8);
      shade(g, (_u, v) => 0.86 + 0.14 * v);
      out.push({ geom: g, inner });
    };
    for (let j = 0; j < N; j++) make(j, false);
    for (let j = 0; j < N - 1; j++) make(j, true);
    return out;
  };
  // dua iterasi: ukur sudut terluar lembar, lalu sesuaikan radius agar lebar total = W
  let a = 0.9;
  let built = sheets(a);
  for (let it = 0; it < 2; it++) {
    let maxX = 0;
    for (const s of built) {
      const p = s.geom.getAttribute('position');
      for (let i = 0; i < p.count; i++) maxX = Math.max(maxX, Math.abs(p.getX(i)));
    }
    a *= W / 2 / maxX;
    built.forEach((s) => s.geom.dispose());
    built = sheets(a);
  }
  for (const s of built) bag.add(s.inner ? { kind: 'paper', color: wrap2 } : { kind: 'paper', color: wrapC, pattern }, s.geom);

  // mangkuk kertas dalam di bawah wajah bunga → tangkai tidak terlihat telanjang (seperti tisu di foto)
  const bowlTop = C.y - R * 0.95;
  bag.add({ kind: 'paper', color: wrapC, pattern }, shade(surface((u, v, o) => {
    const phi = u * Math.PI * 2;
    const rad = (r0 * 0.9 + (R * 0.85 - r0 * 0.9) * v ** 0.7) * (1 + 0.04 * Math.sin(phi * 9) * v);
    o.set(Math.sin(phi) * rad, gripY + (bowlTop - gripY) * v, C.z * v * 0.5 + Math.cos(phi) * rad * 0.7);
  }, high ? 48 : 28, high ? 8 : 5), (_u, v) => 0.8 + 0.2 * v));

  if (recipe.heartSticker) {
    const hs = new THREE.Shape();
    hs.moveTo(0, -0.5);
    hs.bezierCurveTo(-0.9, 0.1, -0.5, 0.9, 0, 0.45);
    hs.bezierCurveTo(0.5, 0.9, 0.9, 0.1, 0, -0.5);
    const heart = new THREE.ShapeGeometry(hs, 8);
    const k = 0.032;
    const pos = new THREE.Vector3(-W * 0.17, H * 0.9, -D * 0.24);
    heart.applyMatrix4(new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0.25, 0.08)), new THREE.Vector3(k, k, k)));
    bag.add({ kind: 'ribbon', color: '#E8607F' }, heart);
  }

  // ---- selongsong pegangan berlipit di bawah titik ikat ----
  const ez = D / W + (1 - D / W) * 0.6;
  bag.add(
    { kind: 'paper', color: wrapC, pattern },
    shade(
      surface((u, v, o) => {
        const phi = u * Math.PI * 2;
        const rad = W * (0.2 - 0.108 * v ** 0.9) * (1 + 0.055 * Math.sin(phi * 7 + 0.4) * (1 - v * 0.6));
        o.set(Math.sin(phi) * rad, gripY * v, Math.cos(phi) * rad * ez);
      }, high ? 72 : 40, high ? 8 : 5),
      (_u, v) => 0.82 + 0.18 * v,
    ),
  );

  if (recipe.meshLayer) {
    const meshC = colorOf(variant, 'mesh', '#FFFFFF');
    // rok tulle bergelombang di atas pita
    bag.add({ kind: 'mesh', color: meshC }, surface((u, v, o) => {
      const phi = u * Math.PI * 2;
      const rad = (r0 * 1.25 + W * 0.3 * v ** 0.8) * (1 + 0.09 * Math.sin(phi * 13) * v);
      o.set(Math.sin(phi) * rad, gripY - 0.01 + H * 0.17 * v ** 0.9, Math.cos(phi) * rad * (D / W) * 1.05);
    }, high ? 96 : 52, 6));
  }
  if (recipe.cellophane) {
    const celC = colorOf(variant, 'cello', '#DDEBF2');
    for (let j = 0; j < 3; j++) {
      const theta = Math.PI + (j - 1) * 0.8;
      bag.add({ kind: 'cello', color: celC }, surface((u, v, o) => {
        const ang = theta + (u * 2 - 1) * 0.45;
        const rad = (r0 + (W / 2 * 0.92 - r0) * v ** 0.7) * 1.02;
        o.set(Math.sin(ang) * rad, gripY + (H * 0.97 - gripY) * v, Math.cos(ang) * rad * (D / W));
      }, 8, 10));
    }
  }

  // ---- pita: lingkar, simpul besar (2 loop), 2 ekor panjang ----
  const ribC = colorOf(variant, 'ribbon', '#E9B8B5');
  const rib = { kind: 'ribbon' as const, color: ribC, pattern: recipe.ribbonPattern };
  const kk = W / 0.4;
  const rw = 0.028 * kk;
  const rb = r0 * 1.12;
  bag.add(rib, surface((u, v, o) => {
    const phi = u * Math.PI * 2;
    o.set(Math.sin(phi) * rb, gripY + (v - 0.5) * rw, Math.cos(phi) * rb * ez);
  }, 32, 1));
  const K = new THREE.Vector3(0, gripY, rb * ez + 0.006);
  const strip = (pts: THREE.Vector3[], across: THREE.Vector3, closed: boolean) => {
    const curve = new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
    const ax = across.clone().normalize();
    return surface((u, v, o) => o.copy(curve.getPointAt(v)).addScaledVector(ax, (u - 0.5) * rw), 1, 28);
  };
  const tailLen = Math.min(0.2 * kk, gripY * 0.85);
  for (const s of [-1, 1]) {
    bag.add(rib, strip([K.clone(), K.clone().add(new THREE.Vector3(s * 0.04 * kk, 0.032 * kk, 0.014)), K.clone().add(new THREE.Vector3(s * 0.09 * kk, 0.012 * kk, 0.02)), K.clone().add(new THREE.Vector3(s * 0.058 * kk, -0.028 * kk, 0.014))], new THREE.Vector3(0.15 * s, 0.3, 1), true));
    bag.add(rib, strip([K.clone(), K.clone().add(new THREE.Vector3(s * 0.018 * kk, -tailLen * 0.35, 0.016)), K.clone().add(new THREE.Vector3(s * 0.04 * kk, -tailLen * 0.7, 0.012)), K.clone().add(new THREE.Vector3(s * 0.05 * kk, -tailLen, 0.02))], new THREE.Vector3(1, 0, 0.25 * s), false));
  }
  bag.add(rib, ellipsoid(K, 0.012 * kk, 0.011 * kk, 0.009 * kk, undefined, 12, 8));

  if (recipe.fairyLights) {
    const glow = { kind: 'glow' as const, color: colorOf(variant, 'light', '#FFD27A') };
    for (let i = 0; i < 26; i++) {
      const a2 = r() * Math.PI * 2;
      const rr = Math.sqrt(r()) * R;
      const p = C.clone().addScaledVector(e1, Math.cos(a2) * rr).addScaledVector(e2, Math.sin(a2) * rr * 0.9).addScaledVector(n0, 0.01 + r() * 0.02);
      bag.add(glow, ellipsoid(p, 0.0055, 0.0055, 0.0055, undefined, 8, 6));
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
