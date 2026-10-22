/**
 * Proporsi tubuh sebagai fraksi tinggi badan H.
 * Sumber: Drillis & Contini (1966), dirangkum di Winter, "Biomechanics and Motor Control of Human
 * Movement" (fig. 4.1). Nilai lebar wanita disesuaikan dari selisih rata-rata biacromial/bitrochanteric
 * antar jenis kelamin (perkiraan; bukan data individu).
 */
export type Sex = 'female' | 'male';

export const HEIGHT_RANGE_CM = { min: 140, max: 200, default: 165 } as const;
export const WEIGHT_RANGE_KG = { min: 35, max: 120, default: 55 } as const;

/** Tinggi landmark dari lantai (fraksi H). */
export const LANDMARK = {
  ankle: 0.039,
  knee: 0.285,
  hip: 0.53, // greater trochanter / sendi panggul
  crotch: 0.47,
  waist: 0.6,
  chest: 0.72,
  shoulder: 0.818,
  chin: 0.87,
  headCenter: 0.935,
} as const;

/** Panjang segmen (fraksi H). */
export const SEGMENT = {
  upperArm: 0.186,
  forearm: 0.146,
  hand: 0.108,
  thigh: 0.245,
  shank: 0.246,
  footLength: 0.152,
} as const;

/** Lebar (fraksi H) per jenis kelamin. */
export const BREADTH: Record<Sex, { shoulder: number; hip: number; waist: number; chest: number }> = {
  male: { shoulder: 0.259, hip: 0.191, waist: 0.165, chest: 0.2 },
  female: { shoulder: 0.235, hip: 0.2, waist: 0.15, chest: 0.18 },
};

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function bmi(heightCm: number, weightKg: number) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/**
 * Faktor ketebalan tubuh dari BMI (relatif BMI 21.5). Hanya mengubah lebar/kedalaman, tidak tinggi.
 * Ini pendekatan visual: tinggi & berat tidak menentukan bentuk tubuh secara pasti.
 */
export function girthScale(heightCm: number, weightKg: number) {
  return clamp(Math.sqrt(bmi(heightCm, weightKg) / 21.5), 0.82, 1.45);
}

export function bmiCategory(v: number): string {
  if (v < 18.5) return 'kurus';
  if (v < 25) return 'normal';
  if (v < 30) return 'berisi';
  return 'gemuk';
}
