/** Graphics quality settings. High / Medium / Low toggle shadows, post, DPR. */

export type Quality = "high" | "medium" | "low";

export interface QualityProfile {
  shadows: boolean;
  shadowSize: number;
  postProcessing: boolean;
  bloom: boolean;
  speedStreaks: boolean;
  pixelRatioCap: number;
  buildingRows: number;
  trafficMax: number;
}

const PROFILES: Record<Quality, QualityProfile> = {
  high: {
    shadows: true,
    shadowSize: 2048,
    postProcessing: true,
    bloom: true,
    speedStreaks: true,
    pixelRatioCap: 2,
    buildingRows: 2,
    trafficMax: 16,
  },
  medium: {
    shadows: true,
    shadowSize: 1024,
    postProcessing: true,
    bloom: true,
    speedStreaks: true,
    pixelRatioCap: 1.5,
    buildingRows: 2,
    trafficMax: 13,
  },
  low: {
    shadows: false,
    shadowSize: 512,
    postProcessing: false,
    bloom: false,
    speedStreaks: false,
    pixelRatioCap: 1,
    buildingRows: 1,
    trafficMax: 10,
  },
};

/** Auto-pick a starting quality from the device. */
export function detectQuality(): Quality {
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (mem <= 3 || cores <= 4) return coarse ? "low" : "medium";
  if (coarse && mem <= 6) return "medium";
  return "high";
}

export function profileFor(q: Quality): QualityProfile {
  return PROFILES[q];
}

export const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
