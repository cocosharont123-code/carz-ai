import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PALETTE } from "../config";

/**
 * Car construction. Ships with detailed procedural cars so the game runs with
 * zero external assets; a glTF override hook (loadModelManifest) swaps in real
 * models when .glb files are dropped into public/models/ (see README).
 */

export type Variant = "player" | "sedan" | "suv" | "taxi" | "van";

export interface CarParts {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  flames: THREE.Mesh[];
  brakeLights: THREE.MeshStandardMaterial[];
}

interface VariantSpec {
  length: number;
  width: number;
  height: number;
  cabin: number; // cabin height fraction
  color: number;
  roof?: number;
  metalness: number;
  roughness: number;
}

const SPECS: Record<Variant, VariantSpec> = {
  player: { length: 4.3, width: 1.9, height: 1.12, cabin: 0.52, color: PALETTE.miamiBlue, metalness: 0.7, roughness: 0.22 },
  sedan: { length: 4.4, width: 1.85, height: 1.28, cabin: 0.58, color: 0xd6d9e0, metalness: 0.6, roughness: 0.35 },
  suv: { length: 4.7, width: 1.98, height: 1.72, cabin: 0.62, color: 0x394050, metalness: 0.55, roughness: 0.42 },
  taxi: { length: 4.5, width: 1.88, height: 1.34, cabin: 0.58, color: 0xffc21e, roof: 0xffd54a, metalness: 0.5, roughness: 0.4 },
  van: { length: 4.9, width: 2.0, height: 2.0, cabin: 0.74, color: 0xe8e4dc, metalness: 0.4, roughness: 0.5 },
};

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 18);
wheelGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.32, 12);
rimGeo.rotateZ(Math.PI / 2);
const tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.85, metalness: 0.1 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc8, roughness: 0.35, metalness: 0.9 });

function makeWheel(): THREE.Group {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(wheelGeo, tireMat);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  tire.castShadow = true;
  g.add(tire, rim);
  return g;
}

