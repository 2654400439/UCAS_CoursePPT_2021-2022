import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Use relative base so the same build works for:
// - GitHub Pages under /username.github.io/<repo-name>/
// - local file preview / other static hosts
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    // On some Windows setups file watching can be flaky; polling is slower but much more reliable.
    watch: {
      usePolling: true,
      interval: 200,
    },
  },
});


