# Arsitektur

## Lapisan

```
data/products.ts  ──►  three/* (builder murni)  ──►  three/layout.ts  ──►  components/scene/* (R3F)
 (zod, cm)              meter, Box3, kalibrasi       posisi per mode        render, kamera, label
                                                                             ▲
state/studio.ts (reducer) ── components/Studio.tsx + ui/ControlPanel.tsx ───┘
```

- **Data** (`src/data`) disimpan dalam cm dan divalidasi zod saat modul dimuat. Data yang tidak valid gagal di
  build dan test.
- **Builder 3D** (`src/three`) adalah fungsi three.js murni tanpa React dan renderer, sehingga semua logika
  ukuran diuji di Node (`src/three/__tests__/core.test.ts`).
- **Layout** (`three/layout.ts`) menentukan posisi buket dan avatar per mode dari Box3. UI tidak pernah
  menghitung skala.
- **Scene** (`components/scene`) hanya merender hasil layout.

## State

`useReducer` di `Studio.tsx`, tanpa library state. Isinya: produk, varian, mode, jenis kelamin, tinggi, berat,
garis ukur, ortografis, putar otomatis, dan preset kamera (dengan *nonce*, supaya klik ulang tetap memicu
animasi). Tinggi dan berat di-*clamp* ke rentangnya. Produk tanpa ukuran memaksa mode `inspect`.

Saat produk diganti, URL diperbarui lewat `history.replaceState` (`/studio/<id>`, query dipertahankan). Kanvas
tidak dimuat ulang.

## Sistem koordinat dan skala

- 1 unit = 1 meter, +Y ke atas, lantai di y = 0, depan objek menghadap +Z.
- Konversi cm↔m hanya lewat `lib/units.ts`.
- **Buket**: `buildBouquet` membangun buket langsung pada ukuran target. `calibrate()` lalu mengukur Box3 dan
  menerapkan **satu skala uniform** supaya tinggi Box3 sama dengan tinggi data. Hasilnya diletakkan dengan
  dasar di y = 0. Lebar dibiarkan mengikuti bentuk dan diuji ±5% dari data. Skala non-uniform tidak pernah
  dipakai. Hasil ukur Box3 (`measuredCm`) ditampilkan di panel "Model 3D terukur" dan dipakai sebagai label
  garis ukur.
- **Avatar**: proporsi segmen sebagai fraksi tinggi badan H (Drillis & Contini, `lib/anthropometry.ts`). Puncak
  rambut tepat di H dan telapak di y = 0, jadi tinggi Box3 = tinggi input (diuji ±0,5% untuk 140–200 cm).
- **Berat**: BMI → `girthScale = clamp(√(BMI/21,5), 0,82, 1,45)`. Faktor ini hanya mengubah lebar dan kedalaman
  torso dan anggota badan (perut sedikit lebih besar), bukan tinggi. Ini pendekatan visual, dan UI menyatakannya.
- Mengganti avatar, tinggi, berat, atau zoom kamera tidak pernah mengubah transform buket (diuji di unit test
  dan e2e).

## Mode

| Mode | Penempatan |
|---|---|
| `inspect` | Buket di origin. |
| `compare` | Avatar berdiri di x = 0. Buket berdiri di lantai, 15 cm di kanan Box3 avatar (kanan layar). Garis ukur: tinggi & lebar buket, tinggi avatar. |
| `hold` | `placeInHands()`: titik genggam default di depan perut (0,6 H, permukaan perut + 0,075 H). Buket dimiringkan 0,3 rad (kepala bunga menjauh dari dada), lalu verteks buket diuji terhadap profil depan tubuh. Bila menembus, titik genggam didorong maju sampai jarak ≥1 cm (maks. 0,12 H). Avatar dibangun dengan IK dua tulang analitis ke titik genggam akhir. Tangan kanan di atas, kiri di bawah. |

## Kamera

`CameraRig`: kamera perspektif fov 32° (fov sempit = distorsi kecil) atau ortografis (mode Bandingkan).
`CameraControls` (camera-controls) di-*bind* eksplisit ke kamera aktif dengan batasan berikut:
- polar angle maksimal di bawah horizon, jadi kamera tidak menembus lantai;
- min/max distance dari radius scene.

Framing dihitung dari Box3 scene, aspect, dan area yang tertutup toolbar. Preset: Depan, Samping, Belakang,
Atas, Reset. Framing ulang terjadi saat mode, produk, atau preset berganti, atau bila tinggi scene berubah >12%.

## Label ukur

Garisnya objek three (`Line`). Labelnya `<span>` DOM di luar kanvas yang diproyeksikan setiap frame
(`LabelProjector`). drei `<Html>` sengaja tidak dipakai karena melempar `removeChild` saat unmount di React 19.
Proyektor ditempatkan setelah `CameraRig` agar memakai posisi kamera terbaru, dan kontrol memicu satu frame lagi
saat berhenti (`sleep`/`rest`).

## Pemuatan aset dan performa

- three.js (≈170 KB gzip) hanya dimuat di halaman studio lewat `next/dynamic` (`ssr:false`). First load JS
  katalog 112 kB.
- Geometri digabung **per material** (`PartBag` → `mergeGeometries`), jadi 7–20 mesh per buket.
  Draw call terukur 9–24 per scene, termasuk lantai dan bayangan.
- Material di-cache per (jenis, warna) dan dipakai bersama antar buket. Tekstur fuzz adalah `DataTexture`
  64×64 procedural, aman di Node.
- `frameloop="demand"`: frame hanya dirender saat kamera bergerak atau state berubah. Mode putar otomatis
  memakai loop terus-menerus.
- `dpr` 1,5, naik ke 1,75 atau turun ke 1 lewat `PerformanceMonitor`. Bayangan memakai `ContactShadows`
  (tanpa shadow map penuh).
- Saat produk atau avatar berganti, geometri lama di-dispose (`disposeBouquet`/`disposeAvatar`). Heap terukur
  stabil di 23–25 MB setelah 16 kali ganti produk.
- Model GLB dimuat lewat `useLoader(GLTFLoader)` di dalam `<Suspense>`. Geometrinya milik cache loader, jadi
  tidak di-dispose per buket.

## Fallback

- Tanpa WebGL: foto asli + ukuran + pesan.
- Error render: `SceneErrorBoundary`, dengan fallback yang sama. Boundary di-reset saat produk diganti.
- Saat memuat: `CanvasLoading`.
- Produk tanpa ukuran: mode banding/pegang dinonaktifkan beserta alasannya.
- ID produk salah: 404 (`notFound()`).
