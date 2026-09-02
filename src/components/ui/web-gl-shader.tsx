"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * The neon background, drawn full-screen behind every page.
 *
 * It is an ambient effect, so it is deliberately not drawn as well or as often
 * as it could be. Four limits keep it off the main thread's back, and they
 * matter most on an iPhone, where scrolling used to make it stutter:
 *
 *  1. Device pixel ratio is capped. An iPhone reports 3, and a full-screen
 *     fragment shader at 3x is nine times the pixels of 1x — about three
 *     million per frame. This shader is soft bands with no fine detail, so 2x
 *     looks the same and costs less than half as much.
 *
 *  2. It runs at ~30fps, not at the display's refresh rate. A ProMotion iPhone
 *     asks for 120, which for a gradient this slow is four frames of GPU work
 *     to show what one frame would.
 *
 *  3. The animation advances on elapsed time rather than per frame. It used to
 *     add a fixed step per frame, so it genuinely ran twice as fast on a 120Hz
 *     phone as on a 60Hz one — and would have changed speed again under the
 *     frame cap above.
 *
 *  4. Height-only resizes are ignored. This is the one that made scrolling
 *     stutter: iOS Safari hides and shows the URL bar as you scroll, which
 *     fires `resize`, and reallocating the drawing buffer mid-scroll is one of
 *     the most expensive things a page can do. The canvas is a fixed
 *     full-bleed gradient, so letting it stretch by the height of the URL bar
 *     is invisible; rebuilding it is not.
 */

// An iPhone's 3 buys nothing here and costs 2.25x the fragment work of 2.
const MAX_PIXEL_RATIO = 2;

// Roughly 30fps. The bands drift slowly enough that more is spent, not seen.
const FRAME_MS = 1000 / 30;

// How far the pattern advances per second. Matches the previous look at 60fps
// (0.01 per frame) now that it no longer depends on the frame rate.
const TIME_PER_SECOND = 0.6;

// iOS shows/hides a URL bar around 60-90px tall. A height change bigger than
// this is a real layout change — a rotation, or a resized desktop window — and
// does need the buffer rebuilt.
const URL_BAR_SLOP = 120;

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
      yScale: { value: 0.5 },
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

    let lastWidth = 0;
    let lastHeight = 0;

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      // The expensive part. Skip it for the URL bar sliding in and out.
      if (width === lastWidth && Math.abs(height - lastHeight) < URL_BAR_SLOP) return;
      lastWidth = width;
      lastHeight = height;
      renderer.setSize(width, height, false);
      uniforms.resolution.value = [width, height];
      // With the loop stopped — reduced motion, or a backgrounded tab — nothing
      // else will repaint, and the old frame would sit there stretched.
      if (frameId === null) draw();
    };

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    let frameId: number | null = null;
    let lastFrame = 0;
    let lastTick = 0;

    const draw = () => renderer.render(scene, camera);

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      if (now - lastFrame < FRAME_MS) return;
      // Advance by real elapsed time, so the drift is the same speed on a
      // 60Hz screen, a 120Hz one, and under the frame cap.
      const elapsed = lastTick ? (now - lastTick) / 1000 : 0;
      lastTick = now;
      lastFrame = now;
      uniforms.time.value += Math.min(elapsed, 0.1) * TIME_PER_SECOND;
      draw();
    };

    const start = () => {
      if (frameId !== null) return;
      // A fresh timestamp, or the first frame back would jump by however long
      // the page spent in the background.
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

    resize(); // sizes the buffer, and paints the first frame
    if (!reducedMotion?.matches) start();

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />;
}
