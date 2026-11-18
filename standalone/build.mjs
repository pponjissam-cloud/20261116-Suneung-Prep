#!/usr/bin/env node
/**
 * HTML 단독 실행판 빌드: 앱 전체(화면 + 분석 로직 + CSS)를 HTML 파일 하나로 묶는다.
 *
 *   pnpm build:html        →  dist/suneung-analyzer.html
 *
 * - 서버 API 대신 브라우저에서 Anthropic API를 직접 호출하는 모듈로 바꿔 끼운다 (standalone/*.ts)
 * - Tailwind CSS 는 소스에서 쓰인 클래스만 뽑아 인라인으로 넣는다
 * 의존성: esbuild, tailwindcss (devDependencies)
 */
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outFile = path.join(root, "dist", "suneung-analyzer.html");

// 패키지 위치: 프로젝트 node_modules 우선, 필요하면 EXTRA_NODE_PATHS(콜론 구분)도 찾아본다
const searchPaths = [root, ...(process.env.EXTRA_NODE_PATHS ?? "").split(":").filter(Boolean)];
const require = createRequire(import.meta.url);
const load = async (name) => import(pathToFileURL(require.resolve(name, { paths: searchPaths })).href);
const pkgDir = (name) => path.dirname(require.resolve(`${name}/package.json`, { paths: searchPaths }));

const esbuild = await load("esbuild");
const tw = await load("tailwindcss");
const compile = tw.compile ?? tw.default?.compile; // CJS·ESM 어느 쪽으로 불려도

// 버전 = 빌드 시각 (한국 시간)
const appVersion = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ");

// ───────── 1. JS 번들 ─────────
const sub = (p) => path.join(here, p);
const ALIASES = {
  "server-only": sub("shims/server-only.ts"),
  "next/link": sub("shims/next-link.tsx"),
  "next/navigation": sub("shims/next-navigation.ts"),
  "@/lib/client-api": sub("client-api.ts"),
  "@/lib/llm": sub("browser-llm.ts"),
};

/** 서버 전용 모듈을 브라우저용으로 바꿔 끼우는 플러그인 */
const swapPlugin = {
  name: "standalone-swap",
  setup(build) {
    build.onResolve({ filter: /^(server-only|next\/link|next\/navigation|@\/lib\/client-api|@\/lib\/llm)$/ }, (a) => ({ path: ALIASES[a.path] }));
    // lib/ 안에서 상대 경로로 부르는 ./llm 도 바꾼다
    build.onResolve({ filter: /^\.\/llm$/ }, (a) =>
      path.resolve(a.resolveDir) === path.join(root, "lib") ? { path: ALIASES["@/lib/llm"] } : undefined,
    );
  },
};

const result = await esbuild.build({
  entryPoints: [sub("main.tsx")],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: ["chrome111", "safari16", "firefox113"],
  minify: true,
  legalComments: "none",
  jsx: "automatic",
  tsconfig: path.join(root, "tsconfig.json"),
  nodePaths: searchPaths.map((p) => (p === root ? path.join(root, "node_modules") : p)),
  // 화면에 보이는 버전 (어느 파일을 열었는지 헷갈리지 않게)
  define: { "process.env.NODE_ENV": '"production"', __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [swapPlugin],
  logOverride: { "unsupported-directive": "silent" },
  logLevel: "warning",
});
let js = result.outputFiles[0].text;
// HTML 안에 넣을 때 스크립트가 일찍 닫히지 않게
js = js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

// ───────── 2. CSS (Tailwind v4) ─────────
async function listFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFiles(p)));
    else if (/\.(tsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}
const sources = (await Promise.all(["app", "components", "lib", "standalone"].map((d) => listFiles(path.join(root, d))))).flat();
const candidates = new Set();
for (const f of sources) for (const tok of (await readFile(f, "utf8")).split(/[\s"'`{}<>,;]+/)) if (tok && tok.length < 120) candidates.add(tok);

const twDir = pkgDir("tailwindcss");
const compiler = await compile(await readFile(path.join(root, "app", "globals.css"), "utf8"), {
  base: path.join(root, "app"),
  async loadStylesheet(id, base) {
    const file = id === "tailwindcss" ? path.join(twDir, "index.css") : id.startsWith("tailwindcss/") ? path.join(twDir, `${id.slice(12)}.css`) : path.resolve(base, id);
    return { path: file, base: path.dirname(file), content: await readFile(file, "utf8") };
  },
});
const css = compiler.build([...candidates]);

// ───────── 3. HTML 하나로 ─────────
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const built = appVersion;
const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>수능 지문 분석기</title>
<meta name="generator" content="suneung-passage-app ${pkg.version} (${built})">
<style>${css}</style>
</head>
<body class="min-h-screen antialiased">
<div id="root"></div>
<noscript>이 앱은 JavaScript가 필요합니다.</noscript>
<script>${js}</script>
</body>
</html>
`;
await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, html);
console.log(`✓ ${path.relative(root, outFile)}  (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
