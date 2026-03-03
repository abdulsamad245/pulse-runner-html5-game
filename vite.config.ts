import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages project site base path: https://<user>.github.io/pulse-runner-html5-game/
  base: "/pulse-runner-html5-game/",
  server: {
    host: true,
    port: 5173
  }
});
