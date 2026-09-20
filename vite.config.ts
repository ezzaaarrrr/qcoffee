import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: {
        entry: "server",
      },
    }),
    nitro(),
    react(),
    tailwindcss(),
  ],

  server: {
    watch: {
      ignored: ["**/.output/**", "**/.vinxi/**", "**/dist/**"],
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
    tsconfigPaths: true,
  },
});