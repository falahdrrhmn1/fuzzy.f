'use client';

import { CameraControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { CameraPreset } from '../../state/studio';

const FOV = 32; // fov sempit = distorsi perspektif kecil

const DIRS: Record<CameraPreset, THREE.Vector3> = {
  default: new THREE.Vector3(0.45, 0.22, 1).normalize(),
  front: new THREE.Vector3(0, 0.02, 1).normalize(),
  side: new THREE.Vector3(1, 0.02, 0).normalize(),
  back: new THREE.Vector3(0, 0.05, -1).normalize(),
  top: new THREE.Vector3(0, 1, 0.02).normalize(),
};

interface Props {
  frameBox: THREE.Box3;
  ortho: boolean;
  preset: CameraPreset;
  nonce: number;
  autoRotate: boolean;
}

export function CameraRig({ frameBox, ortho, preset, nonce, autoRotate }: Props) {
  return (
    <>
      {ortho ? (
        <OrthographicCamera key="o" makeDefault near={0.01} far={60} position={[0, 1, 10]} />
      ) : (
        <PerspectiveCamera key="p" makeDefault fov={FOV} near={0.01} far={60} position={[0, 1, 4]} />
      )}
      <ActiveControls frameBox={frameBox} ortho={ortho} preset={preset} nonce={nonce} autoRotate={autoRotate} />
    </>
  );
}

/** Pasang kontrol hanya setelah kamera milik kita menjadi kamera default (bukan kamera bawaan R3F). */
function ActiveControls(props: Props) {
  const camera = useThree((s) => s.camera);
  const ours = props.ortho ? camera instanceof THREE.OrthographicCamera : camera instanceof THREE.PerspectiveCamera && camera.fov === FOV;
  if (!ours) return null;
  return <Controls key={camera.uuid} camera={camera} {...props} />;
}

function Controls({ frameBox, ortho, preset, nonce, autoRotate, camera }: Props & { camera: THREE.Camera }) {
  const ref = useRef<CameraControls>(null);
  const size = useThree((s) => s.size);
  const lastFramedH = useRef(0);
  const first = useRef(true);

  const frame = (animate: boolean) => {
    const c = ref.current;
    if (!c) return;
    const center = frameBox.getCenter(new THREE.Vector3());
    const dim = frameBox.getSize(new THREE.Vector3());
    const dir = DIRS[preset];
    // lebar terproyeksi: dari sudut miring, lebar & kedalaman ikut terlihat; + margin garis ukur
    const guide = 0.16;
    const horiz = (preset === 'default' ? Math.hypot(dim.x, dim.z) : Math.abs(dir.x) > 0.5 ? dim.z : dim.x) + guide;
    const vert = (preset === 'top' ? Math.max(dim.z, dim.x) : dim.y) + guide * 0.5;
    const aspect = size.width / Math.max(1, size.height);
    const radius = dim.length() / 2;
    // ruang terpakai overlay: toolbar mode (atas) & tombol kamera + label (bawah)
    const fv = Math.max(0.5, (size.height - 130) / size.height);
    const fh = Math.max(0.6, (size.width - 40) / size.width);
    c.minDistance = Math.max(0.15, radius * 0.25);
    c.maxDistance = radius * 8 + 1;
    if (ortho && camera instanceof THREE.OrthographicCamera) {
      const zoom = Math.min((size.height * fv) / (vert * 1.08), (size.width * fh) / (horiz * 1.12));
      const p = center.clone().add(dir.clone().multiplyScalar(radius * 4 + 2));
      void c.setLookAt(p.x, p.y, p.z, center.x, center.y, center.z, animate);
      void c.zoomTo(zoom, animate);
      c.minZoom = zoom * 0.3;
      c.maxZoom = zoom * 8;
    } else {
      const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      const dist = Math.max(vert / 2 / t / fv, horiz / 2 / (t * aspect) / fh) * 1.1 + (Math.abs(dir.x) > 0.5 ? dim.x : dim.z) / 2;
      const p = center.clone().add(dir.clone().multiplyScalar(dist));
      void c.setLookAt(p.x, p.y, p.z, center.x, center.y, center.z, animate);
    }
    lastFramedH.current = dim.y;
  };

  // preset / mode / produk berubah → framing ulang (animasi kecuali pertama kali)
  useEffect(() => {
    frame(!first.current);
    first.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ortho]);

  // tinggi scene berubah banyak (mis. tinggi avatar diubah) → framing ulang
  useEffect(() => {
    const h = frameBox.getSize(new THREE.Vector3()).y;
    if (lastFramedH.current && Math.abs(h - lastFramedH.current) / lastFramedH.current > 0.12) frame(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameBox]);

  // saat kamera berhenti, render satu frame lagi agar overlay (label ukur) memakai posisi akhir
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const onSleep = () => invalidate();
    c.addEventListener('sleep', onSleep);
    c.addEventListener('rest', onSleep);
    return () => {
      c.removeEventListener('sleep', onSleep);
      c.removeEventListener('rest', onSleep);
    };
  }, [invalidate]);

  useFrame((_, dt) => {
    if (autoRotate && ref.current) ref.current.azimuthAngle += dt * 0.35;
  });

  return (
    <CameraControls
      ref={ref}
      camera={camera as THREE.PerspectiveCamera | THREE.OrthographicCamera}
      makeDefault
      smoothTime={0.35}
      minPolarAngle={0.05}
      maxPolarAngle={Math.PI / 2 - 0.04}
      dollyToCursor
    />
  );
}
