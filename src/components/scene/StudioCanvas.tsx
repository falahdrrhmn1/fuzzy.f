'use client';

import { ContactShadows, Grid, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { lazy, Suspense, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

// efek pasca-proses (AO, bloom) hanya diunduh saat mode Bagus dipakai
const HighEffects = lazy(() => import('./HighEffects'));

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
  const quality = props.state.quality;
  const bouquet = useMemo(() => buildBouquet(product, variant, { quality }), [product, variant, quality]);
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
    () => computeLayout(mode, bouquet, { sex: state.sex, heightCm, weightKg, quality: state.quality }),
    [mode, bouquet, state.sex, heightCm, weightKg, state.quality],
  );
  const high = state.quality === 'high';
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
    {/* key: ganti kualitas = renderer baru (shadow map & shader harus dikompilasi ulang) */}
    <Canvas
      key={state.quality}
      dpr={dpr}
      shadows={high ? 'soft' : false}
      frameloop={state.autoRotate ? 'always' : 'demand'}
      gl={{ antialias: !high, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      onCreated={({ gl }) => {
        // Neutral tone mapping menjaga warna pastel kertas & bulu tetap seperti foto
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = high ? 1.05 : 1;
      }}
      className="ff-canvas"
      aria-label={`Tampilan 3D ${product.name}`}
    >
      <PerformanceMonitor onIncline={() => setDpr(high ? 2 : 1.6)} onDecline={() => setDpr(1)} flipflops={3} />
      <Env intensity={high ? 0.75 : 0.6} />
      <Lights box={layout.frameBox} shadows={high} />
      <Placed object={bouquet.object} matrix={layout.bouquetMatrix} shadows={high} />
      {layout.avatar && <Placed object={layout.avatar.object} matrix={IDENTITY} shadows={high} />}
      <GuideLines guides={guides} />
      <Ground box={layout.frameBox} grid={mode !== 'inspect'} shadows={high} />
      {high && (
        <Suspense fallback={null}>
          <HighEffects />
        </Suspense>
      )}
      <CameraRig frameBox={layout.frameBox} ortho={state.ortho && mode === 'compare'} preset={state.camera.preset} nonce={state.camera.nonce} autoRotate={state.autoRotate} />
      {/* setelah CameraRig: useFrame berjalan sesudah kontrol kamera memperbarui posisi */}
      <LabelProjector guides={guides} nodes={labelNodes} />
      <DebugHook layout={layout} mode={mode} quality={state.quality} />
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

const IDENTITY = new THREE.Matrix4();
const NO_SHADOW = new Set(['mesh', 'cello', 'glow']);

/** Objek dengan matriks dunia eksplisit (hasil hitung modul layout). */
function Placed({ object, matrix, shadows }: { object: THREE.Object3D; matrix: THREE.Matrix4; shadows: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    matrix.decompose(g.position, g.quaternion, g.scale);
    invalidate();
  }, [matrix, invalidate]);
  useLayoutEffect(() => {
    object.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const on = shadows && !NO_SHADOW.has(o.userData.kind as string);
      o.castShadow = on;
      o.receiveShadow = on;
    });
    invalidate();
  }, [object, shadows, invalidate]);
  return (
    <group ref={ref}>
      <primitive object={object} />
    </group>
  );
}

function Env({ intensity }: { intensity: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, intensity]);
  return null;
}

/**
 * Pencahayaan studio foto produk: key light hangat dari depan-kiri atas (satu-satunya yang membuat
 * bayangan di mode Bagus), fill dingin dari kanan, rim dari belakang agar siluet bulu terbaca.
 */
function Lights({ box, shadows }: { box: THREE.Box3; shadows: boolean }) {
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z) * 0.75 + 0.2;
  const key = useRef<THREE.DirectionalLight>(null);
  useLayoutEffect(() => {
    const l = key.current;
    if (!l) return;
    l.target.position.copy(c);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.left = cam.bottom = -span;
    cam.right = cam.top = span;
    cam.near = 0.1;
    cam.far = 12;
    cam.updateProjectionMatrix();
  });
  return (
    <>
      <hemisphereLight args={['#fff8f2', '#d9c5b6', 0.55]} />
      <directionalLight
        ref={key}
        position={[c.x - 1.6, c.y + 3.2, c.z + 2.8]}
        intensity={2.1}
        color="#fff3e6"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.015}
        shadow-radius={6}
      />
      <directionalLight position={[c.x + 2.5, c.y + 1.2, c.z + 1.5]} intensity={0.55} color="#e9eefc" />
      <directionalLight position={[c.x + 0.5, c.y + 2, c.z - 3]} intensity={0.9} color="#ffe6ec" />
    </>
  );
}

function Ground({ box, grid, shadows }: { box: THREE.Box3; grid: boolean; shadows: boolean }) {
  const c = box.getCenter(new THREE.Vector3());
  const span = Math.max(1.2, box.getSize(new THREE.Vector3()).length() * 1.4);
  return (
    <group>
      {/* lantai transparan yang hanya menerima bayangan; latar belakang = gradasi CSS */}
      {shadows && (
        <mesh rotation-x={-Math.PI / 2} position={[c.x, 0, c.z]} receiveShadow>
          <circleGeometry args={[span, 48]} />
          <shadowMaterial transparent opacity={0.16} />
        </mesh>
      )}
      <Grid
        visible={grid}
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
      <ContactShadows position={[c.x, 0.001, c.z]} scale={span * 1.4} blur={2.2} opacity={0.5} far={2} resolution={shadows ? 1024 : 512} color="#5b4638" />
    </group>
  );
}

function DebugHook({ layout, mode, quality }: { layout: ReturnType<typeof computeLayout>; mode: string; quality: string }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (typeof window === 'undefined' || !new URLSearchParams(window.location.search).has('debug')) return;
    const box = (b: THREE.Box3 | null) => (b ? { min: b.min.toArray(), max: b.max.toArray() } : null);
    window.__ffDebug = {
      mode,
      quality,
      camera: () => camera.position.toArray(),
      zoom: () => camera.zoom,
      bouquetBox: box(layout.bouquetBox),
      avatarBox: box(layout.avatarBox),
      hold: layout.holdInfo,
      drawCalls: () => gl.info.render.calls,
    };
  }, [layout, mode, quality, camera, gl]);
  return null;
}
