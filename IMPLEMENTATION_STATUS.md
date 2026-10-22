# Status implementasi (2026-10-23)

## Selesai dan teruji

| Fitur | Bukti |
|---|---|
| Web jalan (dev & produksi), katalog 7 produk, studio per produk, 404 untuk ID salah | `npm run build` lulus; e2e |
| Viewer 3D geometri nyata: rotate/orbit (mouse & 1 jari), zoom (scroll), pan, reset, preset Depan/Samping/Belakang/Atas, putar otomatis | e2e: drag/scroll mengubah kamera, reset kembali ke posisi awal (±5 cm) |
| Kamera tidak menembus lantai (batas polar angle), jarak min/max | konfigurasi `CameraRig` (diverifikasi visual) |
| Kalibrasi ukuran buket: tinggi Box3 = data ±1%, lebar ±5%, dasar di y=0, skala uniform 0,95–1,05 | unit test untuk 6 produk berdimensi |
| Avatar perempuan/laki-laki, tinggi 140–200 cm (Box3 ±0,5%), berat 35–120 kg mengubah lebar & kedalaman badan tanpa mengubah tinggi | unit test (16 kombinasi) + e2e 170 cm → 1,7000 m |
| Skenario acuan 170 cm vs 45 cm: rasio 0,2647 ±1% | unit test |
| Mode Bandingkan: berdampingan di lantai yang sama, garis ukur dari Box3, opsi ortografis | unit test layout + e2e + screenshot |
| Ganti tinggi avatar / zoom tidak mengubah ukuran buket | unit test + e2e |
| Mode Pegang: titik genggam = anchor tangan (<1 cm), kedua tangan mencapai (IK), tanpa tembus badan, ikut tinggi 150/170/195 cm, tetap menempel saat produk diganti | unit test (9 kombinasi) + e2e |
| Varian warna mengubah model; foto asli per varian + lightbox; varian tanpa caption diberi tanda | screenshot |
| Produk tanpa ukuran (jumbo): mode banding/pegang nonaktif + pesan | e2e |
| Responsif: tanpa horizontal overflow di 360/390/430/1280/1920 px; bottom sheet 3 posisi (tab, tombol, seret); landscape HP memakai panel samping; tombol utama ≥40 px | e2e |
| Fallback tanpa WebGL (foto + ukuran), error boundary, loading state | e2e (Chromium dengan `--disable-webgl`) |
| Lazy load three.js hanya di studio; draw call 9–24 per scene; heap stabil ±23–25 MB setelah 16× ganti produk | build output + pengukuran Playwright |
| Impor GLB pengganti model (`model.kind = 'glb'`) dengan kalibrasi yang sama | unit test `bouquetFromScene` |
| Dua mode kualitas: **Ringan** (54–111k segitiga, tanpa shadow map/pasca-proses) dan **Bagus** (288–561k segitiga, shadow map lembut, N8AO, bloom, shell fur, detail tinggi); ukuran identik; pilihan tersimpan | unit test + e2e (ganti ke Bagus: Box3 sama ±2 mm, tanpa error) |
| Bunga kelopak terisi (tulip cangkir, lily lebar, daisy/gerbera/sunflower), pembungkus lembar persegi dua lapis + motif, pita simpul besar (gingham), stiker hati | perbandingan visual dengan foto (screenshot) |
| Avatar berpakaian (blus+rok / kaos+celana), rambut, wajah (rahang, hidung, telinga), tangan dengan ibu jari, sepatu | screenshot; tinggi tetap diuji ±0,5% |

Hasil terakhir: `typecheck` bersih, `lint` bersih, `vitest` 31/31, `e2e/smoke.py` 0 gagal (log di
`e2e/last-run.txt`).

## Masih demonstrasi / representatif

- **Semua model buket** adalah representasi procedural dari satu foto per produk. Komposisi, jumlah bunga, dan
  warna diperkirakan dari foto. Bagian belakang dan kedalaman (0,75 × lebar) adalah **perkiraan**. UI
  menyatakan ini di panel Ukuran dan di katalog.
