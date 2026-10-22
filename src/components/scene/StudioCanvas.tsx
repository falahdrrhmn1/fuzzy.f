'use client';

import { ContactShadows, Grid, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { canCompare } from '../../data/products';
import type { Product, Variant } from '../../data/schema';
import type { StudioState } from '../../state/studio';
import { disposeAvatar } from '../../three/avatar';
import { bouquetFromScene, buildBouquet, disposeBouquet, type BuiltBouquet } from '../../three/bouquet';
import { computeLayout } from '../../three/layout';
import { CameraRig } from './CameraRig';
import { buildGuides, GuideLines, LabelProjector } from './Measurements';

export interface SceneInfo {
  bouquetCm: { heightCm: number; widthCm: number; depthCm: number };
  avatarCm: { heightCm: number; widthCm: number; depthCm: number } | null;
  hold: { pushedForwardCm: number; penetrationCm: number } | null;
  triangles: number;
}

interface Props {
  product: Product;
  variant: Variant;
  state: StudioState;
  onInfo?: (i: SceneInfo) => void;
}

declare global {
  interface Window {
    __ffDebug?: Record<string, unknown>;
  }
}

/** Model procedural (dari resep) atau GLB (aset nyata); keduanya lewat kalibrasi yang sama. */
export default function StudioCanvas(props: Props) {
  const m = props.product.model;
  return m.kind === 'glb' ? <GlbScene {...props} url={m.url} gripFraction={m.gripFraction} /> : <ProceduralScene {...props} />;
}

function ProceduralScene(props: Props) {
  const { product, variant } = props;
  const bouquet = useMemo(() => buildBouquet(product, variant), [product, variant]);
  useEffect(() => () => disposeBouquet(bouquet), [bouquet]);
  return <SceneView {...props} bouquet={bouquet} />;
}

function GlbScene(props: Props & { url: string; gripFraction: number }) {
  // geometri GLB dimiliki cache useLoader → jangan di-dispose per buket
  const gltf = useLoader(GLTFLoader, props.url);
  const bouquet = useMemo(() => bouquetFromScene(gltf.scene, props.product, props.gripFraction), [gltf, props.product, props.gripFraction]);
  return <SceneView {...props} bouquet={bouquet} />;
}

function SceneView({ product, state, onInfo, bouquet }: Props & { bouquet: BuiltBouquet }) {
  const [dpr, setDpr] = useState(1.5);
  // slider tinggi/berat: render ulang avatar dengan prioritas rendah agar UI tetap responsif
  const heightCm = useDeferredValue(state.heightCm);
  const weightKg = useDeferredValue(state.weightKg);
  const mode = canCompare(product) ? state.mode : 'inspect';

  const layout = useMemo(
    () => computeLayout(mode, bouquet, { sex: state.sex, heightCm, weightKg }),
    [mode, bouquet, state.sex, heightCm, weightKg],
  );
  useEffect(() => () => { if (layout.avatar) disposeAvatar(layout.avatar); }, [layout]);

  useEffect(() => {
    const size = (b: THREE.Box3) => {
      const s = b.getSize(new THREE.Vector3());
      return { heightCm: s.y * 100, widthCm: s.x * 100, depthCm: s.z * 100 };
    };
    onInfo?.({
      bouquetCm: bouquet.measuredCm,
      avatarCm: layout.avatarBox ? size(layout.avatarBox) : null,
      hold: layout.holdInfo,
      triangles: bouquet.triangles,
    });
  }, [bouquet, layout, onInfo]);

  const guides = useMemo(
    () => buildGuides(layout.bouquetBox, layout.avatarBox, state.showGuides && product.dimensions !== null && mode !== 'hold', state.showGuides && mode === 'compare'),
    [layout, state.showGuides, product.dimensions, mode],
  );
  const labelNodes = useRef<(HTMLSpanElement | null)[]>([]);

  return (
    <div className="relative h-full w-full">
    <Canvas
      dpr={dpr}
      frameloop={state.autoRotate ? 'always' : 'demand'}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      className="ff-canvas"
      aria-label={`Tampilan 3D ${product.name}`}
    >
      <PerformanceMonitor onIncline={() => setDpr(1.75)} onDecline={() => setDpr(1)} flipflops={3} />
      <color attach="background" args={['#F6F0E9']} />
      <Env />
      <hemisphereLight args={['#fffaf4', '#d8c6b8', 0.7]} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
      <directionalLight position={[-3, 2, -2]} intensity={0.35} color="#f3dbe0" />
      <Placed object={bouquet.object} matrix={layout.bouquetMatrix} />
      {layout.avatar && <primitive object={layout.avatar.object} />}
      <GuideLines guides={guides} />
      <Ground box={layout.frameBox} />
      <CameraRig frameBox={layout.frameBox} ortho={state.ortho && mode === 'compare'} preset={state.camera.preset} nonce={state.camera.nonce} autoRotate={state.autoRotate} />
      {/* setelah CameraRig: useFrame berjalan sesudah kontrol kamera memperbarui posisi */}
      <LabelProjector guides={guides} nodes={labelNodes} />
      <DebugHook layout={layout} mode={mode} />
    </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {guides.map((g, i) => (
          <span key={i} ref={(el) => { labelNodes.current[i] = el; }} className="ff-dim absolute left-0 top-0" style={{ display: 'none' }} data-guide={i}>
            {g.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Objek dengan matriks dunia eksplisit (hasil hitung modul layout). */
function Placed({ object, matrix }: { object: THREE.Object3D; matrix: THREE.Matrix4 }) {
  const ref = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    matrix.decompose(g.position, g.quaternion, g.scale);
    invalidate();
  }, [matrix, invalidate]);
  return (
    <group ref={ref}>
      <primitive object={object} />
    </group>
  );
}

function Env() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.55;
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Ground({ box }: { box: THREE.Box3 }) {
  const c = box.getCenter(new THREE.Vector3());
  const span = Math.max(1.2, box.getSize(new THREE.Vector3()).length() * 1.4);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[c.x, -0.0005, c.z]} receiveShadow>
        <circleGeometry args={[span, 48]} />
        <meshStandardMaterial color="#F7EFE6" roughness={1} />
      </mesh>
      <Grid
        position={[c.x, 0.0005, c.z]}
        args={[span * 2, span * 2]}
        cellSize={0.1}
        sectionSize={0.5}
        cellColor="#e2d3c6"
        sectionColor="#d0b9ab"
        cellThickness={0.6}
        sectionThickness={1}
        fadeDistance={span * 1.6}
        fadeStrength={1.5}
      />
      <ContactShadows position={[c.x, 0.001, c.z]} scale={span * 1.4} blur={2.4} opacity={0.45} far={2.5} resolution={512} />
    </group>
  );
}

function DebugHook({ layout, mode }: { layout: ReturnType<typeof computeLayout>; mode: string }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (typeof window === 'undefined' || !new URLSearchParams(window.location.search).has('debug')) return;
    const box = (b: THREE.Box3 | null) => (b ? { min: b.min.toArray(), max: b.max.toArray() } : null);
    window.__ffDebug = {
      mode,
      camera: () => camera.position.toArray(),
      zoom: () => camera.zoom,
      bouquetBox: box(layout.bouquetBox),
      avatarBox: box(layout.avatarBox),
      hold: layout.holdInfo,
      drawCalls: () => gl.info.render.calls,
    };
  }, [layout, mode, camera, gl]);
  return null;
}
