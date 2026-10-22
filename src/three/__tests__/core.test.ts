import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { canCompare, getProduct, PRODUCTS } from '../../data/products';
import type { Product } from '../../data/schema';
import { bodyFrontZ, buildAvatar } from '../avatar';
import { bouquetFromScene, buildBouquet } from '../bouquet';
import { placeInHands } from '../hold';
import { computeLayout } from '../layout';

const box = (o: THREE.Object3D) => {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
};
const within = (v: number, target: number, tol: number) => Math.abs(v - target) / target <= tol;

describe('data produk', () => {
  it('7 produk valid; jumbo tanpa dimensi dan tidak bisa dibandingkan', () => {
    expect(PRODUCTS).toHaveLength(7);
    const j = getProduct('jumbo-tulip-lights')!;
    expect(j.dimensions).toBeNull();
    expect(j.measurement.measurementStatus).toBe('unknown');
    expect(canCompare(j)).toBe(false);
    for (const p of PRODUCTS.filter((x) => x.dimensions)) {
      expect(p.measurement.measurementSource).toBe('seller-caption');
      expect(p.measurement.lastVerifiedAt).toBeNull();
    }
  });
});

describe('kalibrasi buket', () => {
  for (const p of PRODUCTS.filter((x) => x.dimensions)) {
    it(`${p.id}: tinggi ±1%, lebar ±5%, dasar di y=0`, () => {
      const v = p.variants[0]!;
      const b = buildBouquet(p, v);
      const bb = box(b.object);
      const d = p.dimensions!;
      expect(within((bb.max.y - bb.min.y) * 100, d.heightCm, 0.01)).toBe(true);
      expect(within((bb.max.x - bb.min.x) * 100, d.widthCm, 0.05)).toBe(true);
      expect(Math.abs(bb.min.y)).toBeLessThan(0.001);
      expect(b.calibrationScale).toBeGreaterThan(0.95);
      expect(b.calibrationScale).toBeLessThan(1.05);
      expect(b.triangles).toBeLessThan(300_000);
      expect(b.object.children[0]!.children.length).toBeLessThan(20);
    });
  }
});

describe('avatar', () => {
  for (const sex of ['female', 'male'] as const) {
    for (const h of [140, 165, 170, 200]) {
      it(`${sex} ${h} cm: tinggi Box3 ±0.5%, berdiri di lantai`, () => {
        for (const pose of ['standing', 'holding'] as const) {
          const a = buildAvatar({ sex, heightCm: h, weightKg: 60, pose });
          const bb = box(a.object);
          expect(within((bb.max.y - bb.min.y) * 100, h, 0.005)).toBe(true);
          expect(Math.abs(bb.min.y)).toBeLessThan(0.001);
        }
      });
    }
  }

  it('berat mengubah lebar badan, tidak mengubah tinggi', () => {
    const w = (kg: number) => buildAvatar({ sex: 'female', heightCm: 165, weightKg: kg, pose: 'standing' });
    const [a, b, c] = [w(35), w(55), w(120)];
    const waist = (kg: number) => bodyFrontZ({ sex: 'female', heightCm: 165, weightKg: kg }, 0.6 * 1.65)!;
    expect(waist(120).z).toBeGreaterThan(waist(55).z);
    expect(waist(55).z).toBeGreaterThan(waist(35).z);
    expect(waist(120).halfWidth).toBeGreaterThan(waist(35).halfWidth);
    expect(c.measuredCm.widthCm).toBeGreaterThan(b.measuredCm.widthCm);
    expect(b.measuredCm.widthCm).toBeGreaterThan(a.measuredCm.widthCm);
    for (const x of [a, b, c]) expect(within(x.measuredCm.heightCm, 165, 0.005)).toBe(true);
  });
});

describe('skenario acuan 170 cm vs 45 cm', () => {
  it('rasio tinggi 45/170 = 0.2647 ± 1% di skala dunia yang sama', () => {
    const base = getProduct('pink-tulip-lily')!;
    const test45: Product = { ...base, id: 'test-45', dimensions: { ...base.dimensions!, heightCm: 45, widthCm: 32, estimatedDepthCm: 24 } };
    const b = buildBouquet(test45, test45.variants[0]!);
    const a = buildAvatar({ sex: 'male', heightCm: 170, weightKg: 65, pose: 'standing' });
    const hb = box(b.object).getSize(new THREE.Vector3()).y;
    const ha = box(a.object).getSize(new THREE.Vector3()).y;
    expect(within(ha, 1.7, 0.005)).toBe(true);
    expect(within(hb, 0.45, 0.01)).toBe(true);
    expect(within(hb / ha, 45 / 170, 0.01)).toBe(true);
  });
});

