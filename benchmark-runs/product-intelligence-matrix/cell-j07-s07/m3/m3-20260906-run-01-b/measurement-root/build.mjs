#!/usr/bin/env node
/**
 * build.mjs — 产出自包含的 dist/index.html（CSS/JS 全部内联）。
 * 零依赖：仅用 Node 内置模块。产物可直接 file:// 静态打开。
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFile(join(root, f), "utf8");

const html = await read("index.html");
const css = await read("styles.css");
const js = await read("app.js");

const inlined = html
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script src="app.js"></script>', () => `<script>\n${js}\n</script>`);

if (/<link|src="app\.js"/.test(inlined)) {
  console.error("build failed: unresolved external references");
  process.exit(1);
}

await mkdir(join(root, "dist"), { recursive: true });
await writeFile(join(root, "dist", "index.html"), inlined, "utf8");
console.log("dist/index.html written (%s KB)", Math.round(inlined.length / 1024));