/** Build a procedural car for the given variant. */
export function buildCar(variant: Variant, envMap?: THREE.Texture | null): CarParts {
  const spec = SPECS[variant];
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const flames: THREE.Mesh[] = [];
  const brakeLights: THREE.MeshStandardMaterial[] = [];

  const isPlayer = variant === "player";
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: spec.color,
    metalness: spec.metalness,
    roughness: spec.roughness,
    clearcoat: isPlayer ? 1 : 0.4,
    clearcoatRoughness: isPlayer ? 0.08 : 0.3,
    envMap: envMap ?? null,
    envMapIntensity: isPlayer ? 1.5 : 1.0,
  });

  // Lower body (slightly tapered by scaling the top).
  const bodyH = spec.height * (1 - spec.cabin * 0.5);
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.width, bodyH, spec.length), bodyMat);
  body.position.y = 0.42 + bodyH / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Cabin / greenhouse.
  const cabinH = spec.height * spec.cabin;
  const cabinLen = spec.length * (variant === "van" ? 0.72 : 0.5);
  const cabinMat = new THREE.MeshPhysicalMaterial({
    color: spec.roof ?? spec.color,
    metalness: spec.metalness,
    roughness: spec.roughness,
    clearcoat: isPlayer ? 1 : 0.3,
    envMap: envMap ?? null,
    envMapIntensity: 1.0,
  });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.9, cabinH, cabinLen), cabinMat);
  cabin.position.set(0, body.position.y + bodyH / 2 + cabinH / 2 - 0.02, variant === "van" ? -spec.length * 0.02 : -spec.length * 0.06);
  cabin.castShadow = true;
  group.add(cabin);

  // Glass band.
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b1622,
    metalness: 0.2,
    roughness: 0.08,
    transmission: 0.0,
    transparent: true,
    opacity: 0.72,
    envMap: envMap ?? null,
    envMapIntensity: 1.4,
  });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.92, cabinH * 0.62, cabinLen * 1.02), glassMat);
  glass.position.copy(cabin.position);
  glass.position.y += cabinH * 0.05;
  group.add(glass);

  // Wheels (4).
  const wheelY = 0.36;
  const wheelX = spec.width / 2 - 0.06;
  const wheelZ = spec.length / 2 - 0.85;
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]) {
    const w = makeWheel();
    w.position.set(sx * wheelX, wheelY, sz * wheelZ);
    group.add(w);
    wheels.push(w);
  }

  // Headlights (front = -z).
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff4d8, emissive: 0xffe9b0, emissiveIntensity: 1.4 });
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    h.position.set(sx * (spec.width / 2 - 0.35), 0.72, -spec.length / 2 + 0.02);
    group.add(h);
  }

  // Taillights (rear = +z).
  const tailMat = new THREE.MeshStandardMaterial({ color: PALETTE.coral, emissive: PALETTE.coral, emissiveIntensity: 2.0 });
  brakeLights.push(tailMat);
  for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), tailMat);
    t.position.set(sx * (spec.width / 2 - 0.38), 0.74, spec.length / 2 - 0.02);
    group.add(t);
  }

  // Player extras: blue underglow + always-on exhaust flames.
  if (isPlayer) {
    const glow = new THREE.PointLight(PALETTE.miamiBlue, 3, 6, 2);
    glow.position.set(0, 0.15, 0.5);
    group.add(glow);

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x6fe6ff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flameGeo = new THREE.ConeGeometry(0.13, 0.9, 12);
    flameGeo.rotateX(-Math.PI / 2); // point along +z (out the back)
    for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(flameGeo, flameMat.clone());
      f.position.set(sx * 0.5, 0.5, spec.length / 2 + 0.35);
      group.add(f);
      flames.push(f);
    }

    // Taxi-sign-style roof spoiler accent in miami blue.
    const accentMat = new THREE.MeshStandardMaterial({ color: PALETTE.miamiBlue, emissive: PALETTE.miamiBlue, emissiveIntensity: 0.6 });
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.94, 0.08, 0.32), accentMat);
    spoiler.position.set(0, 0.5 + bodyH, spec.length / 2 - 0.15);
    group.add(spoiler);
  }

  // Taxi roof sign.
  if (variant === "taxi") {
    const signMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0xffcf3a, emissiveIntensity: 0.8 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.34), signMat);
    sign.position.set(0, cabin.position.y + cabinH / 2 + 0.14, 0);
    group.add(sign);
  }

  return { group, wheels, flames, brakeLights };
}

// ---------------------------------------------------------------------------
// Optional glTF override
// ---------------------------------------------------------------------------

/**
 * Attempts to load real glTF models declared in public/models/manifest.json.
 * Returns a map of variant -> prepared THREE.Group. If the manifest or any file
 * is missing, resolves to an empty map and the game falls back to procedural.
 *
 * manifest.json shape:
 *   { "player": { "url": "coupe.glb", "scale": 1, "credit": "..." }, ... }
 */
export async function loadModelManifest(
  envMap?: THREE.Texture | null,
): Promise<Partial<Record<Variant, THREE.Group>>> {
  const out: Partial<Record<Variant, THREE.Group>> = {};
  let manifest: Record<string, { url: string; scale?: number }> | null = null;
  try {
    const res = await fetch("models/manifest.json", { cache: "no-cache" });
    if (!res.ok) return out;
    manifest = await res.json();
  } catch {
    return out;
  }
  if (!manifest) return out;

  const loader = new GLTFLoader();
  await Promise.all(
    Object.entries(manifest).map(async ([variant, entry]) => {
      try {
        const gltf = await loader.loadAsync(`models/${entry.url}`);
        const model = gltf.scene;
        const s = entry.scale ?? 1;
        model.scale.setScalar(s);
        model.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            const m = o as THREE.Mesh;
            m.castShadow = true;
            m.receiveShadow = true;
            const mat = m.material as THREE.MeshStandardMaterial;
            if (mat && envMap) mat.envMap = envMap;
            // Miami-blue clearcoat override for the hero car.
            if (variant === "player" && mat) {
              (m.material as THREE.MeshStandardMaterial).color = new THREE.Color(PALETTE.miamiBlue);
            }
          }
        });
        out[variant as Variant] = model;
      } catch {
        /* missing file -> procedural fallback for this variant */
      }
    }),
  );
  return out;
}
