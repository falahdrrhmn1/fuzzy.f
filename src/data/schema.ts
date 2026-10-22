import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Ukuran fisik dalam cm. Produk tanpa ukuran → `dimensions: null` (jangan dikarang). */
export const DimensionsSchema = z.object({
  heightCm: z.number().positive(),
  widthCm: z.number().positive(),
  /** Kedalaman tidak pernah disebut penjual → null; model memakai estimatedDepthCm. */
  depthCm: z.number().positive().nullable(),
  estimatedDepthCm: z.number().positive(),
  handleLengthCm: z.number().positive().nullable(),
  /** Cara membaca caption, mis. "A x B = tinggi x lebar". */
  interpretation: z.string(),
});

export const MeasurementSchema = z.object({
  measurementSource: z.enum(['seller-caption', 'measured', 'none']),
  measurementStatus: z.enum(['verified', 'seller-stated-approx', 'unknown']),
  lastVerifiedAt: z.string().nullable(),
  note: z.string(),
});

export const FlowerTypeSchema = z.enum(['tulip', 'lily', 'daisy', 'sunflower', 'gerbera', 'rose']);

/** Resep komposisi model 3D (perkiraan dari foto). `color` = key di palette varian. */
export const RecipeSchema = z.object({
  flowers: z.array(
    z.object({
      type: FlowerTypeSchema,
      count: z.number().int().positive(),
      color: z.string(),
      scale: z.number().positive().optional(),
    }),
  ),
  sprigs: z.number().int().nonnegative(),
  leaves: z.number().int().nonnegative(),
  wrapperSheets: z.number().int().min(6).max(16),
  meshLayer: z.boolean(),
  cellophane: z.boolean(),
  fairyLights: z.boolean(),
});

export const VariantSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string(),
  palette: z
    .record(hex)
    .refine((p) => ['wrapper', 'ribbon', 'stem', 'leaf'].every((k) => k in p), 'palette wajib punya wrapper, ribbon, stem, leaf'),
  photos: z.array(z.string()).min(1),
  /** false = foto varian tanpa caption ukuran; ukuran produk induk belum tentu berlaku. */
  sizeConfirmed: z.boolean(),
});

export const ProductSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  sizeLabel: z.string(),
  dimensions: DimensionsSchema.nullable(),
  measurement: MeasurementSchema,
  /** Model selalu "representative" sampai ada model hasil scan/pengukuran nyata. */
  modelStatus: z.enum(['representative', 'verified']),
  /**
   * Sumber model 3D. "procedural" = dibangun dari `recipe`. "glb" = file di /public (mis. hasil Blender/scan);
   * tetap dikalibrasi ke tinggi data. `gripFraction` = tinggi titik pegang relatif tinggi model.
   */
  model: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('procedural') }),
    z.object({ kind: z.literal('glb'), url: z.string().startsWith('/'), gripFraction: z.number().min(0.05).max(0.8) }),
  ]),
  /** Ukuran internal HANYA untuk membentuk model bila dimensi tidak diketahui. Tidak pernah ditampilkan. */
  shapeOnlySizeCm: z.object({ heightCm: z.number().positive(), widthCm: z.number().positive() }).nullable(),
  composition: z.string(),
  wrapping: z.string(),
  recipe: RecipeSchema,
  variants: z.array(VariantSchema).min(1),
});

export type Dimensions = z.infer<typeof DimensionsSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type FlowerType = z.infer<typeof FlowerTypeSchema>;
