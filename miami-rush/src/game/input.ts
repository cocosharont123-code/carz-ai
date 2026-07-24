import { ROAD } from "../config";

/**
 * Steering input. Drag anywhere: the target x maps to the finger's horizontal
 * position across the viewport. Desktop: arrow keys / A-D nudge the target.
 * The car itself eases toward `target` (handled in the game loop) for snappy
 * lerp with body roll.
 */
export class Input {
  target = 0; // desired world-x for the player car
  pointerActive = false;
  private keyLeft = false;
  private keyRight = false;
  private readonly keySpeed = 17; // world units/sec via keyboard
  private el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    el.addEventListener("pointerdown", this.onDown, { passive: false });
    el.addEventListener("pointermove", this.onMove, { passive: false });
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
  }

  private mapX(clientX: number): number {
    const norm = (clientX / window.innerWidth) * 2 - 1; // -1..1
    return Math.max(ROAD.steerMin, Math.min(ROAD.steerMax, norm * (ROAD.steerMax + 0.5)));
  }

  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    this.pointerActive = true;
    this.target = this.mapX(e.clientX);
  };

  private onMove = (e: PointerEvent) => {
    if (!this.pointerActive) return;
    e.preventDefault();
    this.target = this.mapX(e.clientX);
  };

  private onUp = () => {
    this.pointerActive = false;
  };

  private onKey = (e: KeyboardEvent) => {
    const down = e.type === "keydown";
    switch (e.key) {
      case "ArrowLeft":
      case "a":
      case "A":
        this.keyLeft = down;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        this.keyRight = down;
        break;
    }
  };

  /** Advance keyboard steering. Pointer steering is event-driven. */
  update(dt: number): void {
    if (this.pointerActive) return;
    let dir = 0;
    if (this.keyLeft) dir -= 1;
    if (this.keyRight) dir += 1;
    if (dir !== 0) {
      this.target = Math.max(ROAD.steerMin, Math.min(ROAD.steerMax, this.target + dir * this.keySpeed * dt));
    }
  }

  reset(): void {
    this.target = 0;
    this.pointerActive = false;
    this.keyLeft = this.keyRight = false;
  }

  dispose(): void {
    this.el.removeEventListener("pointerdown", this.onDown);
    this.el.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
  }
}
