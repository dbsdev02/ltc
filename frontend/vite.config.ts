import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  // Windows can see the project as both d:\ and D:\; never bundle React twice.
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: "dist",
  },
  // Local development: forward /api to the FastAPI server (cd backend && python -m uvicorn app.main:app --port 8000).
  server: {
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
  preview: {
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
});
