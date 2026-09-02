"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * The neon background, drawn full-screen behind every page.
 *
 * The bands wave, and waving is the only motion they are allowed — a sideways
 * drift, and nothing else. Two different things used to move them on top of
 * that, and both are dealt with separately from the animation:
 *
 *  1. The viewport. This is what showed up as drifting while you scrolled:
 *     iOS Safari hides and shows the URL bar as you scroll, the viewport
 *     height changes under it, and a canvas sized to 100% of that height gets
 *     stretched — so the whole pattern slid with the bar. The canvas now takes
 *     a fixed pixel size with the bar's travel to spare at both ends, offset
 *     by half of it, so the bar can come and go without the canvas changing
 *     size, moving, or leaving an unpainted edge. It is rebuilt only for a
 *     rotation or a real window resize.
 *
 *  2. The frame rate. The wave used to advance a fixed step per frame, so it
 *     genuinely ran twice as fast on a 120Hz phone as on a 60Hz one. It moves
 *     on elapsed time now, so the wave is the same speed everywhere.
 *
 * What is left is deliberately cheap: half the pixels an iPhone would ask for,
 * a quarter of the frames a ProMotion screen would run, and nothing at all
 * while the tab is in the background.
 */

// An iPhone reports 3, which for soft bands with no fine detail buys nothing
// and costs 2.25x the fragment work of 2.
const MAX_PIXEL_RATIO = 2;

// Roughly 30fps. Back up from 20 along with the speed below: the wave now
// crosses about two pixels per frame, which is where 20 would start to look
// stepped rather than smooth.
const FRAME_MS = 1000 / 30;

// How far the wave travels per second. Half the original 0.6, which was fast
// enough to read as something happening on the screen, and well clear of the
// 0.12 that was slow enough to look stopped. A full wave passes in about
// twenty seconds.
const TIME_PER_SECOND = 0.3;

// Spare height above and below the viewport. iOS's URL bar is around 60-90px,
// so this covers it coming and going without the canvas ever being touched.
const VIEWPORT_SLOP = 160;

// Wave height. This is the waviness: at 0.25 the bands were nearly flat, and
// the original 0.5 threw them out to the top and bottom edges. This keeps a
// full wave while staying gathered around the middle of the screen.
const Y_SCALE = 0.45;

type Uniforms = {
  resolution: { value: [number, number] };
  time: { value: number };
  xScale: { value: number };
  yScale: { value: number };
  distortion: { value: number };
};

export function WebGLShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const vertexShader = `
      attribute vec3 position;
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform float xScale;
      uniform float yScale;
      uniform float distortion;

      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);

        float d = length(p) * distortion;

        float rx = p.x * (1.0 + d);
        float gx = p.x;
        float bx = p.x * (1.0 - d);

        float r = 0.05 / abs(p.y + sin((rx + time) * xScale) * yScale);
        float g = 0.05 / abs(p.y + sin((gx + time) * xScale) * yScale);
        float b = 0.05 / abs(p.y + sin((bx + time) * xScale) * yScale);

        gl_FragColor = vec4(r, g, b, 1.0);
      }
    `;

    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setClearColor(new THREE.Color(0x000000));

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1);

    const uniforms: Uniforms = {
      resolution: { value: [window.innerWidth, window.innerHeight] },
      time: { value: 0 },
      xScale: { value: 1.0 },
      yScale: { value: Y_SCALE },
      distortion: { value: 0.05 },
    };

    const position = [
      -1.0, -1.0, 0.0,
       1.0, -1.0, 0.0,
      -1.0,  1.0, 0.0,
       1.0, -1.0, 0.0,
      -1.0,  1.0, 0.0,
       1.0,  1.0, 0.0,
    ];

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(position), 3));

    const material = new THREE.RawShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const draw = () => renderer.render(scene, camera);

    let lastWidth = 0;
    let lastHeight = 0;

    const layout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      // A URL bar sliding in or out is not a layout change. Ignoring it is what
      // keeps the pattern anchored: the canvas is not resized and not moved, so
      // the wave carries on waving exactly where it was.
      if (width === lastWidth && Math.abs(height - lastHeight) < VIEWPORT_SLOP) return;
      lastWidth = width;
      lastHeight = height;

      // Overshoot the viewport at both ends and pull it up by half, so the
      // canvas stays centred on the screen and the URL bar's travel is already
      // painted in either direction.
      const drawHeight = height + VIEWPORT_SLOP * 2;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${drawHeight}px`;
      canvas.style.top = `${-VIEWPORT_SLOP}px`;

      renderer.setSize(width, drawHeight, false);
      uniforms.resolution.value = [width, drawHeight];
      draw();
    };

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    let frameId: number | null = null;
    let lastFrame = 0;
    let lastTick = 0;

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      if (now - lastFrame < FRAME_MS) return;
      // Advance by real elapsed time, so the wave rolls at one speed on a 60Hz
      // screen, a 120Hz one, and under the frame cap.
      const elapsed = lastTick ? (now - lastTick) / 1000 : 0;
      lastTick = now;
      lastFrame = now;
      uniforms.time.value += Math.min(elapsed, 0.1) * TIME_PER_SECOND;
      draw();
    };

    const start = () => {
      if (frameId !== null) return;
      // A fresh timestamp, or the first frame back would jump the wave by
      // however long the page spent in the background.
      lastTick = 0;
      frameId = requestAnimationFrame(animate);
    };

    const stop = () => {
      if (frameId === null) return;
      cancelAnimationFrame(frameId);
      frameId = null;
    };

    // Nothing to animate when the page isn't on screen. Coming back must not
    // start a loop that reduced motion asked us never to run.
    const onVisibility = () => {
      if (document.hidden) stop();
      else if (!reducedMotion?.matches) start();
    };

    layout(); // sizes the canvas and paints the first frame
    if (!reducedMotion?.matches) start();

    window.addEventListener("resize", layout);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      window.removeEventListener("resize", layout);
      document.removeEventListener("visibilitychange", onVisibility);
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  // Sized and positioned entirely from the effect: a CSS height of 100% would
  // track the viewport, which is the thing being avoided.
  return <canvas ref={canvasRef} className="absolute left-0 block" />;
}
