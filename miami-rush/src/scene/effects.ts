import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { CRASH, PALETTE } from "../config";
import type { QualityProfile } from "../ui/settings";

/**
 * Post-processing stack: bloom on the sun/lights, a combined vignette +
 * radial speed-streak pass, SMAA anti-aliasing, then OutputPass for ACES
 * tone mapping + sRGB. Also owns the crash debris burst pool.
 */

export interface PostFX {
  composer: EffectComposer;
  setSpeedStreak(v: number): void;
  resize(w: number, h: number, dpr: number): void;
  render(): void;
  enabled: boolean;
}

const VignetteStreakShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: 0.55 },
    uStreak: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uStreak;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float vig = smoothstep(0.92, 0.28, length(d));
      tex.rgb *= mix(1.0, vig, uVignette);
      if (uStreak > 0.001) {
        vec2 dir = normalize(d + 1e-4);
        vec3 acc = vec3(0.0);
        for (int i = 1; i <= 6; i++) {
          vec2 suv = vUv - dir * float(i) * 0.010 * uStreak;
          acc += texture2D(tDiffuse, suv).rgb;
        }
        acc /= 6.0;
        float edge = smoothstep(0.12, 0.55, length(d));
        tex.rgb = mix(tex.rgb, tex.rgb + acc * 0.6, uStreak * edge);
        float ang = atan(d.y, d.x);
        float lines = pow(abs(sin(ang * 70.0)), 10.0) * edge;
        tex.rgb += lines * uStreak * vec3(0.45, 0.75, 1.0) * 0.5;
      }
      gl_FragColor = tex;
    }
  `,
};

export function createPostFX(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  profile: QualityProfile,
): PostFX {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.85, 0.7, 0.85);
  bloom.enabled = profile.bloom;
  composer.addPass(bloom);

  const vig = new ShaderPass(VignetteStreakShader);
  composer.addPass(vig);

  if (profile.postProcessing) {
    // SMAAPass sizes itself from the composer in current three.js (no ctor args).
    const smaa = new SMAAPass();
    smaa.setSize(size.x, size.y);
    composer.addPass(smaa);
  }

  composer.addPass(new OutputPass());

  return {
    composer,
    enabled: profile.postProcessing,
    setSpeedStreak(v: number) {
      vig.uniforms.uStreak.value = profile.speedStreaks ? v : 0;
    },
    resize(w, h, dpr) {
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
      bloom.setSize(w * dpr, h * dpr);
    },
    render() {
      composer.render();
    },
  };
}

// ---------------------------------------------------------------------------
// Debris burst pool (recycled)
// ---------------------------------------------------------------------------

export interface Debris {
  group: THREE.Group;
  burst(at: THREE.Vector3): void;
  update(dt: number): void;
  reset(): void;
}

export function createDebris(): Debris {
  const group = new THREE.Group();
  const count = CRASH.debrisCount;
  const geos = [
    new THREE.BoxGeometry(0.22, 0.22, 0.22),
    new THREE.TetrahedronGeometry(0.2),
    new THREE.BoxGeometry(0.4, 0.05, 0.28),
  ];
  const mats = [
    new THREE.MeshStandardMaterial({ color: PALETTE.miamiBlue, metalness: 0.6, roughness: 0.3, emissive: PALETTE.miamiBlue, emissiveIntensity: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0xff9b4a, metalness: 0.4, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0x333340, metalness: 0.7, roughness: 0.4 }),
  ];
  const vel: THREE.Vector3[] = [];
  const spin: THREE.Vector3[] = [];
  const pieces: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geos[i % geos.length], mats[i % mats.length]);
    m.visible = false;
    m.castShadow = true;
    group.add(m);
    pieces.push(m);
    vel.push(new THREE.Vector3());
    spin.push(new THREE.Vector3());
  }
  let live = false;
  let ttl = 0;

  function burst(at: THREE.Vector3) {
    live = true;
    ttl = 2.4;
    for (let i = 0; i < count; i++) {
      const m = pieces[i];
      m.visible = true;
      m.position.copy(at);
      m.position.y += 0.6;
      vel[i].set((Math.random() - 0.5) * 10, 3 + Math.random() * 9, (Math.random() - 0.5) * 8 - 2);
      spin[i].set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    }
  }

  function update(dt: number) {
    if (!live) return;
    ttl -= dt;
    for (let i = 0; i < count; i++) {
      const m = pieces[i];
      if (!m.visible) continue;
      vel[i].y -= 22 * dt; // gravity
      m.position.addScaledVector(vel[i], dt);
      m.rotation.x += spin[i].x * dt;
      m.rotation.y += spin[i].y * dt;
      if (m.position.y < 0.1) {
        m.position.y = 0.1;
        vel[i].y *= -0.35;
        vel[i].x *= 0.6;
        vel[i].z *= 0.6;
      }
    }
    if (ttl <= 0) reset();
  }

  function reset() {
    live = false;
    for (const m of pieces) m.visible = false;
  }

  return { group, burst, update, reset };
}
