import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isUserSite = repositoryName?.endsWith(".github.io") ?? false;
const base =
  process.env.GITHUB_ACTIONS === "true" && repositoryName && !isUserSite
    ? `/${repositoryName}/`
    : "/";

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/@firebase/firestore/")) return "firebase-firestore";
          if (id.includes("/node_modules/@firebase/auth/")) return "firebase-auth";
          if (id.includes("/node_modules/@firebase/")) return "firebase-core";
          if (id.includes("/node_modules/react")) return "react-vendor";
        },
      },
    },
  },
});
