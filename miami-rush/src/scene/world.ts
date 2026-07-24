import * as THREE from "three";
import { PALETTE, ROAD } from "../config";
import type { QualityProfile } from "../ui/settings";

/**
 * The scrolling golden-hour world: asphalt highway, barriers with emissive
 * delineators, overhead exit gantries, curved palms, streetlight glow pools,
 * two rows of condo/glass-tower facades on the left, sand + lifeguard towers +
 * animated ocean on the right, sunset clouds, and the big low sun.
 *
 * Endless illusion: the road/barrier/ocean textures scroll, while discrete
 * props live in recycled pools that wrap from the near end back to the far end.
 */

const FAR = ROAD.drawDistance; // props span z from +near to -FAR
const NEAR = 40;

export interface World {
  group: THREE.Group;
  sunMesh: THREE.Mesh;
  update(dt: number, speed: number): void;
  applyQuality(profile: QualityProfile): void;
  dispose(): void;
}

// --- texture helpers -------------------------------------------------------

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, alpha: number) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const v = Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgba(${v},${v},${v + 6},${alpha})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

function asphaltTexture(): { map: THREE.CanvasTexture; rough: THREE.CanvasTexture } {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 1024;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#26243a";
  ctx.fillRect(0, 0, c.width, c.height);
  noise(ctx, c.width, c.height, 9000, 0.5);

  // lane wear streaks
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#000";
  for (const lx of [0.19, 0.42, 0.58, 0.81]) {
    ctx.fillRect(lx * c.width - 10, 0, 20, c.height);
  }
  ctx.globalAlpha = 1;

  // edge lines
  ctx.fillStyle = "#e9dcc0";
  ctx.fillRect(6, 0, 6, c.height);
  ctx.fillRect(c.width - 12, 0, 6, c.height);

  // dashed lane dividers (3 interior dividers)
  ctx.fillStyle = "#e9dcc0";
  for (const dx of [0.31, 0.5, 0.69]) {
    for (let y = 0; y < c.height; y += 96) {
      ctx.fillRect(dx * c.width - 3, y, 6, 52);
    }
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.repeat.set(1, 22);
  map.anisotropy = 8;

  // roughness map: darker streaks = smoother (polished by tyres)
  const rc = document.createElement("canvas");
  rc.width = 128;
  rc.height = 512;
  const rctx = rc.getContext("2d")!;
  rctx.fillStyle = "#cfcfcf";
  rctx.fillRect(0, 0, rc.width, rc.height);
  rctx.fillStyle = "#8a8a8a";
  for (const lx of [0.19, 0.42, 0.58, 0.81]) rctx.fillRect(lx * rc.width - 8, 0, 16, rc.height);
  const rough = new THREE.CanvasTexture(rc);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  rough.repeat.set(1, 22);

  return { map, rough };
}

function windowTexture(warm: boolean): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = warm ? "#2a2036" : "#17203a";
  ctx.fillRect(0, 0, c.width, c.height);
  const cols = 7;
  const rows = 16;
  const gw = c.width / cols;
  const gh = c.height / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = Math.random();
      let col = "#0d1428";
      if (lit > 0.72) col = warm ? "#ffcf8a" : "#8fd8ff";
      else if (lit > 0.5) col = warm ? "#c98b52" : "#3a6a9a";
      ctx.fillStyle = col;
      ctx.fillRect(x * gw + 2, y * gh + 2, gw - 4, gh - 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// --- prop pool -------------------------------------------------------------

interface Prop {
  obj: THREE.Object3D;
  span: number; // total z length of the pool loop
  onWrap?: (obj: THREE.Object3D) => void;
}

// --- builders --------------------------------------------------------------

function makePalm(): THREE.Group {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a34, roughness: 0.9 });
  let prev = new THREE.Vector3(0, 0, 0);
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - i * 0.02, 0.2 - i * 0.02, 1.1, 7), trunkMat);
    const bend = i * i * 0.09;
    seg.position.set(prev.x + bend * 0.4, i * 1.05 + 0.5, 0);
    seg.rotation.z = -bend * 0.35;
    seg.castShadow = true;
    g.add(seg);
    prev = seg.position;
  }
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2f8f5a, roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.6, 4), frondMat);
    const a = (i / 7) * Math.PI * 2;
    frond.position.set(prev.x + Math.cos(a) * 0.9, prev.y + 0.6, Math.sin(a) * 0.9);
    frond.rotation.set(Math.PI / 2.4, a, Math.cos(a) * 0.5);
    frond.castShadow = true;
    g.add(frond);
  }
  return g;
}

