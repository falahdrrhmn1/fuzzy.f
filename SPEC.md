# SPEC — Fuzzy Flo 3D Bouquet Visualizer (kontrak implementasi)

Ditulis oleh orkestrator (Claude). Agent pelaksana WAJIB mengikuti dokumen ini.
Bila ada konflik, SPEC menang. Jangan menghapus/memindah apa pun di `E:\fuzzy\gambar refrensi`.

## 0. Hasil audit (Phase 0, sudah dilakukan)

- Sumber: `E:\fuzzy\gambar refrensi\` = 19 JPEG screenshot katalog (709x1600, UI HP di atas/bawah,
  foto produk kira-kira baris y=380..1260) + 1 zip yang isinya duplikat 19 file yang sama.
- Foto #3 (`...1.31.10 PM.jpeg`) = logo "Fuzzy.flo bouquet", bukan produk.
- Tiap produk hanya 1 sudut (depan, agak dari atas). Photogrammetry TIDAK mungkin. Image-to-3D lokal tidak tersedia.
  Blender tidak terpasang. Keputusan: **model procedural parametrik dengan Three.js (kode TS)**,
  dibuat dari komponen reusable, diskalakan ke dimensi caption. Semua model berstatus "representatif", bukan replika.
- Ukuran berasal dari caption penjual ("Dimensi +- A x B cm"). Ditafsirkan A = tinggi, B = lebar.
  Kedalaman & panjang pegangan TIDAK diketahui → estimasi, wajib ditandai.
- Environment: Node 22.13 / npm 10.9 (E:\Software\NodeJS), Python 3.12 + Pillow, git. Tidak ada Blender/pnpm.

Urutan nomor foto = urutan nama file alfabetis (sort Python `sorted()`):

| # | file | isi |
|---|------|-----|
| 1 | `WhatsApp Image 2026-10-22 at 1.31.10 PM (1).jpeg` | pink-lily-tulip, warna pink |
| 2 | `... 1.31.10 PM (2).jpeg` | pink-lily-tulip, varian biru |
| 3 | `... 1.31.10 PM.jpeg` | LOGO (pakai sebagai logo app, crop lingkaran tengah) |
| 4 | `... 1.31.11 PM.jpeg` | sunflower-tulip |
| 5 | `... 1.31.12 PM.jpeg` | brown-lily-rose |
| 6 | `... 1.31.14 PM.jpeg` | pink-tulip-lily, pink (foto utama) |
| 7 | `... 1.31.15 PM (1).jpeg` | pink-tulip-lily, varian ungu/putih |
| 8 | `... 1.31.15 PM (2).jpeg` | pink-tulip-lily, pink sudut lain |
| 9 | `... 1.31.15 PM.jpeg` | pink-tulip-lily, pink sudut lain |
| 10 | `... 1.31.16 PM (1).jpeg` | jumbo-tulip-lights |
| 11 | `... 1.31.16 PM (2).jpeg` | garden-mix |
| 12 | `... 1.31.16 PM.jpeg` | jumbo-tulip-lights sudut lain |
| 13 | `... 1.31.17 PM (1).jpeg` | garden-mix sudut lain |
| 14 | `... 1.31.17 PM (2).jpeg` | tulip-daisy, pink |
| 15 | `... 1.31.17 PM (3).jpeg` | tulip-daisy, varian hitam (tulip putih + merah tua) |
| 16 | `... 1.31.17 PM.jpeg` | garden-mix, varian biru/pink |
| 17 | `... 1.31.18 PM (1).jpeg` | tulip-daisy gaya sama, pink-fuschia, TANPA caption |
| 18 | `... 1.31.18 PM (2).jpeg` | tulip-daisy gaya sama, lavender, TANPA caption |
| 19 | `... 1.31.18 PM.jpeg` | tulip-daisy gaya sama, biru muda, TANPA caption |

## 1. Data produk (isi persis seperti ini; jangan menambah harga/kontak)

measurementSource untuk yang punya caption: `"seller-caption"`, measurementStatus `"seller-stated-approx"`,
lastVerifiedAt `null`. Kedalaman: `depthCm` = null + `estimatedDepthCm` = round(0.75*width) dengan flag estimasi.

| id | nama tampilan | label ukuran | tinggi x lebar (cm) | foto | komposisi (dari foto, perkiraan jumlah) | wrapper/ribbon |
|---|---|---|---|---|---|---|
| pink-lily-tulip | Pink Lily & Tulip | Medium to Large | 65 x 40 | 1 (pink), varian biru: 2 | 2 lily besar pink (6 kelopak runcing, bergaris memanjang), 6 tulip pink, 3 daisy putih kecil, 3 tangkai daun "manik" hijau | kertas salmon-pink + lapisan mesh putih tipis bergelombang, pita pink |
| sunflower-tulip | Sunflower & Tulip | Medium to Large | 60 x 40 | 4 | 3 bunga matahari (kelopak kuning loop, pusat cokelat tua), 6 tulip oranye/kuning, 4 daisy putih, sprig hijau | kertas sage green + mesh putih, pita krem |
| brown-lily-rose | Rustic Lily & Tulip | Medium | 52 x 37 | 5 | 2 lily (krem, tan), 3 tulip (2 merah marun, 1 krem), daun hijau | kertas terracotta/cokelat bertekstur, pita krem |
| pink-tulip-lily | Pink Tulip & Lily | Medium | 52 x 37 | 6, 8, 9 (pink); varian ungu-putih: 7 | 2 lily (pink muda, pink), 4 tulip pink, daun | kertas pink motif kotak, pita gingham merah |
| garden-mix | Garden Mix | Large | 62 x 45 | 11, 13; varian biru-pink: 16 | 2 lily (peach, magenta), 1 lily oranye kecil, 2 gerbera pink, 3 tulip pink, 4 daisy putih, sprig hijau | mesh putih + cellophane iridescent, pita pink |
| tulip-daisy | Tulip & Daisy | Large | 60 x 40 | 14 (pink); varian hitam: 15; foto tanpa caption 17, 18, 19 sebagai varian `sizeConfirmed:false` | 12 tulip (pink & pink tua), 7 daisy putih pusat kuning, daun | kertas blush pink berlapis lebar, pita pink + mesh putih |
| jumbo-tulip-lights | Jumbo Tulip with Lights | Jumbo (lebih besar sedikit dari Large) | TIDAK ADA ANGKA | 10, 12 | 22 tangkai tulip pink/mauve (caption "di gambar isi 22 tangkai"), lampu tumbler kuning | kertas putih, pita pink |

Untuk `jumbo-tulip-lights`: `dimensions = null`, measurementStatus `"unknown"`. Model 3D boleh dibuat
untuk inspeksi bentuk, TETAPI mode perbandingan ukuran & memegang DINONAKTIFKAN dengan pesan
"Ukuran belum tersedia — tanyakan admin". Ini sekaligus contoh fallback.

Varian warna = `variants: { id, label, palette, photoIds, sizeConfirmed }[]`. Ganti varian mengubah palet warna model 3D.

## 2. Stack & aturan lingkungan

- Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind CSS v4.
- three, @react-three/fiber v9, @react-three/drei v10, zod. Dev: vitest, @playwright/test (opsional), eslint.
- TIDAK ada library state besar (pakai React state/context + `useReducer`). TIDAK ada library UI kit.
- Cache npm di E: : buat `.npmrc` proyek berisi `cache=E:\fuzzy\.npm-cache`. Jangan install global.
- `any` dilarang (kecuali ada komentar alasan).

## 3. Struktur folder

```
fuzzy-flo-3d/
  scripts/prepare-images.py     # crop UI HP dari screenshot -> public/products/<id>/<n>.jpg (+ thumb 480px), logo -> public/brand/logo.png
  public/products/...           # hasil script (salinan, sumber asli tidak disentuh)
  src/app/                      # route: / (katalog), /studio/[id] (simulator)
  src/data/schema.ts            # zod schema Product, Variant, Dimensions, Measurement
  src/data/products.ts          # data tabel §1, divalidasi zod saat load
  src/lib/units.ts              # cmToM, mToCm, formatCm
  src/lib/anthropometry.ts      # rasio segmen tubuh, BMI -> girth
  src/three/fuzz.ts             # tekstur fuzz procedural (CanvasTexture / DataTexture) + material factory (cache/reuse)
  src/three/flowers/            # tulip.ts, lily.ts, daisy.ts, sunflower.ts, gerbera.ts, rose.ts, leaf.ts, stem.ts, sprig.ts
  src/three/bouquet/            # wrapper.ts, ribbon.ts, arrange.ts, buildBouquet.ts, calibrate.ts
  src/three/avatar/             # buildAvatar.ts (rig sendi), poses.ts (standing, holding), anchors.ts
  src/three/__tests__/          # vitest: dimensi, avatar, holding
  src/components/scene/         # StudioCanvas, BouquetObject, AvatarObject, MeasurementOverlay, CameraRig, Ground, Lights
  src/components/ui/            # Header, ProductCard, ControlPanel, BottomSheet, Segmented, Slider, NumberField, ModeSwitch
  src/state/studio.ts           # reducer: productId, variantId, mode, sex, heightCm, weightKg, showGuides, ortho, autoRotate
