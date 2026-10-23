import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// 单文件构建：dist/index.html 内联全部 JS/CSS，可直接以 file:// 静态打开。
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: "./",
  build: { target: "es2018" },
});
