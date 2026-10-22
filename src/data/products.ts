import { z } from 'zod';
import { ProductSchema, type Dimensions, type Product } from './schema';

/**
 * Data produk Fuzzy Flo. Sumber ukuran: caption katalog penjual ("Dimensi +- A x B cm"),
 * belum diukur ulang. Komposisi & warna model 3D = perkiraan dari satu foto per produk.
 * Tidak ada harga/kontak di sini karena belum ada datanya.
 */

const fromCaption = (heightCm: number, widthCm: number): Dimensions => ({
  heightCm,
  widthCm,
  depthCm: null,
  estimatedDepthCm: Math.round(widthCm * 0.75),
  handleLengthCm: null,
  interpretation: `Caption "± ${heightCm} x ${widthCm} cm" dibaca tinggi x lebar`,
});

const sellerCaption = {
  measurementSource: 'seller-caption',
  measurementStatus: 'seller-stated-approx',
  lastVerifiedAt: null,
  note: 'Ukuran perkiraan (±) dari caption katalog penjual. Kedalaman tidak disebutkan.',
} as const;

const photo = (id: string, n: number) => `/products/${id}/${n}.jpg`;

const raw: Product[] = [
  {
    id: 'pink-lily-tulip',
    name: 'Pink Lily & Tulip',
    sizeLabel: 'Medium to Large',
    dimensions: fromCaption(65, 40),
    measurement: sellerCaption,
    modelStatus: 'representative',
    model: { kind: 'procedural' },
    shapeOnlySizeCm: null,
    composition: '2 lily besar, 6 tulip, 3 daisy putih kecil, 3 tangkai daun manik',
    wrapping: 'Kertas salmon-pink, mesh putih bergelombang, pita pink',
    recipe: {
      flowers: [
        { type: 'lily', count: 2, color: 'lily', scale: 1.1 },
        { type: 'tulip', count: 6, color: 'tulip' },
        { type: 'daisy', count: 3, color: 'daisy' },
      ],
      sprigs: 3, leaves: 2, wrapperSheets: 10, meshLayer: true, cellophane: false, fairyLights: false, wrapperPattern: 'plain', heartSticker: true, ribbonPattern: 'plain',
    },
    variants: [
      {
        id: 'pink', label: 'Pink', sizeConfirmed: true, photos: [photo('pink-lily-tulip', 1)],
        palette: { lily: '#F2A7B5', tulip: '#EE9AAE', daisy: '#FBFAF7', center: '#F2C94C', wrapper: '#F4A79B', wrapper2: '#FBE3DD', mesh: '#FFFFFF', ribbon: '#F6B7C3', stem: '#6E9B4E', leaf: '#86B35A' },
      },
      {
        id: 'biru', label: 'Biru', sizeConfirmed: true, photos: [photo('pink-lily-tulip', 2)],
        palette: { lily: '#A9C6EE', tulip: '#9DB8E8', daisy: '#FBFAF7', center: '#F2C94C', wrapper: '#8EC9DD', mesh: '#FFFFFF', ribbon: '#BFD9F2', stem: '#6E9B4E', leaf: '#86B35A' },
      },
    ],
  },
  {
    id: 'sunflower-tulip',
    name: 'Sunflower & Tulip',
    sizeLabel: 'Medium to Large',
    dimensions: fromCaption(60, 40),
    measurement: sellerCaption,
    modelStatus: 'representative',
    model: { kind: 'procedural' },
    shapeOnlySizeCm: null,
    composition: '3 bunga matahari, 6 tulip oranye/kuning, 4 daisy putih, sprig hijau',
    wrapping: 'Kertas sage green, mesh putih, pita krem',
    recipe: {
      flowers: [
        { type: 'sunflower', count: 3, color: 'sunflower' },
        { type: 'tulip', count: 3, color: 'tulip' },
        { type: 'tulip', count: 3, color: 'tulip2' },
        { type: 'daisy', count: 4, color: 'daisy' },
      ],
      sprigs: 3, leaves: 2, wrapperSheets: 10, meshLayer: true, cellophane: false, fairyLights: false, wrapperPattern: 'plain', heartSticker: false, ribbonPattern: 'plain',
    },
    variants: [
      {
        id: 'standar', label: 'Standar', sizeConfirmed: true, photos: [photo('sunflower-tulip', 1)],
        palette: { sunflower: '#F5C211', disk: '#5A3A1E', tulip: '#F28C28', tulip2: '#F6B42C', daisy: '#FBFAF7', center: '#F2C94C', wrapper: '#C9D6B4', wrapper2: '#F3F5EC', mesh: '#FFFFFF', ribbon: '#EFE3C8', stem: '#6E9B4E', leaf: '#86B35A' },
      },
    ],
  },
  {
    id: 'brown-lily-rose',
    name: 'Rustic Lily & Tulip',
    sizeLabel: 'Medium',
    dimensions: fromCaption(52, 37),
    measurement: sellerCaption,
    modelStatus: 'representative',
    model: { kind: 'procedural' },
    shapeOnlySizeCm: null,
    composition: '2 lily (krem & tan), 3 tulip (2 marun, 1 krem), daun hijau',
    wrapping: 'Kertas terracotta bertekstur, pita krem',
    recipe: {
      flowers: [
        { type: 'lily', count: 1, color: 'lily', scale: 1.05 },
        { type: 'lily', count: 1, color: 'lily2', scale: 1.05 },
        { type: 'tulip', count: 2, color: 'tulip' },
        { type: 'tulip', count: 1, color: 'tulip2' },
      ],
      sprigs: 0, leaves: 4, wrapperSheets: 9, meshLayer: false, cellophane: false, fairyLights: false, wrapperPattern: 'stripe', heartSticker: false, ribbonPattern: 'plain',
    },
    variants: [
      {
        id: 'standar', label: 'Standar', sizeConfirmed: true, photos: [photo('brown-lily-rose', 1)],
        palette: { lily: '#F3E7D3', lily2: '#D9A877', tulip: '#7A1F2B', tulip2: '#F1E6D6', wrapper: '#A8644A', ribbon: '#F2E6CC', stem: '#5E8C3A', leaf: '#5E8C3A' },
      },
    ],
  },
  {
    id: 'pink-tulip-lily',
    name: 'Pink Tulip & Lily',
    sizeLabel: 'Medium',
    dimensions: fromCaption(52, 37),
    measurement: sellerCaption,
    modelStatus: 'representative',
    model: { kind: 'procedural' },
    shapeOnlySizeCm: null,
    composition: '2 lily (pink muda & pink), 4 tulip pink, daun',
    wrapping: 'Kertas pink motif kotak, pita gingham merah',
    recipe: {
      flowers: [
        { type: 'lily', count: 1, color: 'lily', scale: 1.1 },
        { type: 'lily', count: 1, color: 'lily2', scale: 1.1 },
        { type: 'tulip', count: 4, color: 'tulip' },
      ],
      sprigs: 0, leaves: 3, wrapperSheets: 9, meshLayer: false, cellophane: false, fairyLights: false, wrapperPattern: 'check', heartSticker: true, ribbonPattern: 'check',
    },
    variants: [
      {
        id: 'pink', label: 'Pink', sizeConfirmed: true,
        photos: [photo('pink-tulip-lily', 1), photo('pink-tulip-lily', 3), photo('pink-tulip-lily', 4)],
        palette: { lily: '#F6B8C4', lily2: '#EE8FA9', tulip: '#F3A6B5', wrapper: '#F2B5C0', wrapper2: '#F7D3D9', ribbon: '#C8323C', stem: '#6E9B4E', leaf: '#86B35A' },
      },
      {
        id: 'ungu', label: 'Ungu & putih', sizeConfirmed: true, photos: [photo('pink-tulip-lily', 2)],
        palette: { lily: '#C4A9E4', lily2: '#A98BD4', tulip: '#C7A6E0', wrapper: '#F4EFEA', ribbon: '#C8323C', stem: '#6E9B4E', leaf: '#86B35A' },
      },
    ],
  },
  {
    id: 'garden-mix',
    name: 'Garden Mix',
    sizeLabel: 'Large',
    dimensions: fromCaption(62, 45),
    measurement: sellerCaption,
    modelStatus: 'representative',
    model: { kind: 'procedural' },
    shapeOnlySizeCm: null,
    composition: '3 lily (peach, magenta, oranye), 2 gerbera, 3 tulip, 4 daisy, sprig hijau',
    wrapping: 'Mesh putih, cellophane iridescent, pita pink',
    recipe: {
      flowers: [
        { type: 'lily', count: 1, color: 'lily', scale: 1.05 },
        { type: 'lily', count: 1, color: 'lily2', scale: 1.05 },
        { type: 'lily', count: 1, color: 'lily3', scale: 0.75 },
        { type: 'gerbera', count: 2, color: 'gerbera' },
        { type: 'tulip', count: 3, color: 'tulip' },
        { type: 'daisy', count: 4, color: 'daisy' },
      ],
      sprigs: 4, leaves: 2, wrapperSheets: 11, meshLayer: true, cellophane: true, fairyLights: false, wrapperPattern: 'plain', heartSticker: true, ribbonPattern: 'plain',
    },
    variants: [
      {
        id: 'pink', label: 'Pink', sizeConfirmed: true, photos: [photo('garden-mix', 1), photo('garden-mix', 2)],
        palette: { lily: '#F4C7B0', lily2: '#D9437A', lily3: '#F08A3C', gerbera: '#F2A2BF', tulip: '#F29AB6', daisy: '#FBFAF7', center: '#F2C94C', wrapper: '#F7F4F2', mesh: '#FFFFFF', cello: '#DDEBF2', ribbon: '#F08BB0', stem: '#6E9B4E', leaf: '#86B35A' },
      },
      {
        id: 'biru-pink', label: 'Biru & pink', sizeConfirmed: true, photos: [photo('garden-mix', 3)],
        palette: { lily: '#9DB4EA', lily2: '#F29AB6', lily3: '#F08A3C', gerbera: '#9DB4EA', tulip: '#F29AB6', daisy: '#FBFAF7', center: '#F2C94C', wrapper: '#F7F4F2', mesh: '#FFFFFF', cello: '#DDEBF2', ribbon: '#A9C2EE', stem: '#6E9B4E', leaf: '#86B35A' },
      },
    ],
  },
  {
    id: 'tulip-daisy',
    name: 'Tulip & Daisy',
    sizeLabel: 'Large',
    dimensions: fromCaption(60, 40),
    measurement: sellerCaption,
    modelStatus: 'representative',
    model: { kind: 'procedural' },
    shapeOnlySizeCm: null,
    composition: '12 tulip (dua tone), 7 daisy putih pusat kuning, daun',
    wrapping: 'Kertas berlapis lebar, pita + mesh',
    recipe: {
      flowers: [
        { type: 'tulip', count: 6, color: 'tulip' },
        { type: 'tulip', count: 6, color: 'tulip2' },
        { type: 'daisy', count: 7, color: 'daisy' },
      ],
      sprigs: 0, leaves: 4, wrapperSheets: 12, meshLayer: true, cellophane: false, fairyLights: false, wrapperPattern: 'plain', heartSticker: true, ribbonPattern: 'plain',
    },
    variants: [
      {
        id: 'pink', label: 'Pink', sizeConfirmed: true, photos: [photo('tulip-daisy', 1)],
        palette: { tulip: '#F2A0BA', tulip2: '#E26D96', daisy: '#FBFAF7', center: '#F2C94C', wrapper: '#F6D7CF', wrapper2: '#FCEFEA', mesh: '#FFFFFF', ribbon: '#EE8FB0', stem: '#6E9B4E', leaf: '#86B35A' },
      },
      {
        id: 'hitam', label: 'Hitam (putih & merah tua)', sizeConfirmed: true, photos: [photo('tulip-daisy', 2)],
        palette: { tulip: '#F4F1EA', tulip2: '#7A1530', daisy: '#FBFAF7', center: '#F2C94C', wrapper: '#232021', mesh: '#FFFFFF', ribbon: '#B3122B', stem: '#5E8C3A', leaf: '#6FA048' },
      },
      {
        id: 'fuchsia', label: 'Fuchsia (foto tanpa caption)', sizeConfirmed: false, photos: [photo('tulip-daisy', 3)],
        palette: { tulip: '#EC7FA9', tulip2: '#F5B6CB', daisy: '#FBFAF7', center: '#F2C94C', wrapper: '#F7DDE4', mesh: '#FFFFFF', ribbon: '#F3A3BF', stem: '#6E9B4E', leaf: '#86B35A' },
      },
      {
        id: 'lavender', label: 'Lavender (foto tanpa caption)', sizeConfirmed: false, photos: [photo('tulip-daisy', 4)],
        palette: { tulip: '#B79AD9', tulip2: '#D7C5EC', daisy: '#FBFAF7', center: '#F2C94C', wrapper: '#D9CDEA', mesh: '#FFFFFF', ribbon: '#C3B0E2', stem: '#6E9B4E', leaf: '#86B35A' },
      },
      {
        id: 'biru-muda', label: 'Biru muda (foto tanpa caption)', sizeConfirmed: false, photos: [photo('tulip-daisy', 5)],
        palette: { tulip: '#7FA6DE', tulip2: '#B9CCEB', daisy: '#FBFAF7', center: '#F2C94C', wrapper: '#CFE0EC', mesh: '#FFFFFF', ribbon: '#A9C6E6', stem: '#6E9B4E', leaf: '#86B35A' },
      },
    ],
  },
  {
    id: 'jumbo-tulip-lights',
    name: 'Jumbo Tulip with Lights',
    sizeLabel: 'Jumbo (lebih besar sedikit dari Large)',
    dimensions: null,
    measurement: {
      measurementSource: 'none',
      measurementStatus: 'unknown',
      lastVerifiedAt: null,
      note: 'Caption tidak mencantumkan dimensi. Tanyakan admin untuk ukuran.',
    },
    modelStatus: 'representative',
    model: { kind: 'procedural' },
    shapeOnlySizeCm: { heightCm: 66, widthCm: 50 },
    composition: '22 tangkai tulip pink/mauve, lampu kecil',
    wrapping: 'Kertas putih, pita pink',
    recipe: {
      flowers: [
        { type: 'tulip', count: 11, color: 'tulip' },
        { type: 'tulip', count: 11, color: 'tulip2' },
      ],
      sprigs: 0, leaves: 0, wrapperSheets: 12, meshLayer: false, cellophane: false, fairyLights: true, wrapperPattern: 'plain', heartSticker: false, ribbonPattern: 'plain',
    },
    variants: [
      {
        id: 'standar', label: 'Standar', sizeConfirmed: false,
        photos: [photo('jumbo-tulip-lights', 1), photo('jumbo-tulip-lights', 2)],
        palette: { tulip: '#E6A1B4', tulip2: '#C9849F', wrapper: '#F7F3EE', ribbon: '#F1A7BC', light: '#FFD27A', stem: '#6E9B4E', leaf: '#86B35A' },
      },
    ],
  },
];

export const PRODUCTS: readonly Product[] = z.array(ProductSchema).parse(raw);

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** Ukuran yang dipakai membangun model (cm): data asli, atau ukuran bentuk internal bila tidak diketahui. */
export function buildSizeCm(p: Product): { heightCm: number; widthCm: number; depthCm: number } {
  if (p.dimensions) {
    return { heightCm: p.dimensions.heightCm, widthCm: p.dimensions.widthCm, depthCm: p.dimensions.depthCm ?? p.dimensions.estimatedDepthCm };
  }
  const s = p.shapeOnlySizeCm;
  if (!s) throw new Error(`Produk ${p.id} tanpa dimensions maupun shapeOnlySizeCm`);
  return { heightCm: s.heightCm, widthCm: s.widthCm, depthCm: Math.round(s.widthCm * 0.75) };
}

/** Perbandingan ukuran hanya boleh untuk produk berdimensi. */
export const canCompare = (p: Product) => p.dimensions !== null;