describe('model GLB (pengganti model representatif)', () => {
  it('scene dengan satuan/posisi sembarang dikalibrasi ke tinggi data, berdiri di lantai, terpusat', () => {
    const p = getProduct('garden-mix')!;
    // mis. ekspor Blender dalam cm, tidak terpusat
    const scene = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(40, 70, 30), new THREE.MeshStandardMaterial());
    mesh.position.set(12, 80, -5);
    scene.add(mesh);
    const b = bouquetFromScene(scene, p, 0.4);
    const bb = box(b.object);
    expect(within((bb.max.y - bb.min.y) * 100, 62, 0.001)).toBe(true);
    expect(Math.abs(bb.min.y)).toBeLessThan(1e-6);
    expect(Math.abs((bb.min.x + bb.max.x) / 2)).toBeLessThan(1e-6);
    // proporsi asli dipertahankan (skala uniform): 40/70 * 62 cm
    expect(within((bb.max.x - bb.min.x) * 100, (40 / 70) * 62, 0.001)).toBe(true);
    expect(b.gripLocal.y).toBeCloseTo(0.62 * 0.4, 6);
  });
});

describe('tata letak scene', () => {
  it('mode banding: tinggi buket tetap saat tinggi avatar berubah; keduanya di lantai; tidak bertumpuk', () => {
    const p = getProduct('tulip-daisy')!;
    const b = buildBouquet(p, p.variants[0]!);
    const hb = (l: ReturnType<typeof computeLayout>) => l.bouquetBox.max.y - l.bouquetBox.min.y;
    const l1 = computeLayout('compare', b, { sex: 'female', heightCm: 150, weightKg: 50 });
    const l2 = computeLayout('compare', b, { sex: 'male', heightCm: 195, weightKg: 90 });
    expect(hb(l1)).toBeCloseTo(0.6, 6);
    expect(hb(l2)).toBeCloseTo(0.6, 6);
    for (const l of [l1, l2]) {
      expect(Math.abs(l.bouquetBox.min.y)).toBeLessThan(0.001);
      expect(l.bouquetBox.min.x).toBeGreaterThan(l.avatarBox!.max.x);
    }
  });

  it('memasang buket di bawah induk ber-transform tidak mengubah hasil layout (regresi)', () => {
    const p = getProduct('pink-lily-tulip')!;
    const b = buildBouquet(p, p.variants[0]!);
    const body = { sex: 'female' as const, heightCm: 165, weightKg: 55 };
    const before = computeLayout('hold', b, body);
    const parent = new THREE.Group();
    parent.position.set(3, 1, -2);
    parent.add(b.object);
    parent.updateMatrixWorld(true);
    const after = computeLayout('hold', b, body);
    expect(after.bouquetBox.min.distanceTo(before.bouquetBox.min)).toBeLessThan(1e-9);
    expect(after.holdInfo!.penetrationCm).toBeCloseTo(before.holdInfo!.penetrationCm, 9);
  });
});

describe('mode memegang', () => {
  for (const h of [150, 170, 195]) {
    for (const id of ['pink-lily-tulip', 'pink-tulip-lily', 'garden-mix']) {
      it(`${id} @ ${h} cm: grip menempel tangan, tangan mencapai, tidak menembus tubuh`, () => {
        const p = getProduct(id)!;
        const body = { sex: 'female' as const, heightCm: h, weightKg: 60 };
        const b = buildBouquet(p, p.variants[0]!);
        const place = placeInHands(b, body);
        const a = buildAvatar({ ...body, pose: 'holding', grip: place.grip });
        const gripWorld = b.gripLocal.clone().applyMatrix4(place.matrix);
        expect(gripWorld.distanceTo(a.handGrip!)).toBeLessThan(0.01);
        expect(a.reached).toBe(true);
        expect(place.penetration).toBeLessThan(0.005);
        // buket tidak melayang di bawah lantai
        const bb = new THREE.Box3().setFromObject(b.object).applyMatrix4(place.matrix);
        expect(bb.min.y).toBeGreaterThan(0);
      });
    }
  }
});
