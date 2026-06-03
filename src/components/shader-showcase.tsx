"use client";

import { Canvas } from "@react-three/fiber";
import { ShaderPlane, EnergyRing } from "@/components/ui/background-paper-shaders";

export default function ShaderShowcase() {
  return (
    <Canvas camera={{ position: [0, 0, 3], fov: 60 }} dpr={[1, 1.5]}>
      <ShaderPlane position={[-0.6, 0, 0]} color1="#ff5722" color2="#7c5cff" />
      <ShaderPlane position={[0.6, 0, -0.2]} color1="#38bdf8" color2="#ffffff" />
      <EnergyRing radius={1.1} position={[0, 0, 0.4]} />
    </Canvas>
  );
}
