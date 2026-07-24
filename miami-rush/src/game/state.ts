/** Game state machine: menu / playing / paused / crashing / over. */

export type GameState = "menu" | "playing" | "paused" | "crashing" | "over";

export class StateMachine {
  private _state: GameState = "menu";
  private listeners = new Set<(s: GameState, prev: GameState) => void>();

  get state(): GameState {
    return this._state;
  }

  is(...states: GameState[]): boolean {
    return states.includes(this._state);
  }

  set(next: GameState): void {
    if (next === this._state) return;
    const prev = this._state;
    this._state = next;
    for (const l of this.listeners) l(next, prev);
  }

  onChange(fn: (s: GameState, prev: GameState) => void): void {
    this.listeners.add(fn);
  }
}
