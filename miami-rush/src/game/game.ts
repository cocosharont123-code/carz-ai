import * as THREE from "three";
import { CAMERA, CRASH, MS_TO_KMH, PLAYER, ROAD, SCORING } from "../config";
import { createLighting, type LightingRig } from "../scene/lighting";
import { createWorld, type World } from "../scene/world";
import { buildCar, loadModelManifest, type CarParts } from "../scene/cars";
import { createPostFX, createDebris, type PostFX, type Debris } from "../scene/effects";
import { Traffic } from "./traffic";
import { Input } from "./input";
import { Scoring } from "./scoring";
import { StateMachine } from "./state";
import { AudioEngine } from "../audio/engine";
import { Hud } from "../ui/hud";
import { detectQuality, profileFor, prefersReducedMotion, type Quality, type QualityProfile } from "../ui/settings";

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();

  private lighting: LightingRig;
  private world: World;
  private player!: CarParts;
  private traffic: Traffic;
  private post: PostFX;
  private debris: Debris;
  private audio = new AudioEngine();
  private input: Input;
  private scoring = new Scoring();
  private state = new StateMachine();
  private hud: Hud;

  private quality: Quality;
  private profile: QualityProfile;
  private reduced = prefersReducedMotion();

  // run state
  private playerX = 0;
  private elapsedPlay = 0;
  private speed: number = PLAYER.baseSpeedStart;
  private topSpeed = 0;
  private best = 0;
  private timescale = 1;
  private shakeT = 0;
  private crashTimer = 0;
  private flash!: HTMLElement;

  constructor(mount: HTMLElement, hudRoot: HTMLElement) {
    this.quality = detectQuality();
    this.profile = profileFor(this.quality);

    // renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.profile.pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = this.profile.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(this.renderer.domElement);

    // camera
    this.camera = new THREE.PerspectiveCamera(CAMERA.fovBase, window.innerWidth / window.innerHeight, 0.1, 800);
    this.camera.position.set(...CAMERA.position);
    this.camera.lookAt(...CAMERA.lookAt);

    // scene pieces
    this.lighting = createLighting(this.renderer, this.scene);
    this.lighting.applyQuality(this.profile);
    this.world = createWorld(this.lighting.envTexture, this.profile);
    this.scene.add(this.world.group);

    this.player = buildCar("player", this.lighting.envTexture);
    this.player.group.position.set(0, 0, ROAD.playerZ);
    this.scene.add(this.player.group);

    this.traffic = new Traffic(this.lighting.envTexture, this.profile.trafficMax);
    this.scene.add(this.traffic.group);

    this.debris = createDebris();
    this.scene.add(this.debris.group);

    this.post = createPostFX(this.renderer, this.scene, this.camera, this.profile);

    // input + hud
    this.input = new Input(this.renderer.domElement);
    this.hud = new Hud(hudRoot, {
      onStart: () => this.begin(),
      onResume: () => this.resume(),
      onRestart: () => this.begin(),
      onPause: () => this.pause(),
      onToggleMute: () => this.hud.setMuteIcon(this.audio.toggleMute()),
      onQuality: (q) => this.setQuality(q),
    }, this.quality);

    // red-flash overlay
    this.flash = document.createElement("div");
    Object.assign(this.flash.style, {
      position: "fixed",
      inset: "0",
      background: "radial-gradient(ellipse at center, rgba(255,60,60,0.55), rgba(255,0,0,0.15))",
      opacity: "0",
      pointerEvents: "none",
      zIndex: "15",
      transition: "opacity 0.08s",
    } as CSSStyleDeclaration);
    document.body.appendChild(this.flash);

    // try to upgrade to real glTF models in the background
    void this.tryModels();

    // events
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state.is("playing")) this.pause();
    });

    this.hud.showMenu();
    this.renderer.setAnimationLoop(this.tick);
  }

  private async tryModels(): Promise<void> {
    const models = await loadModelManifest(this.lighting.envTexture);
    // Model integration hook: real glTF swap-in is wired here when assets exist.
    if (Object.keys(models).length > 0) {
      // Replace the player mesh with the glTF hero if provided.
      const hero = models.player;
      if (hero) {
        this.player.group.clear();
        this.player.group.add(hero);
      }
    }
  }

  // --- state transitions ---
  private begin(): void {
    this.audio.ensure();
    this.audio.startEngine();
    this.resetRun();
    this.state.set("playing");
    this.hud.showPlaying();
  }
  private pause(): void {
    if (!this.state.is("playing")) return;
    this.state.set("paused");
    this.audio.suspend();
    this.hud.showPause();
  }
  private resume(): void {
    if (!this.state.is("paused")) return;
    this.audio.resume();
    this.state.set("playing");
    this.hud.showPlaying();
  }
  private toOver(): void {
    this.state.set("over");
    const score = this.scoring.score;
    const isNewBest = score > this.best;
    if (isNewBest) this.best = score;
    this.hud.showOver({
      distance: this.scoring.distance,
      score,
      topSpeedKmh: Math.round(this.topSpeed * MS_TO_KMH),
      best: this.best,
      isNewBest,
    });
  }

  private resetRun(): void {
    this.scoring.reset();
    this.input.reset();
    this.traffic.reset();
    this.debris.reset();
    this.playerX = 0;
    this.elapsedPlay = 0;
    this.speed = PLAYER.baseSpeedStart;
    this.topSpeed = 0;
    this.timescale = 1;
    this.shakeT = 0;
    this.player.group.position.set(0, 0, ROAD.playerZ);
    this.player.group.rotation.set(0, 0, 0);
  }

  private setQuality(q: Quality): void {
    this.quality = q;
    this.profile = profileFor(q);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.profile.pixelRatioCap));
    this.renderer.shadowMap.enabled = this.profile.shadows;
    this.renderer.shadowMap.needsUpdate = true;
    this.lighting.applyQuality(this.profile);
    this.post.enabled = this.profile.postProcessing;
    this.onResize();
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio, this.profile.pixelRatioCap);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.post.resize(w, h, dpr);
  };

  // --- crash ---
  private crash(at: THREE.Vector3): void {
    this.state.set("crashing");
    this.timescale = CRASH.slowMoScale;
    this.shakeT = CRASH.shakeDuration;
    this.crashTimer = 1.5;
    this.debris.burst(at);
    this.audio.crash();
    this.flash.style.opacity = "1";
    setTimeout(() => (this.flash.style.opacity = "0"), 90);
  }

  // --- per-frame ---
  private tick = (): void => {
    const dtReal = Math.min(this.clock.getDelta(), 0.05);

    // slow-mo easing during/after crash
    if (this.state.is("crashing")) {
      this.timescale = Math.min(1, this.timescale + CRASH.slowMoRecover * dtReal);
    }
    const dt = dtReal * (this.state.is("paused") || this.state.is("over") ? 0 : this.timescale);

    this.input.update(dtReal);

    if (this.state.is("playing")) this.simulate(dt, dtReal);
    else if (this.state.is("menu")) this.idleCruise(dt);
    else if (this.state.is("crashing")) this.simulateCrash(dt, dtReal);

    this.updateCamera(dtReal);

    if (this.post.enabled) this.post.render();
    else this.renderer.render(this.scene, this.camera);
  };

  private updateSpeed(dt: number): void {
    this.elapsedPlay += dt;
    const t = Math.min(1, this.elapsedPlay / PLAYER.speedRampTime);
    this.speed = PLAYER.baseSpeedStart + (PLAYER.baseSpeedMax - PLAYER.baseSpeedStart) * t;
    this.topSpeed = Math.max(this.topSpeed, this.speed);
    this.traffic.setPlayerBaseSpeed(this.speed);
  }

  private steerPlayer(dt: number): void {
    const alpha = 1 - Math.exp(-dt * 60 * PLAYER.steerLerp);
    this.playerX += (this.input.target - this.playerX) * alpha;
    this.playerX = Math.max(ROAD.steerMin, Math.min(ROAD.steerMax, this.playerX));
    this.player.group.position.x = this.playerX;

    const steerFrac = THREE.MathUtils.clamp((this.input.target - this.playerX) / 3, -1, 1);
    this.player.group.rotation.y = steerFrac * PLAYER.maxYaw;
    this.player.group.rotation.z = this.reduced ? 0 : -steerFrac * PLAYER.maxRoll;

    // wheels + exhaust flames
    const spin = this.speed * dt * 1.6;
    for (const w of this.player.wheels) w.rotation.x -= spin;
    const frac = this.speedFrac();
    for (const f of this.player.flames) {
      f.scale.set(1, 1, 0.7 + frac * 0.9 + Math.sin(this.elapsedPlay * 40 + f.position.x) * 0.2);
      (f.material as THREE.MeshBasicMaterial).opacity = 0.6 + frac * 0.4;
    }
  }

  private speedFrac(): number {
    return (this.speed - PLAYER.baseSpeedStart) / (PLAYER.baseSpeedMax - PLAYER.baseSpeedStart);
  }

  private simulate(dt: number, dtReal: number): void {
    this.updateSpeed(dt);
    this.steerPlayer(dt);

    // capture pre-move z for near-miss crossing detection
    for (const c of this.traffic.cars) if (c.active) c.group.userData.prevZ = c.group.position.z;

    this.traffic.update(dt, this.speed);
    this.world.update(dt, this.speed);

    this.scoring.addDistance(this.speed * dt);
    this.scoring.update(dtReal);

    this.checkInteractions();

    // HUD
    this.hud.setScore(this.scoring.score);
    this.hud.setDistance(this.scoring.distance);
    this.hud.setSpeed(this.speed * MS_TO_KMH);
    this.hud.setCombo(this.scoring.combo);

    // speed streaks
    const kmh = this.speed * MS_TO_KMH;
    const streak = THREE.MathUtils.clamp((kmh - CAMERA.streakStartKmh) / (PLAYER.baseSpeedMax * MS_TO_KMH - CAMERA.streakStartKmh), 0, 1);
    this.post.setSpeedStreak(this.reduced ? streak * 0.4 : streak);
  }

  private simulateCrash(dt: number, _dtReal: number): void {
    // keep the world rolling (decelerating feel) + debris while slow-mo eases
    this.world.update(dt, this.speed * 0.4);
    this.traffic.update(dt, this.speed * 0.4);
    this.debris.update(dt);
    this.crashTimer -= _dtReal;
    if (this.crashTimer <= 0 && this.timescale >= 0.98) this.toOver();
  }

  private idleCruise(dt: number): void {
    const cruise = PLAYER.baseSpeedStart * 0.7;
    this.traffic.setPlayerBaseSpeed(cruise);
    this.traffic.update(dt, cruise);
    this.world.update(dt, cruise);
    // gentle centre drift
    this.playerX += (Math.sin(this.clock.elapsedTime * 0.5) * 1.6 - this.playerX) * dt * 2;
    this.player.group.position.x = this.playerX;
    this.player.group.rotation.z = this.reduced ? 0 : -this.playerX * 0.03;
    const spin = cruise * dt * 1.6;
    for (const w of this.player.wheels) w.rotation.x -= spin;
    for (const f of this.player.flames) f.scale.set(1, 1, 0.7 + Math.sin(this.clock.elapsedTime * 20 + f.position.x) * 0.2);
  }

  private tmp = new THREE.Vector3();
  private checkInteractions(): void {
    const pHalfW = PLAYER.halfWidth;
    const pHalfL = PLAYER.halfLength;
    for (const c of this.traffic.cars) {
      if (!c.active) continue;
      const dx = this.playerX - c.group.position.x;
      const dz = ROAD.playerZ - c.group.position.z;
      const adx = Math.abs(dx);
      const adz = Math.abs(dz);

      // collision (AABB)
      if (adx < pHalfW + c.halfWidth && adz < pHalfL + c.halfLength) {
        this.crash(c.group.position.clone());
        return;
      }

      // near-miss: car crossed the player's z-line this frame, within lateral band
      const prevZ = (c.group.userData.prevZ as number) ?? c.group.position.z;
      const crossed = prevZ < ROAD.playerZ && c.group.position.z >= ROAD.playerZ;
      if (crossed && !c.scored && adx <= SCORING.nearMissLateral) {
        c.scored = true;
        const { points, combo } = this.scoring.registerNearMiss();
        this.audio.nearMiss();
        this.tmp.copy(c.group.position);
        this.tmp.y = 1.4;
        this.tmp.project(this.camera);
        const sx = (this.tmp.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-this.tmp.y * 0.5 + 0.5) * window.innerHeight;
        this.hud.floater(combo > 1 ? `+${points} ×${combo}` : `+${points}`, sx, sy);
      }
    }
  }

  private updateCamera(dtReal: number): void {
    const frac = this.state.is("playing") ? this.speedFrac() : 0;
    const fov = CAMERA.fovBase + (CAMERA.fovMax - CAMERA.fovBase) * frac;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    // base camera follows the player x a touch
    const baseX = this.playerX * 0.16;
    let ox = baseX;
    let oy = CAMERA.position[1];

    if (!this.reduced) {
      // speed shake
      const s = frac * CAMERA.speedShake;
      ox += (Math.random() - 0.5) * s;
      oy += (Math.random() - 0.5) * s;
      // crash shake
      if (this.shakeT > 0) {
        this.shakeT -= dtReal;
        const m = (this.shakeT / CRASH.shakeDuration) * CRASH.shakeMagnitude;
        ox += (Math.random() - 0.5) * m;
        oy += (Math.random() - 0.5) * m;
      }
    }
    this.camera.position.x += (ox - this.camera.position.x) * Math.min(1, dtReal * 12);
    this.camera.position.y += (oy - this.camera.position.y) * Math.min(1, dtReal * 12);
    this.camera.lookAt(this.playerX * 0.1, CAMERA.lookAt[1], CAMERA.lookAt[2]);

    if (this.state.is("playing")) this.audio.setSpeed(this.speedFrac());
  }
}