- **Ukuran** berasal dari caption penjual (±), belum diukur ulang (`lastVerifiedAt: null`). "A × B" ditafsirkan
  tinggi × lebar. Tafsiran ini perlu dikonfirmasi pemilik toko.
- Ukuran 3 varian warna tulip-daisy tanpa caption (fuchsia, lavender, biru muda) belum dikonfirmasi dan diberi tanda.
- Jumbo memakai ukuran bentuk internal (66 × 50 cm) hanya agar modelnya bisa dibangun. Ukuran ini **tidak
  ditampilkan** dan tidak dipakai untuk perbandingan.

## Parsial

- **Berat badan** hanya mengubah lingkar tubuh dengan satu faktor dari BMI. Tidak ada morph target atau preset
  bentuk tubuh, dan bentuk asli bisa berbeda (dinyatakan di UI).
- **Pose memegang** adalah IK dua tulang statis. Jari disederhanakan (telapak + blok jari + ibu jari). Tidak ada
  variasi pose (misalnya satu tangan atau menggendong di lengan).
- **Avatar** procedural berpakaian sederhana (tanpa aset pihak ketiga, jadi bebas lisensi). Proporsinya
  mengikuti tabel antropometri, tapi tidak photorealistic dan tanpa detail wajah (mata/mulut).
- **Kemiripan bunga** dengan foto sudah jauh lebih dekat, tetapi tetap representasi: jumlah/posisi bunga dan
  bentuk bagian belakang diperkirakan dari satu foto.
- **Impor GLB** belum diuji end-to-end dengan file `.glb` sungguhan di browser, baru konversi scene → kalibrasi
  di unit test.

## Belum dikerjakan

- Model hasil pengukuran atau scan nyata (butuh foto multi-sudut atau pengukuran fisik, lihat di bawah).
- Animasi transisi saat ganti produk, gerakan kecil natural, highlight bagian, simulasi tekuk kawat (P2).
- AR, konfigurasi warna bebas, harga, stok, pemesanan, WhatsApp, admin, database (P2; data harga/kontak belum ada).

## Hasil pengujian

- Unit (Node): 31 test di `src/three/__tests__/core.test.ts`.
- Browser (Chromium 156 headless, WebGL via **SwiftShader/CPU**): 63 pengecekan di `e2e/smoke.py`, mencakup
  katalog 5 lebar layar, studio desktop 1440×900, 7 produk, mobile 360×740, 390×844, 430×932, landscape
  844×390 (touch emulation), tanpa WebGL, dan perpindahan ke mode Bagus.
- Performa (headless, 390×844):
  - katalog siap dalam 0,7 s; studio siap (scene pertama) dalam 1,5 s, dari localhost;
  - heap JS 21 MB;
  - putar otomatis **9 fps di SwiftShader (render CPU)**. Angka ini **bukan** indikasi FPS di GPU HP. FPS di
    perangkat nyata belum diukur.

## Yang BELUM diuji (jujur)

- HP fisik Android dan iPhone, termasuk Safari/iOS. Belum ada FPS terukur di GPU nyata, termasuk **mode Bagus**
  (dirancang untuk laptop/desktop; di HP kelas menengah kemungkinan berat, makanya default HP = Ringan).
- Firefox dan Safari desktop.
- Gestur pinch dua jari asli (hanya drag satu jari yang diemulasikan; pinch ditangani camera-controls).
- File `.glb` nyata.

## Langkah berikutnya

1. **Butuh pemilik toko:** ukur 1–2 buket nyata (tinggi, lebar, kedalaman, panjang pegangan). Isi
   `measurementStatus: 'verified'` dan konfirmasi tafsiran "A × B = tinggi × lebar".
2. Uji di HP nyata (`next start -H 0.0.0.0`, buka dari HP di Wi-Fi yang sama). Catat FPS dengan `?debug=1`.
3. Untuk model yang lebih mirip, ambil 30–60 foto keliling satu buket (photogrammetry) atau modelkan di Blender,
   lalu impor GLB (`ASSET_PIPELINE.md`).
4. Preset bentuk tubuh (ramping/sedang/berisi) sebagai pelengkap berat.
5. Tombol "Tanya admin via WhatsApp" setelah nomor resmi tersedia.
