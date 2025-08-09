import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default ({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  return defineConfig({
    plugins: [vue()],
    server: {
      proxy: {
        "/api": `http://${process.env.VITE_HOST || "localhost"}:${process.env.VITE_PORT || 8080}`,
      },
    },
  });
};
