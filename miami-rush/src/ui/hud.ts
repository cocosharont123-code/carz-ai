import type { Quality } from "./settings";

/** Formats a number with thousands separators (tabular-friendly). */
const fmt = (n: number): string => Math.floor(n).toLocaleString("en-US");

export interface OverStats {
  distance: number;
  score: number;
  topSpeedKmh: number;
  best: number;
  isNewBest: boolean;
}

export interface HudCallbacks {
  onStart(): void;
  onResume(): void;
  onRestart(): void;
  onPause(): void;
  onToggleMute(): void;
  onQuality(q: Quality): void;
}

export class Hud {
  private root: HTMLElement;
  private el: Record<string, HTMLElement> = {};
  private floaters: HTMLElement;

  constructor(root: HTMLElement, cb: HudCallbacks, quality: Quality) {
    this.root = root;
    root.innerHTML = this.template();
    this.floaters = root.querySelector("#floaters")!;
    for (const id of ["score", "combo", "dist", "speed", "mute", "pause", "veil-menu", "veil-pause", "veil-over", "over-stats", "best-flag"]) {
      this.el[id] = root.querySelector(`#${id}`)!;
    }

    root.querySelector("#cta-start")!.addEventListener("click", cb.onStart);
    root.querySelector("#cta-resume")!.addEventListener("click", cb.onResume);
    root.querySelector("#cta-restart")!.addEventListener("click", cb.onRestart);
    this.el.pause.addEventListener("click", cb.onPause);
    this.el.mute.addEventListener("click", cb.onToggleMute);

    root.querySelectorAll<HTMLButtonElement>(".gfx button").forEach((b) => {
      b.addEventListener("click", () => {
        cb.onQuality(b.dataset.q as Quality);
        this.setQuality(b.dataset.q as Quality);
      });
    });
    this.setQuality(quality);
  }

  private template(): string {
    return `
      <div class="hud" id="hud">
        <div class="hud__chip hud__score">
          <div class="eyebrow">Score</div>
          <div class="value tnum" id="score">0</div>
          <div class="hud__combo" id="combo"></div>
        </div>
        <div class="hud__chip hud__dist">
          <div class="value tnum" id="dist">0</div>
          <div class="unit">metres</div>
        </div>
        <div class="hud__speed">
          <div class="value tnum" id="speed">0</div>
          <div class="unit">km/h</div>
        </div>
        <div class="hud__nitro"><span class="dot"></span><span class="label">Nitro Open</span></div>
        <div class="hud__buttons">
          <button class="iconbtn" id="pause" aria-label="Pause">&#10073;&#10073;</button>
          <button class="iconbtn" id="mute" aria-label="Mute">&#128266;</button>
        </div>
      </div>
      <div class="floaters" id="floaters"></div>

      <div class="veil" id="veil-menu">
        <div class="title"><span class="miami">Miami</span> <span class="rush">Rush</span></div>
        <div class="tagline">Nitro&rsquo;s welded open. Traffic&rsquo;s thick.</div>
        <button class="cta" id="cta-start">Start engine</button>
        <div class="gfx">
          <span class="lbl">Graphics</span>
          <button data-q="high">High</button>
          <button data-q="medium">Medium</button>
          <button data-q="low">Low</button>
        </div>
        <div class="hint">Drag anywhere to steer &middot; arrow keys / A&ndash;D on desktop</div>
      </div>

      <div class="veil hidden" id="veil-pause">
        <div class="title"><span class="rush">Paused</span></div>
        <button class="cta" id="cta-resume">Resume</button>
      </div>

      <div class="veil hidden" id="veil-over">
        <div class="title"><span class="miami">Wasted</span></div>
        <div class="stats" id="over-stats"></div>
        <div class="best-flag" id="best-flag"></div>
        <button class="cta" id="cta-restart">Run it back</button>
      </div>
    `;
  }

  setScore(v: number): void {
    this.el.score.textContent = fmt(v);
  }

  setCombo(combo: number): void {
    if (combo > 1) {
      this.el.combo.textContent = `Near-miss chain ×${combo}`;
      this.el.combo.classList.add("on");
    } else {
      this.el.combo.classList.remove("on");
    }
  }

  setDistance(m: number): void {
    this.el.dist.textContent = fmt(m);
  }

  setSpeed(kmh: number): void {
    this.el.speed.textContent = fmt(kmh);
  }

  setMuteIcon(muted: boolean): void {
    this.el.mute.innerHTML = muted ? "&#128263;" : "&#128266;";
  }

  setQuality(q: Quality): void {
    this.root.querySelectorAll<HTMLButtonElement>(".gfx button").forEach((b) => {
      b.classList.toggle("active", b.dataset.q === q);
    });
  }

  /** Spawn a floating +points text at a screen coordinate. */
  floater(text: string, x: number, y: number): void {
    const f = document.createElement("div");
    f.className = "floater";
    f.textContent = text;
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    f.style.fontSize = "22px";
    this.floaters.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }

  showMenu(): void {
    this.toggleVeil("veil-menu");
  }
  showPause(): void {
    this.toggleVeil("veil-pause");
  }
  showOver(stats: OverStats): void {
    this.el["over-stats"].innerHTML = `
      <div class="stat"><div class="k">Distance</div><div class="v">${fmt(stats.distance)} m</div></div>
      <div class="stat"><div class="k">Score</div><div class="v">${fmt(stats.score)}</div></div>
      <div class="stat"><div class="k">Top speed</div><div class="v">${fmt(stats.topSpeedKmh)} km/h</div></div>
      <div class="stat"><div class="k">Session best</div><div class="v">${fmt(stats.best)}</div></div>
    `;
    this.el["best-flag"].textContent = stats.isNewBest ? "★ New session best" : "";
    this.toggleVeil("veil-over");
  }
  showPlaying(): void {
    this.toggleVeil(null);
  }

  private toggleVeil(show: string | null): void {
    for (const id of ["veil-menu", "veil-pause", "veil-over"]) {
      this.el[id].classList.toggle("hidden", id !== show);
    }
  }
}
