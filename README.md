# Fuzzy Flo — 3D Bouquet Visualizer

Simulator web untuk buket bunga kawat bulu (pipe cleaner) Fuzzy Flo. Pembeli bisa memutar model 3D buket,
lalu membandingkan ukurannya dengan avatar manusia yang tinggi dan beratnya bisa diatur. Perbandingan bisa
berdiri berdampingan atau saat buket dipegang. Semua objek memakai satu sistem skala: **1 unit = 1 meter**.

> Model 3D saat ini **representatif**: dibangun secara procedural dari foto katalog dan ukuran caption penjual
> (±), bukan hasil pemindaian. Lihat `IMPLEMENTATION_STATUS.md`.

## Teknologi

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · three.js 0.169 ·
@react-three/fiber 9 · @react-three/drei 10 · zod · Vitest · Playwright (Python) untuk uji browser.

## Menjalankan

```bash
cd E:\fuzzy\fuzzy-flo-3d
npm install            # cache npm diarahkan ke E:\fuzzy\.npm-cache lewat .npmrc
npm run dev            # http://localhost:3000
```

Produksi:

```bash
npm run build
npm start              # http://localhost:3100
```

Agar bisa dibuka dari HP di jaringan Wi-Fi yang sama, jalankan `npx next start -p 3100 -H 0.0.0.0`, lalu buka
`http://<IP-laptop>:3100` di HP. Windows Firewall mungkin meminta izin sekali.

## Verifikasi

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint src
npm run test           # vitest: kalibrasi ukuran, avatar, mode pegang, layout, GLB
npm run e2e            # butuh server di :3100 + Python Playwright (Chromium)
npm run verify         # typecheck + lint + test + build
```

`npm run e2e` menyimpan screenshot ke `e2e/screenshots/`.

## Struktur

```
src/
  app/                    layout, katalog (/), studio (/studio/[id])
  components/
    Studio.tsx            state studio, toolbar mode & kamera, fallback
    scene/                StudioCanvas (R3F), CameraRig, Measurements (garis + label ukur)
    ui/                   Header, ControlPanel (panel desktop / bottom sheet mobile), Fallbacks
  data/                   schema.ts (zod), products.ts (data produk tervalidasi)
  lib/                    units (cm↔m), anthropometry (proporsi tubuh), webgl
  state/studio.ts         reducer state studio
  three/                  builder 3D murni (tanpa React, bisa diuji di Node)
    materials.ts          material kawat bulu/kertas/mesh (cache, reuse)
    geom.ts               tabung kawat, loop kelopak, loft, merge per material
    flowers.ts            tulip, lily, daisy, sunflower, gerbera, rose, daun, sprig, tangkai
    bouquet.ts            perakitan buket + kalibrasi + impor GLB
    avatar.ts             avatar procedural + IK lengan
    hold.ts               penempatan buket di tangan + cek tabrakan
    layout.ts             posisi objek per mode
scripts/prepare-images.py crop screenshot katalog → public/products
e2e/smoke.py              uji browser (desktop, mobile, sentuh, ukuran, fallback)
public/products/<id>/     foto produk (salinan, sumber asli tidak diubah)
```

## Cara memakai simulator

1. Di **Katalog**, pilih buket.
2. **Lihat 3D**: seret untuk memutar, scroll atau cubit untuk zoom, klik kanan atau dua jari untuk menggeser.
   Gunakan tombol Depan, Samping, Belakang, Atas, atau Reset.
3. **Bandingkan Ukuran**: avatar berdiri di samping buket, di lantai yang sama. Atur jenis kelamin, tinggi
   (140–200 cm), dan berat (35–120 kg) di panel Avatar. Opsi "Tanpa distorsi perspektif" menampilkan
   kamera ortografis.
4. **Lihat Saat Dipegang**: avatar memegang buket di depan perut.
5. Ganti buket atau warna kapan saja tanpa memuat ulang halaman.
6. **Kualitas**: *Ringan* (cepat, untuk HP) atau *Bagus* (bayangan lembut, ambient occlusion, bulu kawat
   berlapis, detail lebih tinggi). Pilih di kiri bawah viewer (desktop) atau di tab Tampilan. Default: Bagus
   untuk layar ≥1024 px, Ringan untuk HP; pilihan disimpan di browser. Ukuran fisik identik di kedua mode.
   Bisa dipaksa lewat URL: `?quality=high` atau `?quality=standard`.

Dokumen lain: `ARCHITECTURE.md`, `ASSET_PIPELINE.md`, `IMPLEMENTATION_STATUS.md`. `SPEC.md` adalah spesifikasi
awal. Bila ada perbedaan, kode dan dokumen-dokumen tadi yang benar.
