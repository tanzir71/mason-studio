import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const api = "http://127.0.0.1:39765";

export default defineConfig({
  plugins: [react()],
  root: "src/ui",
  build: { outDir: "../../dist/ui", emptyOutDir: true },
  server: { port: 5173, proxy: { "/api": api, "/p/": api, "/mcp": api } },
});
