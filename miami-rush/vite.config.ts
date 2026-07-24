import { defineConfig } from "vite";

// Fully static build, no backend. Base is relative so the dist/ folder can be
// dropped anywhere (subpath hosting, itch.io zip, S3, etc.).
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    sourcemap: false,
  },
});
