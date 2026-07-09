import { build, context } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const clean = args.has("--clean");

const outJs = path.join(root, "index.js");
const outCss = path.join(root, "index.css");

async function rm(filePath) {
  await fs.rm(filePath, { force: true }).catch(() => {});
}

async function copyCss() {
  await fs.copyFile(path.join(root, "src", "style.css"), outCss);
}

async function runBuild() {
  const options = {
    entryPoints: [path.join(root, "src", "index.ts")],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node18",
    outfile: outJs,
    external: ["siyuan"],
    sourcemap: false,
    logLevel: "info",
  };

  if (watch) {
    const ctx = await context(options);
    await ctx.watch();
    await copyCss();
    console.log("Watching src/index.ts and src/style.css ...");
    return;
  }

  await build(options);
  await copyCss();
}

if (clean) {
  await rm(outJs);
  await rm(outCss);
} else {
  await runBuild();
}
