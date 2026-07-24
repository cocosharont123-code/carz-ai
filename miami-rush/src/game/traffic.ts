import * as THREE from "three";
import { ROAD, TRAFFIC } from "../config";
import { buildCar, type CarParts, type Variant } from "../scene/cars";

/**
 * Pooled traffic. Cars move relative to the fixed player (world scrolls toward
 * +z at the player's speed, so a car closes at playerSpeed - carSpeed). Cars
 * keep distance in-lane, occasionally change lanes with clearance checks, and
 * spawning never fills all four lanes in one z-band.
 */

export interface TrafficCar {
  parts: CarParts;
  group: THREE.Group;
  variant: Variant;
  lane: number;
  speed: number;
  active: boolean;
  changing: boolean;
  targetLane: number;
  laneCooldown: number;
  scored: boolean; // near-miss already counted for this pass
  halfWidth: number;
  halfLength: number;
}

const VARIANTS: Variant[] = ["sedan", "suv", "taxi", "van", "sedan", "suv"];

export class Traffic {
  cars: TrafficCar[] = [];
  group = new THREE.Group();
  private playerBaseSpeed = 30;
  private spawnTimer = 0;
  private maxActive: number;

  constructor(envMap: THREE.Texture | null, maxCars: number) {
    this.maxActive = maxCars;
    for (let i = 0; i < maxCars; i++) {
      const variant = VARIANTS[i % VARIANTS.length];
      const parts = buildCar(variant, envMap);
      parts.group.visible = false;
      // approximate half-extents from variant footprint
      const bbox = new THREE.Box3().setFromObject(parts.group);
      const size = bbox.getSize(new THREE.Vector3());
      this.group.add(parts.group);
      this.cars.push({
        parts,
        group: parts.group,
        variant,
        lane: 0,
        speed: 0,
        active: false,
        changing: false,
        targetLane: 0,
        laneCooldown: 0,
        scored: false,
        halfWidth: size.x / 2,
        halfLength: size.z / 2,
      });
    }
  }

  setPlayerBaseSpeed(v: number): void {
    this.playerBaseSpeed = v;
  }

  private activeCount(): number {
    let n = 0;
    for (const c of this.cars) if (c.active) n++;
    return n;
  }

  /** Frontmost (most negative z) active car in a lane, or null. */
  private frontmostInLane(lane: number): TrafficCar | null {
    let best: TrafficCar | null = null;
    for (const c of this.cars) {
      if (!c.active || c.lane !== lane) continue;
      if (!best || c.group.position.z < best.group.position.z) best = c;
    }
    return best;
  }

  /** Nearest active car ahead of `me` in its lane (smaller z). */
  private aheadInLane(me: TrafficCar): TrafficCar | null {
    let best: TrafficCar | null = null;
    for (const c of this.cars) {
      if (!c.active || c === me || c.lane !== me.lane) continue;
      if (c.group.position.z < me.group.position.z) {
        if (!best || c.group.position.z > best.group.position.z) best = c;
      }
    }
    return best;
  }

  private laneClear(lane: number, z: number, clearance: number): boolean {
    for (const c of this.cars) {
      if (!c.active || c.lane !== lane) continue;
      if (Math.abs(c.group.position.z - z) < clearance) return false;
    }
    return true;
  }

  private trySpawn(): void {
    if (this.activeCount() >= this.maxActive) return;

    // Which lanes have room at the spawn line?
    const openLanes: number[] = [];
    for (let lane = 0; lane < ROAD.laneCount; lane++) {
      const front = this.frontmostInLane(lane);
      if (!front || front.group.position.z > TRAFFIC.spawnAheadZ + TRAFFIC.spawnGapMin) openLanes.push(lane);
    }
    // Never let all 4 lanes be blocked in the same z-band: if only one lane has
    // room at the spawn line, leave it open as the player's escape route.
    if (openLanes.length <= 1) return;

    const lane = openLanes[Math.floor(Math.random() * openLanes.length)];
    const slot = this.cars.find((c) => !c.active);
    if (!slot) return;

    const frac = TRAFFIC.speedFracMin + Math.random() * (TRAFFIC.speedFracMax - TRAFFIC.speedFracMin);
    slot.active = true;
    slot.lane = lane;
    slot.targetLane = lane;
    slot.changing = false;
    slot.laneCooldown = TRAFFIC.laneChangeCooldown * (0.5 + Math.random());
    slot.speed = this.playerBaseSpeed * frac;
    slot.scored = false;
    slot.group.visible = true;
    slot.group.position.set(ROAD.laneCenters[lane], 0, TRAFFIC.spawnAheadZ - Math.random() * 30);
    slot.group.rotation.set(0, 0, 0);
  }

  update(dt: number, playerSpeed: number): void {
    // spawn cadence
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.trySpawn();
      this.spawnTimer = 0.35 + Math.random() * 0.4;
    }

    for (const c of this.cars) {
      if (!c.active) continue;

      // distance-keeping: don't overtake the car ahead in-lane
      let effSpeed = c.speed;
      const ahead = this.aheadInLane(c);
      if (ahead) {
        const gap = c.group.position.z - ahead.group.position.z;
        if (gap < TRAFFIC.minGapSameLane) effSpeed = Math.min(effSpeed, ahead.speed);
      }

      // lane changes
      c.laneCooldown -= dt;
      if (!c.changing && c.laneCooldown <= 0) {
        if (Math.random() < TRAFFIC.laneChangeChance * dt * 4) {
          const options: number[] = [];
          if (c.lane > 0) options.push(c.lane - 1);
          if (c.lane < ROAD.laneCount - 1) options.push(c.lane + 1);
          const pick = options[Math.floor(Math.random() * options.length)];
          if (pick !== undefined && this.laneClear(pick, c.group.position.z, TRAFFIC.laneChangeClearance)) {
            c.changing = true;
            c.targetLane = pick;
            c.laneCooldown = TRAFFIC.laneChangeCooldown;
          } else {
            c.laneCooldown = 0.6;
          }
        } else {
          c.laneCooldown = 0.4;
        }
      }
      if (c.changing) {
        const targetX = ROAD.laneCenters[c.targetLane];
        const dx = targetX - c.group.position.x;
        const step = Math.sign(dx) * TRAFFIC.laneChangeSpeed * dt;
        if (Math.abs(step) >= Math.abs(dx)) {
          c.group.position.x = targetX;
          c.lane = c.targetLane;
          c.changing = false;
        } else {
          c.group.position.x += step;
        }
        c.group.rotation.y = THREE.MathUtils.clamp(dx * 0.12, -0.18, 0.18);
      } else {
        c.group.rotation.y *= 1 - Math.min(1, dt * 8);
      }

      // move relative to player
      const rel = playerSpeed - effSpeed;
      c.group.position.z += rel * dt;

      // spin wheels by relative motion
      for (const w of c.parts.wheels) w.rotation.x -= rel * dt * 1.6;

      // recycle when well behind
      if (c.group.position.z > TRAFFIC.despawnBehindZ) {
        c.active = false;
        c.group.visible = false;
      }
    }
  }

  reset(): void {
    for (const c of this.cars) {
      c.active = false;
      c.group.visible = false;
    }
    this.spawnTimer = 0;
  }
}
