# Pipeline aset

## Sumber gambar

`E:\fuzzy\gambar refrensi\` berisi 19 screenshot katalog (JPEG 709×1600, dengan UI HP di atas dan bawah).
File `.zip` di folder yang sama berisi 19 file identik (duplikat). Sumber asli **tidak pernah diubah**.

`scripts/prepare-images.py` (Python 3.12 + Pillow) mendeteksi blok foto, meng-crop UI HP, lalu menulis:
- `public/products/<id>/<n>.jpg` (lebar maks. 900, q82);
- `<n>-thumb.jpg` (480 px);
- logo `public/brand/logo.png`.

Pemetaan nomor foto ada di `PRODUCT_MAP` dalam skrip. Nomor = urutan nama file alfabetis.

## Pengelompokan produk (hasil audit)

| Produk | Foto (nomor global) | Caption |
|---|---|---|
| pink-lily-tulip | 1 (pink), 2 (biru) | Medium to Large, ± 65 × 40 cm |
| sunflower-tulip | 4 | Medium to Large, ± 60 × 40 cm |
| brown-lily-rose | 5 | Medium, ± 52 × 37 cm |
| pink-tulip-lily | 6, 8, 9 (pink, 3 sudut serupa), 7 (ungu-putih) | Medium, ± 52 × 37 cm |
| garden-mix | 11, 13 (pink), 16 (biru-pink) | Large, ± 62 × 45 cm |
| tulip-daisy | 14 (pink), 15 (hitam); 17, 18, 19 tanpa caption | Large, ± 60 × 40 cm |
| jumbo-tulip-lights | 10, 12 | Jumbo, 22 tangkai, **tanpa dimensi** |
| (logo) | 3 | – |

Setiap produk hanya punya foto dari depan atau sedikit dari atas. Tidak ada foto belakang atau samping, dan
tidak ada metadata EXIF ukuran.

## Metode modeling

| Metode | Hasil evaluasi |
|---|---|
| Photogrammetry | Tidak mungkin: butuh puluhan sudut per objek, sedangkan yang tersedia 1 sudut. |
| Image-to-3D AI | Tidak tersedia lokal. Dari 1 foto, bagian belakang akan dikarang model dan bentuknya tidak bisa diverifikasi. |
| Blender + Python | Blender tidak terpasang di mesin ini. |
| **Procedural three.js (dipilih)** | Komponen kawat bulu parametrik dalam TypeScript (`src/three`), dikalibrasi ke ukuran caption. Bisa diuji otomatis, ringan, dan mudah ditambah produk baru. |

Komponen reusable ada di `src/three/flowers.ts`: tulip, lily (kelopak runcing dengan 4 loop rusuk + stamen),
daisy, sunflower, gerbera, rose (spiral), daun, sprig manik, tangkai. Pembungkus dan pita ada di
`src/three/bouquet.ts`: lembar kertas mengipas (belakang tinggi, depan rendah), lapisan mesh, cellophane,
selongsong pegangan, pita, dan lampu.

Setiap kelopak berupa **loop tabung kawat** (diameter ±7 mm). Kelopak "terisi" dibuat dari beberapa loop
konsentris, seperti lilitan aslinya. Bulu disimulasikan dengan normal map serat dan *sheen*, bukan helai
geometri, sehingga murah dan tidak tampak plastik.

## Menambah buket baru

1. Salin foto ke `E:\fuzzy\gambar refrensi\`, tambahkan nomornya di `PRODUCT_MAP`, lalu jalankan
   `python -I scripts/prepare-images.py`. Bisa juga dengan menaruh JPEG langsung di `public/products/<id>/1.jpg`
   beserta `1-thumb.jpg`.
2. Tambahkan objek ke array `raw` di `src/data/products.ts`:
   - `dimensions: fromCaption(tinggi, lebar)`, atau `null` + `shapeOnlySizeCm` bila ukuran belum diketahui;
   - `measurement`: sumber dan status ukuran (`seller-caption`/`measured`, `seller-stated-approx`/`verified`,
     `lastVerifiedAt`);
   - `recipe`: jenis bunga + jumlah + key warna, jumlah daun/sprig, jumlah lembar pembungkus, mesh/cellophane/lampu;
   - `variants[].palette`: warna hex per key. Wajib ada `wrapper`, `ribbon`, `stem`, `leaf`.
3. `npm run test` memvalidasi schema dan kalibrasi otomatis untuk semua produk berdimensi (tinggi ±1%,
   lebar ±5%).
4. Cek visual dengan `npm run e2e -- --only products` → `e2e/screenshots/p-<id>.png`.

## Mengganti model representatif dengan GLB

1. Ekspor model dari Blender (atau hasil scan) ke `.glb` dengan +Y ke atas dan depan buket menghadap +Z.
   Satuan bebas, karena kalibrasi menyamakan tinggi. Taruh di `public/models/<id>.glb`.
2. Di `products.ts`, ubah `model: { kind: 'glb', url: '/models/<id>.glb', gripFraction: 0.36 }`.
   `gripFraction` = tinggi titik ikat/pegang dibagi tinggi model. Setelah model diverifikasi terhadap produk
   nyata, ubah juga `modelStatus: 'verified'`.
3. `bouquetFromScene()` memusatkan model di x/z, meletakkannya di lantai, dan menskalakannya **uniform** ke
   tinggi data. Mode banding dan pegang langsung berfungsi.

## Kalibrasi dimensi

- Ukur buket nyata: tinggi dari dasar pegangan ke puncak tertinggi, lebar terbesar dari depan, dan
  kedalaman.
- Isi `dimensions` dengan `depthCm` (bukan null), `measurementSource: 'measured'`,
  `measurementStatus: 'verified'`, dan `lastVerifiedAt: 'YYYY-MM-DD'`.
- Bila lebar model procedural meleset >5% dari data, test gagal. Sesuaikan resep (jumlah lembar, ukuran
  bunga), jangan longgarkan toleransi.
- Panel "Model 3D terukur" menampilkan Box3 aktual model, sehingga selisihnya dengan data penjual terlihat.
