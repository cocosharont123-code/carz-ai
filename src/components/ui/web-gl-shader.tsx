"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * The neon background, drawn full-screen behind every page.
 *
 * It is a still image. Nothing animates it, and nothing is allowed to move it:
 *
 *  1. It renders exactly one frame. There is no animation loop at all, so
 *     there is no per-frame GPU cost and nothing competing with a scroll.
 *
 *  2. The canvas is taller than the viewport and is never resized while you
 *     scroll. This is the part that used to make the bands drift: iOS Safari
 *     hides and shows the URL bar as you scroll, the viewport height changes
 *     under it, and a canvas sized to 100% of that height gets stretched — so
 *     the pattern slid with the bar. It now gets a fixed pixel size with the
 *     bar's travel to spare at both ends, offset by half of that, so the bar
 *     can come and go without the canvas changing size, moving, or leaving an
 *     unpainted edge behind.
 *
 * The buffer is only rebuilt for a real layout change — a rotation, or a
 * desktop window actually being resized — which is why the height threshold
 * has to be bigger than a URL bar.
 */

// An iPhone reports 3, which for soft bands with no fine detail buys nothing
// and costs 2.25x the fragment work of 2.
const MAX_PIXEL_RATIO = 2;

// Spare height above and below the viewport. iOS's URL bar is around 60-90px,
// so this covers it coming and going without the canvas ever being touched.
const VIEWPORT_SLOP = 160;

// How far the bands stray from the centre line. Lower keeps them gathered
// around the middle of the screen instead of sweeping out to the edges.
const Y_SCALE = 0.25;

// Which moment of the — no longer running — animation to freeze on.
const FROZEN_TIME = 0;

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
      time: { value: FROZEN_TIME },
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

    let lastWidth = 0;
    let lastHeight = 0;

    const layout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      // A URL bar sliding in or out is not a layout change. Ignoring it is what
      // keeps the bands still: the canvas is not resized, not repainted, and
      // above all not moved.
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
      renderer.render(scene, camera);
    };

    layout();
    // Only fires for a rotation or a real window resize; `layout` discards
    // everything smaller than that itself.
    window.addEventListener("resize", layout);

    return () => {
      window.removeEventListener("resize", layout);
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