function makeStreetlight(side: number): THREE.Group {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a34, roughness: 0.6, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 7, 8), poleMat);
  pole.position.y = 3.5;
  pole.castShadow = true;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.12), poleMat);
  arm.position.set(-side * 1.0, 6.9, 0);
  g.add(arm);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffddaa, emissive: 0xffbb66, emissiveIntensity: 2.4 });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.35), lampMat);
  lamp.position.set(-side * 2.0, 6.8, 0);
  g.add(lamp);
  // glow pool on the ground
  const poolMat = new THREE.MeshBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.2, 20), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(-side * 2.0, 0.05, 0);
  g.add(pool);
  return g;
}

function makeLifeguardTower(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: PALETTE.duskRose, roughness: 0.7 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x8a4a66, roughness: 0.8 });
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 6), legMat);
    leg.position.set(x * 1.2, 1.1, z * 1.2);
    g.add(leg);
  }
  const hut = new THREE.Mesh(new THREE.BoxGeometry(3, 1.7, 3), bodyMat);
  hut.position.y = 3.0;
  hut.castShadow = true;
  g.add(hut);
  const roofMat = new THREE.MeshStandardMaterial({ color: PALETTE.coral, roughness: 0.6 });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.1, 4), roofMat);
  roof.position.y = 4.35;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  return g;
}

function makeBuilding(far: boolean): THREE.Mesh {
  const h = far ? 22 + Math.random() * 46 : 12 + Math.random() * 26;
  const w = 8 + Math.random() * 10;
  const d = 8 + Math.random() * 8;
  const warm = Math.random() > 0.5;
  const tex = windowTexture(warm);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.round(w / 3), Math.round(h / 3));
  const mat = new THREE.MeshStandardMaterial({
    color: warm ? 0x3a2f4a : 0x263048,
    roughness: warm ? 0.6 : 0.2,
    metalness: warm ? 0.2 : 0.7,
    emissiveMap: tex,
    emissive: 0xffffff,
    emissiveIntensity: 0.6,
    map: tex,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.userData.baseH = h;
  return m;
}

function makeGantry(text: string): THREE.Group {
  const g = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.6, metalness: 0.7 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD.width + 6, 0.5, 0.5), steelMat);
  beam.position.y = 6.4;
  g.add(beam);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 6.6, 8), steelMat);
    post.position.set(sx * (ROAD.width / 2 + 2.6), 3.3, 0);
    g.add(post);
  }
  // green sign with text
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0f7a3a";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#eafff0";
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, c.width - 16, c.height - 16);
  ctx.fillStyle = "#eafff0";
  ctx.font = "italic 700 58px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, c.width / 2, c.height / 2 + 4);
  const signTex = new THREE.CanvasTexture(c);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.5 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(9, 2.3, 0.2), signMat);
  sign.position.set(0, 5.4, 0.1);
  g.add(sign);
  return g;
}

// --- main ------------------------------------------------------------------

