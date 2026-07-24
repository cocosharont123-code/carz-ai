import { SCORING } from "../config";

/** Score = distance in metres + near-miss points. Near misses chain a combo. */
export class Scoring {
  distance = 0; // metres
  nearMissPoints = 0;
  combo = 0;
  private comboTimer = 0;

  get score(): number {
    return Math.floor(this.distance) + this.nearMissPoints;
  }

  addDistance(metres: number): void {
    this.distance += metres;
  }

  /** Register a near miss; returns points awarded and the resulting combo. */
  registerNearMiss(): { points: number; combo: number } {
    this.combo = Math.min(SCORING.comboCap, this.combo + 1);
    this.comboTimer = SCORING.comboWindow;
    const points = SCORING.nearMissBase * this.combo;
    this.nearMissPoints += points;
    return { points, combo: this.combo };
  }

  update(dt: number): void {
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
  }

  reset(): void {
    this.distance = 0;
    this.nearMissPoints = 0;
    this.combo = 0;
    this.comboTimer = 0;
  }
}
