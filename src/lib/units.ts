/**
 * Konversi satuan: 1 world unit = 1 meter.
 * Data UI dalam cm; konversi hanya lewat fungsi ini.
 */

export function cmToM(cm: number): number {
  return cm / 100;
}

export function mToCm(m: number): number {
  return m * 100;
}

export function formatCm(cm: number): string {
  return `${Math.round(cm)} cm`;
}

export function formatCmPrecise(cm: number): string {
  return `${cm.toFixed(1)} cm`;
}