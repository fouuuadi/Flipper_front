import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// Cible du backend en dev local (override possible via VITE_DEV_API_TARGET).
const DEV_BACKEND = process.env.VITE_DEV_API_TARGET ?? "http://localhost:8080";

export default defineConfig({
  // En dev, Vite joue le rôle du reverse-proxy de prod : il route `/api` et
  // `/ws` vers le backend, pour que le front utilise les mêmes URLs relatives
  // partout (cf. src/config/env.ts).
  server: {
    proxy: {
      "/api": {
        target: DEV_BACKEND,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/ws": {
        target: DEV_BACKEND.replace(/^http/, "ws"),
        ws: true,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
      "@engine": fileURLToPath(new URL("./src/engine", import.meta.url)),
      "@config": fileURLToPath(new URL("./src/config", import.meta.url)),
      "@modules": fileURLToPath(new URL("./src/modules", import.meta.url)),
      "@physics": fileURLToPath(new URL("./src/physics", import.meta.url)),
      "@services": fileURLToPath(new URL("./src/services", import.meta.url)),
      "@utils": fileURLToPath(new URL("./src/utils", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        playfield: fileURLToPath(
          new URL("./apps/playfield/index.html", import.meta.url),
        ),
        backglass: fileURLToPath(
          new URL("./apps/backglass/index.html", import.meta.url),
        ),
        dmd: fileURLToPath(new URL("./apps/dmd/index.html", import.meta.url)),
      },
    },
  },
});
