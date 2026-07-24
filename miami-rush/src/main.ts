import "./style.css";
import { Game } from "./game/game";

const app = document.getElementById("app")!;
const hudRoot = document.createElement("div");
document.body.appendChild(hudRoot);

// Kill iOS pinch-zoom / double-tap-zoom / long-press menu so touch steering is clean.
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false },
);
let lastTouch = 0;
document.addEventListener(
  "touchend",
  (e) => {
    const now = Date.now();
    if (now - lastTouch < 300) e.preventDefault();
    lastTouch = now;
  },
  { passive: false },
);

new Game(app, hudRoot);