```

Builder di `src/three/` HARUS fungsi murni Three.js (tanpa React, tanpa renderer) agar bisa diuji di Node.

## 4. Sistem skala (inti produk)

- 1 world unit = 1 meter. Ground = bidang y=0. Semua objek berdiri di y=0 (minY = 0 ± 1 mm).
- Data UI dalam cm; konversi hanya lewat `src/lib/units.ts`.
- `buildBouquet(product, variant)` membangun buket langsung pada ukuran target (parametrik dari tinggi & lebar),
  lalu `calibrate.ts` mengukur `Box3` dan menerapkan SATU skala uniform agar tinggi = heightCm/100.
  Lebar hasil dibandingkan dengan target; deviasi >5% = gagal tes. Jangan skala non-uniform.
  Simpan `measured = {heightCm, widthCm, depthCm}` dari Box3 setelah kalibrasi (ditampilkan di panel "Ukuran model 3D").
- Origin buket: titik tengah dasar (bawah pegangan) di (0,0,0). Simpan `gripPoint` (lokal) = pusat pita pengikat,
  dan `gripAxis` = sumbu tangkai.
- Avatar: `buildAvatar({sex, heightCm, weightKg})` → tinggi Box3 = heightCm/100 (±0.5%). Mengganti avatar/tinggi
  TIDAK pernah mengubah skala buket. Zoom kamera tidak mengubah apa pun selain kamera.

## 5. Komponen bunga (pipe cleaner)

Karakter kawat bulu: semua bentuk dibuat dari TABUNG (TubeGeometry atau Catmull-Rom tube) diameter ~6–8 mm yang
membentuk loop. Kelopak = loop kawat; kelopak "terisi" = beberapa loop paralel rapat (lily bergaris, tulip).
- Material: `MeshPhysicalMaterial` / `MeshStandardMaterial` roughness 0.85–1, metalness 0, `sheen` 1 dengan
  sheenColor lebih terang, normalMap/bumpMap fuzz procedural (noise berserat) yang di-repeat sepanjang tabung.
  JANGAN mengilap. Material di-cache per warna (Map key = hex) → reuse.
- Tulip: cangkir 5–6 kelopak (loop oval melengkung ke dalam), tinggi kepala ~5–6 cm. Lily: 6 kelopak runcing
  ~8–10 cm, terbuka, tiap kelopak 3–4 loop paralel, stamen putih kecil. Daisy: 8–10 loop putih kecil + pusat kuning bola
  ~1.5 cm. Sunflower: 12–16 loop kuning + cakram cokelat ~5 cm. Gerbera: 2 lapis loop tipis. Rose: spiral kawat merapat.
  Leaf: loop runcing hijau. Sprig: tangkai dengan bola-bola hijau kecil. Stem: tabung hijau.
- Parameter tiap builder: ukuran, jumlah kelopak, warna, seed (PRNG deterministik untuk variasi handmade kecil:
  rotasi/skala kelopak ±8%).
- Performa: gabungkan geometri per bunga (`mergeGeometries`) dan per material; target < 150 draw call per buket,
  < 300k segitiga. Tube radialSegments 6, tubularSegments secukupnya.

## 6. Wrapper & arrange

- `arrange.ts`: sebar kepala bunga dalam kubah elips (lebar = target width, tinggi kubah ±25% tinggi) di atas;
  tangkai menyatu ke titik ikat (grip) pada ~35% tinggi dari bawah; di bawah grip tangkai jadi bundel pegangan
  tertutup wrapper.
- `wrapper.ts`: 8–14 lembar kertas (bidang melengkung, DoubleSide, sedikit ketebalan visual) mengipas dari grip ke
  atas-luar membentuk kerucut terbuka di belakang & samping bunga, bagian depan lebih rendah. Lapisan mesh =
  material semi-transparan. Bagian bawah grip: selongsong kertas membungkus pegangan sampai dasar.
- `ribbon.ts`: simpul pita + 2 ekor di titik grip.
- Kartu ucapan opsional (bidang putih kecil).

## 7. Avatar (procedural, bebas lisensi)

- Dibangun dari Lathe/Capsule/Sphere halus, material matte netral (abu-hangat), tanpa wajah detail.
  Hirarki sendi: pelvis → spine → chest → neck → head; chest → shoulder L/R → upperArm → elbow → forearm → wrist → hand;
  pelvis → hip L/R → thigh → knee → shin → ankle → foot.
- Proporsi (fraksi tinggi H, Drillis & Contini / Winter): head+neck 0.182 (kepala 0.13), bahu-ke-bahu 0.259 (pria) /
  0.235 (wanita), panggul 0.191 (pria) / 0.20 (wanita), upper arm 0.186, forearm 0.146, hand 0.108, thigh 0.245,
  shank 0.246, ankle-ke-lantai 0.039, foot length 0.152. Tinggi bahu 0.818H, tinggi pinggul (trochanter) 0.53H.
  Simpan semua angka di `src/lib/anthropometry.ts` dengan komentar sumber.
- Berat: BMI = kg / m². girthScale = clamp(sqrt(BMI/21.5), 0.82, 1.45) untuk sumbu X/Z torso, lengan, paha
  (perut/panggul sedikit lebih besar dari faktor itu, lengan bawah lebih kecil). Tinggi TIDAK berubah.
  UI menampilkan BMI & teks: "Bentuk tubuh perkiraan dari tinggi & berat; tubuh asli bisa berbeda."
- Wanita vs pria: rasio bahu/panggul, dada, lebar pinggang berbeda; sex tidak mengubah tinggi.
- Pose: `standing` (lengan rileks di sisi) dan `holding` (lengan atas turun-maju ~20°, siku ditekuk ~70–90°,
  kedua tangan bertemu di depan perut/dada bawah). Anchor `handGrip` = Object3D di tengah kedua telapak.

## 8. Mode

- `inspect`: buket saja, kamera orbit mengelilingi buket.
- `compare` (MODE A): avatar berdiri di x=0, buket berdiri tegak di tanah di x = bahu/2 + 0.15 + width/2.
  Penyangga transparan tipis boleh. Garis ukur (tinggi & lebar buket, tinggi avatar) + label cm.
  Toggle "Tanpa distorsi perspektif" → kamera ortografis frontal. Preset: Depan, Samping, Atas, Reset.
- `hold` (MODE B): avatar pose holding; buket di-attach sehingga `gripPoint` buket = anchor `handGrip`
  (posisi world dihitung ulang tiap perubahan tinggi/berat/produk), dimiringkan 15–25° (kepala bunga menjauh dari
  dada, ke depan-atas), sumbu tangkai sejajar arah genggaman. Cek tabrakan: titik terdekat geometri buket ke
  depan torso ≥ 1 cm; bila tabrakan, geser buket maju sepanjang +Z sampai bebas dan catat di console dev.
- Mengganti produk/varian di mode apa pun tidak me-reload halaman; transisi skala-masuk singkat 250 ms (opsional).

## 9. Kamera & input

- OrbitControls (drei) dengan damping, minDistance/maxDistance dihitung dari bounding sphere scene, maxPolarAngle
  < π/2 - 0.05 (tidak menembus tanah), target = pusat Box3 scene. Reset = animasi halus ke framing awal.
- Mobile: 1 jari rotate, 2 jari pinch zoom; `touch-action: none` HANYA pada canvas.
- frameloop "demand" bila tidak auto-rotate; dpr [1, 1.75]; drei `PerformanceMonitor` menurunkan dpr bila FPS turun.
- Bayangan: ContactShadows (drei) murah, bukan shadow map penuh.
- Overlay FPS kecil saat query `?debug=1`, plus panel Box3 terukur.

## 10. UI/UX

- Bahasa UI: Indonesia. Nada: soft, handmade, warm, premium-minimal. Hindari gradient berlebih, glassmorphism, neon,
  kartu bersarang. Palet: off-white #FBF7F2, cream #F3EADF, blush #E9B8B5, muted rose #B9727A, lavender #C9C0DE,
  sage #B7C4A8, charcoal #2B2523. Font: serif display (Fraunces) + sans (DM Sans) via next/font.
- `/` Katalog: header (logo Fuzzy.flo, "Katalog", "3D Studio"), grid foto produk (thumb asli), nama, label ukuran,
  "± T x L cm", badge status ukuran ("Ukuran dari penjual (±)" / "Ukuran belum tersedia"), badge "Model 3D representatif".
  Tidak ada landing page panjang. Klik → `/studio/[id]`.
- `/studio/[id]` desktop (≥1024): canvas besar kiri (flex-1), panel kanan 360px scroll: Info produk + foto asli
  (thumbnail, klik perbesar), Varian, Ukuran (caption vs model 3D terukur, tanda estimasi), Mode (Lihat 3D /
  Bandingkan Ukuran / Lihat Saat Dipegang), Avatar (Perempuan/Laki-laki, Tinggi 140–200 cm slider+angka default 165,
  Berat 35–120 kg default 55, BMI), Tampilan (Panduan ukuran, Ortografis, Putar otomatis), preset kamera.
  Strip produk lain di bawah/atas untuk ganti produk tanpa reload (client navigation / state).
- Mobile (<1024): canvas ±60svh di atas, toolbar mode mengambang di dalam canvas (tombol ≥44px), bottom sheet
  (3 snap: ringkas/setengah/penuh, bisa ditutup, tab: Produk / Ukuran / Avatar). Tidak ada horizontal overflow,
  safe-area-inset dihormati.
- Catatan kejujuran selalu terlihat di panel Ukuran: "Model 3D adalah representasi berdasarkan foto & ukuran
  dari penjual (±). Detail bentuk, bagian belakang, dan kedalaman adalah perkiraan."
- Fallback: (a) WebGL tidak ada → foto asli + dimensi + pesan; (b) ErrorBoundary di sekitar Canvas → sama;
  (c) loading state saat chunk 3D dimuat; (d) produk tanpa dimensi → mode banding/pegang disabled + alasan.
- Studio di-load dengan `next/dynamic` (`ssr:false`) sehingga katalog tidak memuat three.js.

## 11. Tes (wajib lulus)

`npm run test` (vitest, Node):
1. Untuk setiap produk berdimensi: tinggi Box3 = heightCm/100 ± 1%; lebar ±5%; minY ≈ 0.
2. Avatar 140/165/170/200 cm, pria & wanita, berat 35/55/120: tinggi Box3 ± 0.5%; berat mengubah lebar torso
   (120kg > 55kg > 35kg) tanpa mengubah tinggi; minY ≈ 0.
3. Skenario acuan: avatar 170 cm + buket uji 45 cm (produk dummy hanya di test) → rasio tinggi 0.2647 ± 1%.
4. Hold: jarak world gripPoint buket ke anchor < 1 cm untuk tinggi 150/170/195; buket tidak menembus kotak torso.
5. Zod: data produk valid; jumbo punya dimensions null.
Plus `npm run typecheck` (tsc --noEmit), `npm run lint`, `npm run build` lulus.

## 12. Dokumentasi

README.md, ARCHITECTURE.md, ASSET_PIPELINE.md, IMPLEMENTATION_STATUS.md sesuai master prompt §21, mencerminkan
kode nyata. IMPLEMENTATION_STATUS jujur: yang belum diuji ditulis belum diuji.