export function createWorld(envMap: THREE.Texture | null, profile: QualityProfile): World {
  const group = new THREE.Group();
  const props: Prop[] = [];
  let scroll = 0;

  // ---- Road ----
  const { map: asphMap, rough: asphRough } = asphaltTexture();
  const roadMat = new THREE.MeshStandardMaterial({
    map: asphMap,
    roughnessMap: asphRough,
    roughness: 1,
    metalness: 0,
    color: 0x9a97b0,
  });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD.width, FAR + NEAR + 80), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.z = -(FAR - NEAR) / 2;
  road.receiveShadow = true;
  group.add(road);

  // faint ground either side (dark grass/sand base)
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2e2740, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, FAR + NEAR + 80), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, road.position.z);
  ground.receiveShadow = true;
  group.add(ground);

  // ---- Barriers + instanced delineator posts ----
  const barrierMat = new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.85 });
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, FAR + NEAR + 80), barrierMat);
    wall.position.set(sx * (ROAD.width / 2 + 0.3), 0.5, road.position.z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }
  // emissive posts along both barriers (instanced, scrolled via offset)
  const postCount = 120;
  const postGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);
  const postMat = new THREE.MeshStandardMaterial({ color: PALETTE.miamiBlue, emissive: PALETTE.miamiBlue, emissiveIntensity: 1.6 });
  const posts = new THREE.InstancedMesh(postGeo, postMat, postCount * 2);
  const dummy = new THREE.Object3D();
  const postSpacing = (FAR + NEAR) / postCount;
  const layoutPosts = (offset: number) => {
    let i = 0;
    for (let s = 0; s < 2; s++) {
      const sx = s === 0 ? -1 : 1;
      for (let p = 0; p < postCount; p++) {
        let z = NEAR - ((p * postSpacing + offset) % (FAR + NEAR));
        z = z; // world z (negative ahead)
        dummy.position.set(sx * (ROAD.width / 2 + 0.55), 0.9, z);
        dummy.updateMatrix();
        posts.setMatrixAt(i++, dummy.matrix);
      }
    }
    posts.instanceMatrix.needsUpdate = true;
  };
  layoutPosts(0);
  group.add(posts);

  // ---- Streetlights (both sides) ----
  const lightSpacing = 46;
  const lightCount = Math.ceil((FAR + NEAR) / lightSpacing);
  for (let s = 0; s < 2; s++) {
    const sx = s === 0 ? -1 : 1;
    for (let i = 0; i < lightCount; i++) {
      const l = makeStreetlight(sx);
      l.position.set(sx * (ROAD.width / 2 + 1.2), 0, NEAR - i * lightSpacing);
      group.add(l);
      props.push({ obj: l, span: lightCount * lightSpacing });
    }
  }

  // ---- Palms (both sides, staggered) ----
  const palmSpacing = 30;
  const palmCount = Math.ceil((FAR + NEAR) / palmSpacing);
  for (let s = 0; s < 2; s++) {
    const sx = s === 0 ? -1 : 1;
    for (let i = 0; i < palmCount; i++) {
      const p = makePalm();
      p.position.set(sx * (ROAD.width / 2 + 3.2 + Math.random() * 1.5), 0, NEAR - i * palmSpacing - (s ? palmSpacing / 2 : 0));
      p.rotation.y = Math.random() * Math.PI;
      p.scale.setScalar(0.85 + Math.random() * 0.4);
      group.add(p);
      props.push({ obj: p, span: palmCount * palmSpacing });
    }
  }

  // ---- Left skyline: two depth rows of buildings ----
  const rows = profile.buildingRows;
  const bSpacing = 34;
  const bCount = Math.ceil((FAR + NEAR) / bSpacing);
  for (let r = 0; r < rows; r++) {
    const far = r === 1;
    const baseX = -(ROAD.width / 2 + (far ? 62 : 30));
    for (let i = 0; i < bCount; i++) {
      const b = makeBuilding(far);
      b.position.set(baseX + (Math.random() - 0.5) * 14, (b.userData.baseH as number) / 2, NEAR - i * bSpacing - (far ? bSpacing / 2 : 0));
      // rooftop clutter + blinking beacon
      const beaconMat = new THREE.MeshStandardMaterial({ color: PALETTE.coral, emissive: PALETTE.coral, emissiveIntensity: 2 });
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), beaconMat);
      beacon.position.set(0, (b.userData.baseH as number) / 2 + 0.4, 0);
      beacon.userData.blink = Math.random() * Math.PI * 2;
      b.add(beacon);
      group.add(b);
      props.push({
        obj: b,
        span: bCount * bSpacing,
        onWrap: (o) => {
          const nh = far ? 22 + Math.random() * 46 : 12 + Math.random() * 26;
          o.userData.baseH = nh;
          (o as THREE.Mesh).geometry.dispose();
          const w = 8 + Math.random() * 10;
          const d = 8 + Math.random() * 8;
          (o as THREE.Mesh).geometry = new THREE.BoxGeometry(w, nh, d);
          o.position.y = nh / 2;
        },
      });
    }
  }

  // ---- Right side: sand strip, lifeguard towers, ocean ----
  const sandMat = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 });
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(40, FAR + NEAR + 80), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(ROAD.width / 2 + 22, 0.01, road.position.z);
  sand.receiveShadow = true;
  group.add(sand);

  const towerSpacing = 150;
  const towerCount = Math.ceil((FAR + NEAR) / towerSpacing) + 1;
  for (let i = 0; i < towerCount; i++) {
    const t = makeLifeguardTower();
    t.position.set(ROAD.width / 2 + 16, 0, NEAR - i * towerSpacing);
    group.add(t);
    props.push({ obj: t, span: towerCount * towerSpacing });
  }

  // Ocean — glossy plane; the sky's sun disc reflects as a streak. Swell animated.
  const oceanGeo = new THREE.PlaneGeometry(260, FAR + NEAR + 200, 40, 60);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0e6a8a,
    roughness: 0.12,
    metalness: 0.5,
    envMap: envMap ?? null,
    envMapIntensity: 1.6,
  });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(ROAD.width / 2 + 150, -0.6, road.position.z);
  group.add(ocean);
  const oceanBase = (oceanGeo.attributes.position.array as Float32Array).slice();

  // ---- Overhead exit gantries ----
  const gantryTexts = ["MIAMI BEACH ↑", "OCEAN DR EXIT 2A", "SOUTH POINTE ↑", "DOWNTOWN EXIT 1B"];
  const gantrySpacing = 220;
  const gantryCount = Math.ceil((FAR + NEAR) / gantrySpacing) + 1;
  for (let i = 0; i < gantryCount; i++) {
    const g = makeGantry(gantryTexts[i % gantryTexts.length]);
    g.position.set(0, 0, NEAR - i * gantrySpacing);
    group.add(g);
    props.push({ obj: g, span: gantryCount * gantrySpacing });
  }

  // ---- Sunset clouds (billboards near horizon) ----
  const clouds: THREE.Sprite[] = [];
  const cloudCanvas = document.createElement("canvas");
  cloudCanvas.width = 256;
  cloudCanvas.height = 128;
  const cctx = cloudCanvas.getContext("2d")!;
  const cg = cctx.createRadialGradient(128, 64, 10, 128, 64, 120);
  cg.addColorStop(0, "rgba(255,200,150,0.9)");
  cg.addColorStop(0.5, "rgba(201,93,138,0.5)");
  cg.addColorStop(1, "rgba(201,93,138,0)");
  cctx.fillStyle = cg;
  cctx.fillRect(0, 0, 256, 128);
  const cloudTex = new THREE.CanvasTexture(cloudCanvas);
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.8, depthWrite: false });
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(cloudMat);
    s.scale.set(60 + Math.random() * 60, 24 + Math.random() * 20, 1);
    s.position.set((Math.random() - 0.4) * 260, 40 + Math.random() * 40, -FAR + 40 + Math.random() * 60);
    group.add(s);
    clouds.push(s);
  }

  // ---- The sun (bright disc for bloom to grab) ----
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff2d6, fog: false });
  const sunMesh = new THREE.Mesh(new THREE.CircleGeometry(26, 48), sunMat);
  sunMesh.position.set(2, 20, -FAR - 30);
  group.add(sunMesh);
  const sunGlowMat = new THREE.SpriteMaterial({ map: cloudTex, color: 0xffd9a0, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const sunGlow = new THREE.Sprite(sunGlowMat);
  sunGlow.scale.set(160, 120, 1);
  sunGlow.position.copy(sunMesh.position);
  group.add(sunGlow);

  // --- update ---
  let blinkT = 0;
  function update(dt: number, speed: number) {
    const move = speed * dt;
    scroll += move;

    // scroll road + ground + barrier + sand textures via the road map offset
    asphMap.offset.y = (scroll / (FAR + NEAR + 80)) * 22;
    asphRough.offset.y = asphMap.offset.y;

    // instanced posts scroll
    layoutPosts(scroll % (FAR + NEAR));

    // move + wrap discrete props
    for (const p of props) {
      p.obj.position.z += move;
      if (p.obj.position.z > NEAR + 6) {
        p.obj.position.z -= p.span;
        p.onWrap?.(p.obj);
      }
    }

    // blink rooftop beacons
    blinkT += dt;
    for (const p of props) {
      const beacon = p.obj.children?.find((ch) => (ch as THREE.Mesh).userData?.blink !== undefined) as THREE.Mesh | undefined;
      if (beacon) {
        const mat = beacon.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1.2 + Math.sin(blinkT * 3 + (beacon.userData.blink as number)) * 1.2;
      }
    }

    // ocean swell (cheap vertex sine)
    const pos = oceanGeo.attributes.position;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const bx = oceanBase[i];
      const by = oceanBase[i + 1];
      arr[i + 2] = Math.sin(bx * 0.06 + blinkT * 1.3) * 0.5 + Math.cos(by * 0.05 - blinkT * 0.9) * 0.5;
    }
    pos.needsUpdate = true;

    // drift clouds slowly
    for (const c of clouds) {
      c.position.x += dt * 1.5;
      if (c.position.x > 160) c.position.x = -160;
    }
  }

  function applyQuality(p: QualityProfile) {
    // building rows are fixed at build; nothing hot-swappable here for now
    void p;
  }

  function dispose() {
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }

  return { group, sunMesh, update, applyQuality, dispose };
}
