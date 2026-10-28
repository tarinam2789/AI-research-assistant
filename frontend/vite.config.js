import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const target = process.env.BACKEND_URL || "http://web:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      "/api": target,
      "/ws": { target, ws: true },
    },
  },
});
