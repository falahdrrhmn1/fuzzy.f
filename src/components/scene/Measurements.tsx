'use client';

import { Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, type RefObject } from 'react';
import * as THREE from 'three';

/** Satu garis ukur. Nilai label diambil dari Box3 objek di dunia, bukan dari data mentah. */
export interface Guide {
  a: THREE.Vector3;
  b: THREE.Vector3;
  tick: THREE.Vector3;
  label: string;
  visible: boolean;
}

const cm = (m: number) => `${Math.round(m * 100)} cm`;

export function buildGuides(bouquetBox: THREE.Box3, avatarBox: THREE.Box3 | null, showBouquet: boolean, showAvatar: boolean): Guide[] {
  const b = bouquetBox;
  const zf = b.max.z + 0.01;
  const a = avatarBox ?? new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
  return [
    { a: new THREE.Vector3(b.max.x + 0.06, 0, zf), b: new THREE.Vector3(b.max.x + 0.06, b.max.y, zf), tick: new THREE.Vector3(0.025, 0, 0), label: `T ${cm(b.max.y - b.min.y)}`, visible: showBouquet },
    { a: new THREE.Vector3(b.min.x, b.max.y + 0.05, zf), b: new THREE.Vector3(b.max.x, b.max.y + 0.05, zf), tick: new THREE.Vector3(0, 0.02, 0), label: `L ${cm(b.max.x - b.min.x)}`, visible: showBouquet },
    { a: new THREE.Vector3(a.min.x - 0.08, 0, 0), b: new THREE.Vector3(a.min.x - 0.08, a.max.y, 0), tick: new THREE.Vector3(0.03, 0, 0), label: cm(a.max.y - a.min.y), visible: showAvatar && avatarBox !== null },
  ];
}

export function GuideLines({ guides }: { guides: Guide[] }) {
  return (
    <group>
      {guides.map((g, i) => (
        <group key={i} visible={g.visible}>
          <Line points={[g.a, g.b]} color="#7a5a5e" lineWidth={1.5} />
          <Line points={[g.a.clone().sub(g.tick), g.a.clone().add(g.tick)]} color="#7a5a5e" lineWidth={1.5} />
          <Line points={[g.b.clone().sub(g.tick), g.b.clone().add(g.tick)]} color="#7a5a5e" lineWidth={1.5} />
        </group>
      ))}
    </group>
  );
}

/** Proyeksikan titik tengah tiap garis ke layar dan geser label DOM (di luar Canvas) setiap frame. */
export function LabelProjector({ guides, nodes }: { guides: Guide[]; nodes: RefObject<(HTMLSpanElement | null)[]> }) {
  const get = useThree((s) => s.get);
  const project = (camera: THREE.Camera, size: { width: number; height: number }) => {
    const v = new THREE.Vector3();
    guides.forEach((g, i) => {
      const el = nodes.current?.[i];
      if (!el) return;
      v.addVectors(g.a, g.b).multiplyScalar(0.5).project(camera);
      const onScreen = g.visible && v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      el.style.display = onScreen ? 'block' : 'none';
      if (onScreen) el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`;
    });
  };
  useFrame(({ camera, size }) => project(camera, size));
  // frameloop "demand" bisa berhenti tepat setelah kamera melompat → proyeksikan ulang setelah frame berikutnya
  useEffect(() => {
    get().invalidate();
    const id = requestAnimationFrame(() => {
      const s = get();
      project(s.camera, s.size);
    });
    return () => cancelAnimationFrame(id);
  });
  return null;
}
