import * as THREE from "three";
import { PALETTE } from "../config";
import type { QualityProfile } from "../ui/settings";

/**
 * Golden-hour lighting rig + PMREM sunset environment so paint, glass and water
 * pick up real reflections. The sun sits low and dead-ahead down the highway.
 */
export interface LightingRig {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  skyTexture: THREE.Texture;
  envTexture: THREE.Texture;
  applyQuality(profile: QualityProfile): void;
  dispose(): void;
}

/** Draw an equirectangular sunset gradient (with a hot sun disc) onto a canvas. */
function makeSkyCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext("2d")!;

  // Vertical band: indigo zenith -> dusk rose -> amber horizon.
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0.0, "#1a1430");
  g.addColorStop(0.42, "#3a2a52");
  g.addColorStop(0.62, "#c95d8a");
  g.addColorStop(0.78, "#ff9b4a");
  g.addColorStop(0.88, "#ffc27a");
  g.addColorStop(1.0, "#7a4a6a"); // ground-ish bounce below horizon
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);

  // The sun — dead centre (looking down -z), just above the horizon line.
  const sx = c.width * 0.5;
  const sy = c.height * 0.74;
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 190);
  glow.addColorStop(0, "rgba(255,250,235,1)");
  glow.addColorStop(0.25, "rgba(255,220,150,0.95)");
  glow.addColorStop(0.6, "rgba(255,155,74,0.35)");
  glow.addColorStop(1, "rgba(255,155,74,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.beginPath();
  ctx.arc(sx, sy, 42, 0, Math.PI * 2);
  ctx.fillStyle = "#fff6e6";
  ctx.fill();

  return c;
}

export function createLighting(renderer: THREE.WebGLRenderer, scene: THREE.Scene): LightingRig {
  // --- Sky + environment ---
  const skyTexture = new THREE.CanvasTexture(makeSkyCanvas());
  skyTexture.mapping = THREE.EquirectangularReflectionMapping;
  skyTexture.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(skyTexture);
  const envTexture = envRT.texture;
  scene.environment = envTexture;
  scene.background = skyTexture;
  scene.backgroundBlurriness = 0.0;
  pmrem.dispose();

  // Warm exponential fog toward the sun so the road melts into the horizon.
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.duskRose).lerp(new THREE.Color(PALETTE.sunsetAmber), 0.4), 120, 500);

  // --- Sun (key) ---
  const sun = new THREE.DirectionalLight(0xffb367, 3.1);
  sun.position.set(3, 14, -140); // low + far ahead => long shadows toward player
  sun.target.position.set(0, 0, -40);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  // Tight frustum around the road so shadow resolution stays high.
  const cam = sun.shadow.camera;
  cam.near = 1;
  cam.far = 260;
  cam.left = -22;
  cam.right = 22;
  cam.top = 40;
  cam.bottom = -80;
  cam.updateProjectionMatrix();
  scene.add(sun);

  // --- Fill ---
  const hemi = new THREE.HemisphereLight(0xffd9a8, 0x2a1f44, 0.6);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0x4a3a66, 0.35);
  scene.add(ambient);

  function applyQuality(profile: QualityProfile) {
    sun.castShadow = profile.shadows;
    if (profile.shadows && sun.shadow.mapSize.width !== profile.shadowSize) {
      sun.shadow.mapSize.set(profile.shadowSize, profile.shadowSize);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  }

  function dispose() {
    skyTexture.dispose();
    envTexture.dispose();
  }

  return { sun, hemi, skyTexture, envTexture, applyQuality, dispose };
}
