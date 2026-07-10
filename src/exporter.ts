import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { fetchSyncPost } from "siyuan";
import { normalizeCloudPath, joinUrl, mimeFromPath, safeSlug, safeTitleSlug, walkDirRecursive } from "./path";
import { SiyuanCloudApi } from "./cloudApi";
import { deriveRemoteRootFromPublicBaseUrl, type CloudPagesSettings, type SlugMode } from "./settings";

export const SHARED_ASSETS_DIR = "pages-pub-assets";
const SHARED_ASSET_FOLDERS = ["appearance", "stage", "link-icon"];

export interface CurrentDocInfo {
  docId: string;
  title: string;
  source: string;
}

export interface PublishInput {
  docId: string;
  title: string;
  slug: string;
  settings: CloudPagesSettings;
  onProgress?: (percent: number, text: string) => void;
}

export interface PublishOutput {
  exportedTitle: string;
  slug: string;
  url: string;
  previewUrl: string;
  sourceUrl: string;
  remoteRootPath: string;
  remotePagePath: string;
  warnings: string[];
}

export interface DeleteInput {
  slug: string;
  settings: CloudPagesSettings;
  onProgress?: (percent: number, text: string) => void;
}

interface CachedDocInfo extends CurrentDocInfo {
  updatedAt: number;
}

let currentProtyle: any = null;
let lastActiveDocInfo: CachedDocInfo | null = null;

export function setCurrentProtyle(protyle: any): void {
  currentProtyle = protyle || null;
}

export function clearTrackedDocContext(): void {
  currentProtyle = null;
  lastActiveDocInfo = null;
}

export async function refreshTrackedDocInfo(source = "active-protyle"): Promise<CurrentDocInfo> {
  const info = await getCurrentDocInfoSafe({ allowCache: false });
  if (info.docId) {
    return applyCurrentDocInfo({ ...info, source });
  }
  return info;
}

export async function getCurrentDocInfoSafe(options: { allowCache?: boolean } = {}): Promise<CurrentDocInfo> {
  const readers = [
    () => extractDocInfoFromProtyle(currentProtyle, "active-protyle"),
    getCurrentDocInfoFromSelection,
    getCurrentDocInfoFromTab,
    getCurrentDocInfoFromSiyuanLayout,
  ];
  for (const reader of readers) {
    const info = await enrichDocInfo(reader());
    if (info.docId) {
      return applyCurrentDocInfo(info);
    }
  }
  if (options.allowCache !== false) {
    const cached = await getValidatedLastActiveDocInfo();
    if (cached.docId) {
      return applyCurrentDocInfo(cached);
    }
  }
  return { docId: "", title: "", source: "fallback" };
}

export function buildRecordId(docId: string, slug: string): string {
  return `${docId}:${slug}`;
}

export function buildSlug(title: string, docId: string, mode: SlugMode = "title-docid"): string {
  return mode === "title" ? safeTitleSlug(title) : safeSlug(title, docId);
}

export async function publishToSiyuanCloud(input: PublishInput): Promise<PublishOutput> {
  validateSettings(input.settings);
  const api = new SiyuanCloudApi(input.settings.cloudToken);
  const warnings: string[] = [];
  const taskId = crypto.randomUUID();
  const tempRoot = await createTempWorkspaceDir(taskId);
  const slug = input.slug || buildSlug(input.title, input.docId, input.settings.slugMode);
  const targetDir = path.join(tempRoot, slug);
  const sharedRoot = path.join(tempRoot, SHARED_ASSETS_DIR);
  const remoteRootPath = resolveRemoteRootPath(input.settings);
  const remotePagePath = normalizeCloudPath(remoteRootPath, slug);
  const remoteAssetsPath = normalizeCloudPath(remotePagePath, "assets");
  const remoteSharedPath = normalizeCloudPath(remoteRootPath, SHARED_ASSETS_DIR);

  try {
    input.onProgress?.(5, "检查配置");
    await api.listStorages();
    await api.ensureWritable(remoteRootPath);

    input.onProgress?.(12, "读取当前文档");
    const exported = await exportDocumentToTarget({
      docId: input.docId,
      title: input.title,
      slug,
      tempRoot,
      targetDir,
    });

    input.onProgress?.(34, "整理资源");
    consolidateSharedAssets(sharedRoot, targetDir);

    input.onProgress?.(45, "校验资源");
    const validation = validatePublishedHtml(targetDir, tempRoot);
    if (!validation.ok) {
      const issues = [
        validation.invalidPaths.length ? `本地绝对路径: ${validation.invalidPaths.slice(0, 6).join(", ")}` : "",
        validation.missingAssets.length ? `缺失资源: ${validation.missingAssets.slice(0, 6).join(", ")}` : "",
        validation.tempLeaks.length ? `临时目录泄漏: ${validation.tempLeaks.slice(0, 6).join(", ")}` : "",
      ].filter(Boolean).join("；");
      throw new Error(`导出 HTML 校验失败。${issues}`);
    }

    input.onProgress?.(56, "创建远端目录");
    await ensureRemoteDirectories(api, remoteRootPath, remotePagePath, remoteAssetsPath, remoteSharedPath, targetDir, sharedRoot, input.settings.uploadSharedAssets);

    if (input.settings.uploadSharedAssets) {
      input.onProgress?.(68, "上传共享资源");
      await uploadDirectory(api, sharedRoot, remoteSharedPath);
    }

    input.onProgress?.(82, "上传页面资源");
    await uploadPageFiles(api, targetDir, remotePagePath);

    input.onProgress?.(94, "上传 index.html");
    await api.putFileFromDisk(normalizeCloudPath(remotePagePath, "index.html"), path.join(targetDir, "index.html"));

    input.onProgress?.(97, "生成分享链接");
    const encodedSlug = encodeURIComponent(slug);
    const sourceUrl = joinUrl(input.settings.publicBaseUrl, encodedSlug, "index.html");
    const previewUrl = input.settings.previewBaseUrl
      ? joinUrl(input.settings.previewBaseUrl, encodedSlug, "index.html")
      : sourceUrl;
    const url = previewUrl;
    if (!/^https?:\/\//i.test(sourceUrl)) {
      warnings.push("上传成功，但 publicBaseUrl 不是标准 http(s) 地址，生成链接可能不可访问。");
    }
    if (!input.settings.previewBaseUrl) {
      try {
        const previewBehavior = await detectAttachmentDownload(sourceUrl);
        if (previewBehavior === "attachment") {
          warnings.push("当前源文件域名返回 attachment 下载头，浏览器会直接下载而不是在线预览。建议额外配置预览根地址。");
        }
      } catch {
        // Best effort only.
      }
    }

    input.onProgress?.(100, "完成");
    return {
      exportedTitle: exported.exportedTitle || input.title,
      slug,
      url,
      previewUrl,
      sourceUrl,
      remoteRootPath,
      remotePagePath,
      warnings,
    };
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

export async function deleteRemoteShare(input: DeleteInput): Promise<void> {
  validateSettings(input.settings);
  const api = new SiyuanCloudApi(input.settings.cloudToken);
  const remoteRootPath = resolveRemoteRootPath(input.settings);
  input.onProgress?.(20, "检查配置");
  await api.listStorages();
  input.onProgress?.(60, "删除远端目录");
  await api.remove(remoteRootPath, [input.slug]);
  input.onProgress?.(100, "完成");
}

function validateSettings(settings: CloudPagesSettings): void {
  if (!settings.cloudToken) {
    throw new Error("请先配置 siyuan-cloud Token");
  }
  if (!settings.storageId || !settings.storageMountPath) {
    throw new Error("请先选择可用的 S3 挂载");
  }
  if (!settings.publicBaseUrl) {
    throw new Error("publicBaseUrl 未配置，无法生成公网分享链接");
  }
  try {
    const parsed = new URL(settings.publicBaseUrl);
    if (!/^https?:$/i.test(parsed.protocol)) {
      throw new Error("publicBaseUrl 必须是 http(s) 地址");
    }
  } catch {
    throw new Error("publicBaseUrl 必须是完整的 http(s) 地址");
  }
  if (settings.previewBaseUrl) {
    try {
      const parsed = new URL(settings.previewBaseUrl);
      if (!/^https?:$/i.test(parsed.protocol)) {
        throw new Error("previewBaseUrl 必须是 http(s) 地址");
      }
    } catch {
      throw new Error("previewBaseUrl 必须是完整的 http(s) 地址");
    }
  }
}

function resolveRemoteRootPath(settings: CloudPagesSettings): string {
  const derivedRoot = deriveRemoteRootFromPublicBaseUrl(settings.publicBaseUrl);
  return derivedRoot
    ? normalizeCloudPath(settings.storageMountPath, derivedRoot)
    : normalizeCloudPath(settings.storageMountPath);
}

async function detectAttachmentDownload(url: string): Promise<"attachment" | "inline" | "unknown"> {
  const response = await fetch(url, {
    method: "HEAD",
    redirect: "follow",
  });
  if (!response.ok) return "unknown";
  const disposition = String(response.headers.get("content-disposition") || "").toLowerCase();
  const forceAttachment = String(response.headers.get("x-bitiful-force-attachment") || "").toLowerCase();
  if (disposition.includes("attachment") || forceAttachment === "true") {
    return "attachment";
  }
  return "inline";
}

async function createTempWorkspaceDir(taskId: string): Promise<string> {
  const workspaceDir = String(globalThis.window?.siyuan?.config?.system?.workspaceDir || "").trim();
  const base = workspaceDir
    ? path.join(workspaceDir, "temp", "siyuan-cloud-pages")
    : path.join(os.tmpdir(), "siyuan-cloud-pages");
  const dir = path.join(base, taskId);
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

async function exportDocumentToTarget(options: {
  docId: string;
  title: string;
  slug: string;
  tempRoot: string;
  targetDir: string;
}): Promise<{ exportedTitle: string }> {
  const exportStartedAt = Date.now();
  const exportResp = await fetchSyncPost("/api/export/exportHTML", {
    id: options.docId,
    pdf: false,
    removeAssets: false,
    merge: true,
    savePath: "",
  });
  if (!exportResp || exportResp.code !== 0 || !exportResp.data) {
    throw new Error(`导出失败: ${exportResp?.msg || "未知错误"}`);
  }

  ensureEmptyDir(options.targetDir);
  const exportedTitle = String(exportResp.data.name || options.title || "").trim() || options.title;
  let copied = copyNativeExportFolder(exportResp.data.folder, options.targetDir);

  if (!copied) {
    const savedResp = await fetchSyncPost("/api/export/exportHTML", {
      id: options.docId,
      pdf: false,
      removeAssets: false,
      merge: true,
      savePath: options.targetDir,
    });
    if (!savedResp || savedResp.code !== 0 || !savedResp.data) {
      throw new Error(`资源导出失败: ${savedResp?.msg || "未知错误"}`);
    }
    copied = true;
  }

  const content = String(exportResp.data.content || "").trim();
  if (!content) {
    throw new Error("导出结果缺少 HTML 内容");
  }

  const html = buildSiYuanNativeHTML(content, exportedTitle, {
    targetDir: options.targetDir,
    sharedBase: `../${SHARED_ASSETS_DIR}`,
    buildToken: String(exportStartedAt),
  });
  await fsp.writeFile(path.join(options.targetDir, "index.html"), html, "utf8");

  const resolved = resolveExportOutput({
    baseDir: options.tempRoot,
    targetDir: options.targetDir,
    title: options.title,
    exportedTitle,
    slug: options.slug,
    exportStartedAt,
  });
  if (!resolved) {
    throw new Error("导出失败：未找到有效的 index.html");
  }
  return { exportedTitle };
}

function resolveExportOutput(input: {
  baseDir: string;
  targetDir: string;
  title: string;
  exportedTitle: string;
  slug: string;
  exportStartedAt: number;
}): boolean {
  normalizeExportLayout(input.targetDir, input.exportedTitle);
  if (hasIndex(input.targetDir)) {
    return true;
  }

  const candidates = [
    path.join(input.baseDir, input.slug),
    path.join(input.baseDir, input.exportedTitle),
    path.join(input.baseDir, input.title),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) continue;
    normalizeExportLayout(candidate, input.exportedTitle);
    if (hasIndex(candidate)) {
      copyDirToTarget(candidate, input.targetDir);
      return true;
    }
  }

  const flatCandidate = pickRootHtmlCandidate(input.baseDir, input.slug, input.title, input.exportedTitle, input.exportStartedAt);
  if (flatCandidate) {
    buildTargetFromFlatRoot(input.baseDir, input.targetDir, flatCandidate);
    return hasIndex(input.targetDir);
  }

  return false;
}

function hasIndex(dir: string): boolean {
  return fs.existsSync(path.join(dir, "index.html"));
}

function normalizeExportLayout(targetDir: string, exportedTitle: string): void {
  if (!fs.existsSync(targetDir) || hasIndex(targetDir)) return;
  const candidates: string[] = [];
  if (exportedTitle) {
    candidates.push(path.join(targetDir, exportedTitle));
  }
  for (const entry of safeReadDir(targetDir)) {
    if (entry.isDirectory()) {
      candidates.push(path.join(targetDir, entry.name));
    }
  }
  for (const candidate of candidates) {
    if (hasIndex(candidate)) {
      moveChildrenToDir(candidate, targetDir);
      return;
    }
  }
}

function moveChildrenToDir(srcDir: string, dstDir: string): void {
  for (const entry of safeReadDir(srcDir)) {
    const from = path.join(srcDir, entry.name);
    const to = path.join(dstDir, entry.name);
    if (fs.existsSync(to)) {
      fs.rmSync(to, { recursive: true, force: true });
    }
    fs.renameSync(from, to);
  }
  fs.rmSync(srcDir, { recursive: true, force: true });
}

function pickRootHtmlCandidate(baseDir: string, slug: string, title: string, exportedTitle: string, exportStartedAt: number): string | null {
  const candidates = [
    path.join(baseDir, `${slug}.html`),
    path.join(baseDir, `${title}.html`),
    path.join(baseDir, `${exportedTitle}.html`),
  ];
  for (const entry of safeReadDir(baseDir)) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".html") && entry.name.toLowerCase() !== "index.html") {
      candidates.push(path.join(baseDir, entry.name));
    }
  }
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const stat = fs.statSync(candidate);
    if (stat.isFile() && stat.mtimeMs >= exportStartedAt - 30_000) {
      return candidate;
    }
  }
  return null;
}

function buildTargetFromFlatRoot(baseDir: string, targetDir: string, htmlPath: string): void {
  ensureEmptyDir(targetDir);
  fs.copyFileSync(htmlPath, path.join(targetDir, "index.html"));
  for (const name of ["appearance", "stage", "assets", "link-icon"]) {
    const src = path.join(baseDir, name);
    if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
      copyRecursive(src, path.join(targetDir, name));
    }
  }
}

function copyNativeExportFolder(folder: string, targetDir: string): boolean {
  if (!folder) return false;
  const workspaceDir = String(globalThis.window?.siyuan?.config?.system?.workspaceDir || "").trim();
  const candidates = [
    folder,
    path.resolve(folder),
    workspaceDir ? path.join(workspaceDir, folder) : "",
    workspaceDir ? path.join(workspaceDir, "temp", folder) : "",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) continue;
      copyRecursive(candidate, targetDir);
      return true;
    } catch {
      // Try next candidate.
    }
  }
  return false;
}

function consolidateSharedAssets(sharedRoot: string, targetDir: string): void {
  fs.mkdirSync(sharedRoot, { recursive: true });
  for (const name of SHARED_ASSET_FOLDERS) {
    const src = path.join(targetDir, name);
    if (!fs.existsSync(src)) continue;
    copyRecursiveSmart(src, path.join(sharedRoot, name));
    fs.rmSync(src, { recursive: true, force: true });
  }
}

function ensureEmptyDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirToTarget(srcDir: string, targetDir: string): void {
  ensureEmptyDir(targetDir);
  copyRecursive(srcDir, targetDir);
}

function copyRecursive(src: string, dst: string): void {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of safeReadDir(src)) {
      copyRecursive(path.join(src, entry.name), path.join(dst, entry.name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function copyRecursiveSmart(src: string, dst: string): void {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of safeReadDir(src)) {
      copyRecursiveSmart(path.join(src, entry.name), path.join(dst, entry.name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (!fs.existsSync(dst) || fs.statSync(dst).size !== stat.size) {
    fs.copyFileSync(src, dst);
  }
}

function validatePublishedHtml(targetDir: string, tempRoot: string): {
  ok: boolean;
  invalidPaths: string[];
  missingAssets: string[];
  tempLeaks: string[];
} {
  const indexPath = path.join(targetDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    return { ok: false, invalidPaths: [], missingAssets: ["index.html"], tempLeaks: [] };
  }
  const html = fs.readFileSync(indexPath, "utf8");
  const invalidPaths: string[] = [];
  const missingAssets: string[] = [];
  const tempLeaks: string[] = [];

  if (html.includes(tempRoot.replace(/\\/g, "/")) || html.includes(tempRoot.replace(/\//g, "\\"))) {
    tempLeaks.push(tempRoot);
  }

  const parser = getDomParser();
  if (!parser) {
    return { ok: tempLeaks.length === 0, invalidPaths, missingAssets, tempLeaks };
  }

  const doc = parser.parseFromString(html, "text/html");
  for (const el of Array.from(doc.querySelectorAll("link[href], script[src], img[src], source[src]"))) {
    const attr = el.hasAttribute("href") ? "href" : "src";
    const raw = String(el.getAttribute(attr) || "").trim();
    if (!raw || raw.startsWith("#") || isExternalResourceRef(raw)) continue;
    if (isLocalAbsoluteResource(raw)) {
      invalidPaths.push(raw);
      continue;
    }
    const refPath = splitResourceRef(raw).path.replace(/\//g, path.sep);
    const resolved = path.resolve(targetDir, refPath);
    if (!fs.existsSync(resolved)) {
      missingAssets.push(raw);
    }
  }

  return {
    ok: invalidPaths.length === 0 && missingAssets.length === 0 && tempLeaks.length === 0,
    invalidPaths: Array.from(new Set(invalidPaths)),
    missingAssets: Array.from(new Set(missingAssets)),
    tempLeaks: Array.from(new Set(tempLeaks)),
  };
}

function buildSiYuanNativeHTML(content: string, title: string, options: { targetDir: string; sharedBase: string; buildToken: string }): string {
  const prepared = preparePublishedContent(content, {
    targetDir: options.targetDir,
    sharedBase: options.sharedBase,
  });
  const siyuan = (globalThis.window?.siyuan || {}) as any;
  const appearance = (siyuan.config?.appearance || {}) as any;
  const lang = appearance.lang || "zh_CN";
  const lightTheme = appearance.themeLight || "daylight";
  const darkTheme = appearance.themeDark || "midnight";
  const mode = Number(appearance.mode || 0);
  const themeName = mode === 1 ? darkTheme : lightTheme;
  const themeMode = mode === 1 ? "dark" : "light";
  const tocStateClass = prepared.hasToc ? "" : " pages-pub-toc--empty";
  const bodyStateClass = prepared.hasToc ? "" : " pages-pub-no-toc";

  return `<!DOCTYPE html>
<html lang="${escapeAttr(lang)}" data-theme-mode="${escapeAttr(themeMode)}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title || "Untitled")}</title>
  <link rel="stylesheet" href="${escapeAttr(options.sharedBase)}/stage/build/export/base.css?v=${escapeAttr(options.buildToken)}">
  <link rel="stylesheet" href="${escapeAttr(options.sharedBase)}/appearance/themes/${escapeAttr(themeName)}/theme.css?v=${escapeAttr(options.buildToken)}">
  <style>
    body { margin: 0; background: var(--b3-theme-background); color: var(--b3-theme-on-background); }
    .pages-pub-layout { max-width: 1280px; margin: 0 auto; padding: 32px 24px 64px; }
    .pages-pub-main { min-width: 0; margin-left: 320px; }
    .pages-pub-main .protyle-wysiwyg { overflow-x: auto; }
    #pages-pub-toc { position: fixed; top: 24px; left: max(24px, calc(50vw - 616px)); width: 260px; max-height: calc(100vh - 48px); overflow: auto; border: 1px solid var(--b3-border-color); border-radius: 16px; background: color-mix(in srgb, var(--b3-theme-background) 92%, var(--b3-theme-surface) 8%); box-shadow: 0 8px 30px rgba(0,0,0,.08); }
    .pages-pub-toc__head { padding: 16px 16px 10px; border-bottom: 1px solid var(--b3-border-color); }
    .pages-pub-toc__title { font-size: 14px; font-weight: 600; color: var(--b3-theme-on-background); }
    .pages-pub-toc__body { padding: 10px 8px 14px; }
    .pages-pub-toc__list { display: flex; flex-direction: column; gap: 2px; }
    .pages-pub-toc-link { display: block; padding: 7px 10px; border-radius: 10px; color: var(--b3-theme-on-background); text-decoration: none; font-size: 13px; line-height: 1.5; word-break: break-word; transition: background-color .2s, color .2s; }
    .pages-pub-toc-link:hover { background: var(--b3-theme-primary-lightest); color: var(--b3-theme-primary); }
    .pages-pub-toc-link.toc-level-2 { padding-left: 22px; }
    .pages-pub-toc-link.toc-level-3 { padding-left: 34px; }
    .pages-pub-toc-empty { padding: 8px 10px; color: var(--b3-theme-on-surface-light); font-size: 13px; }
    body.pages-pub-no-toc .pages-pub-main { margin-left: 0; }
    #pages-pub-toc.pages-pub-toc--empty { display: none; }
    @media (max-width: 1100px) {
      .pages-pub-layout { padding: 20px 16px 48px; }
      .pages-pub-main { margin-left: 0; }
      #pages-pub-toc { position: static; left: auto; width: auto; max-height: none; margin-bottom: 16px; }
    }
  </style>
</head>
<body class="${bodyStateClass.trim()}">
  <div class="pages-pub-layout">
    <aside id="pages-pub-toc" aria-label="目录" class="${tocStateClass.trim()}">
      <div class="pages-pub-toc__head">
        <div class="pages-pub-toc__title">目录</div>
      </div>
      <div class="pages-pub-toc__body">
        <div class="pages-pub-toc__list">
          ${prepared.tocHtml}
        </div>
      </div>
    </aside>
    <main class="pages-pub-main">
      <div class="protyle-wysiwyg protyle-wysiwyg--attr" id="preview">
        ${prepared.contentHtml}
      </div>
    </main>
  </div>
</body>
</html>`;
}

function preparePublishedContent(content: string, options: { targetDir: string; sharedBase: string }): { contentHtml: string; tocHtml: string; hasToc: boolean } {
  const parser = getDomParser();
  if (!parser) {
    return {
      contentHtml: content,
      tocHtml: '<div class="pages-pub-toc-empty">暂无目录</div>',
      hasToc: false,
    };
  }
  const doc = parser.parseFromString(`<div id="pages-pub-root">${content}</div>`, "text/html");
  const root = doc.getElementById("pages-pub-root");
  if (!root) {
    return {
      contentHtml: content,
      tocHtml: '<div class="pages-pub-toc-empty">暂无目录</div>',
      hasToc: false,
    };
  }

  const copiedMap = new Map<string, string>();
  for (const el of Array.from(root.querySelectorAll("link[href], script[src], img[src], source[src]"))) {
    const attr = el.hasAttribute("href") ? "href" : "src";
    const raw = String(el.getAttribute(attr) || "");
    const rewritten = rewritePublishedResourcePath(raw, {
      targetDir: options.targetDir,
      sharedBase: options.sharedBase,
      copiedMap,
    });
    if (rewritten.ok && rewritten.value !== raw) {
      el.setAttribute(attr, rewritten.value);
    }
  }

  const tocItems = buildStaticTocData(root);
  return {
    contentHtml: root.innerHTML,
    tocHtml: tocItems.length
      ? tocItems.map((item) => `<a class="pages-pub-toc-link toc-level-${item.level}" href="#${escapeAttr(item.id)}">${escapeHtml(item.text)}</a>`).join("")
      : '<div class="pages-pub-toc-empty">暂无目录</div>',
    hasToc: tocItems.length > 0,
  };
}

function rewritePublishedResourcePath(ref: string, options: {
  targetDir: string;
  sharedBase: string;
  copiedMap: Map<string, string>;
}): { ok: boolean; value: string } {
  const { path: rawPath, suffix } = splitResourceRef(ref);
  const trimmed = rawPath.trim();
  if (!trimmed || trimmed.startsWith("#") || isExternalResourceRef(trimmed)) {
    return { ok: true, value: trimmed + suffix };
  }
  if (isLocalAbsoluteResource(trimmed)) {
    const localPath = extractLocalFilePath(trimmed);
    if (!localPath || !fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) {
      return { ok: false, value: ref };
    }
    const copied = copyPublishedDependencyFile(localPath, options.targetDir, options.copiedMap);
    return { ok: true, value: copied + suffix };
  }

  let nextPath = trimmed.replace(/\\/g, "/");
  if (nextPath.startsWith(`/${SHARED_ASSETS_DIR}/`) || nextPath.startsWith(`${SHARED_ASSETS_DIR}/`)) {
    nextPath = `../${nextPath.replace(/^\/+/, "")}`;
  } else if (SHARED_ASSET_FOLDERS.some((name) => nextPath === name || nextPath.startsWith(`/${name}/`) || nextPath.startsWith(`${name}/`))) {
    nextPath = `${options.sharedBase.replace(/\/+$/, "")}/${nextPath.replace(/^\/+/, "")}`;
  } else if (nextPath.startsWith("/assets/")) {
    nextPath = `.${nextPath}`;
  } else if (nextPath === "assets" || nextPath.startsWith("assets/")) {
    nextPath = nextPath.startsWith("./") ? nextPath : `./${nextPath}`;
  } else if (nextPath.startsWith("/")) {
    nextPath = `.${nextPath}`;
  }
  return { ok: true, value: nextPath + suffix };
}

function copyPublishedDependencyFile(sourcePath: string, targetDir: string, copiedMap: Map<string, string>): string {
  const cacheKey = path.resolve(sourcePath);
  if (copiedMap.has(cacheKey)) {
    return copiedMap.get(cacheKey)!;
  }
  const ext = path.extname(sourcePath);
  const name = `${path.basename(sourcePath, ext)}-${hashString(cacheKey).slice(0, 8)}${ext}`;
  const relativePath = `./assets/published/${name}`;
  const outputPath = path.join(targetDir, "assets", "published", name);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.copyFileSync(sourcePath, outputPath);
  copiedMap.set(cacheKey, relativePath);
  return relativePath;
}

function buildStaticTocData(root: Element): Array<{ id: string; text: string; level: number }> {
  const selector = [
    "h1",
    "h2",
    "h3",
    "[data-type='NodeHeading']",
    "[data-type~='NodeHeading']",
    "[data-subtype='h1']",
    "[data-subtype='h2']",
    "[data-subtype='h3']",
  ].join(",");
  const items: Array<{ id: string; text: string; level: number }> = [];
  for (const node of Array.from(root.querySelectorAll(selector))) {
    const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    let level = 1;
    const tagMatch = String(node.tagName || "").toLowerCase().match(/^h([1-3])$/);
    if (tagMatch) {
      level = Number(tagMatch[1]) - 1;
    } else {
      const subtype = String(node.getAttribute("data-subtype") || "").toLowerCase();
      const subtypeMatch = subtype.match(/^h([1-3])$/);
      if (subtypeMatch) {
        level = Number(subtypeMatch[1]) - 1;
      }
    }
    const currentId = String(node.getAttribute("id") || node.getAttribute("data-node-id") || "").trim();
    const id = currentId || `${safeSlug(text, text).slice(0, 24)}-${hashString(text).slice(0, 6)}`;
    node.setAttribute("id", id);
    items.push({ id, text, level: Math.max(1, Math.min(level, 3)) });
  }
  return items;
}

async function ensureRemoteDirectories(
  api: SiyuanCloudApi,
  remoteRootPath: string,
  remotePagePath: string,
  remoteAssetsPath: string,
  remoteSharedPath: string,
  targetDir: string,
  sharedRoot: string,
  uploadSharedAssets: boolean,
): Promise<void> {
  const dirSet = new Set<string>([remoteRootPath, remotePagePath, remoteAssetsPath]);
  for (const entry of walkDirRecursive(targetDir)) {
    const parent = path.posix.dirname(normalizeCloudPath(remotePagePath, entry.relativePath));
    collectParentDirs(parent).forEach((item) => dirSet.add(item));
  }
  if (uploadSharedAssets) {
    dirSet.add(remoteSharedPath);
    for (const entry of walkDirRecursive(sharedRoot)) {
      const parent = path.posix.dirname(normalizeCloudPath(remoteSharedPath, entry.relativePath));
      collectParentDirs(parent).forEach((item) => dirSet.add(item));
    }
  }
  const sorted = Array.from(dirSet).sort((a, b) => a.split("/").length - b.split("/").length);
  for (const dir of sorted) {
    await api.mkdir(dir);
  }
}

async function uploadDirectory(api: SiyuanCloudApi, localDir: string, remoteBase: string): Promise<void> {
  for (const entry of walkDirRecursive(localDir)) {
    const remotePath = normalizeCloudPath(remoteBase, entry.relativePath);
    await api.putFileFromDisk(remotePath, entry.absolutePath);
  }
}

async function uploadPageFiles(api: SiyuanCloudApi, targetDir: string, remotePagePath: string): Promise<void> {
  const allFiles = walkDirRecursive(targetDir);
  const assetFiles = allFiles.filter((item) => item.relativePath.startsWith("assets/"));
  const otherFiles = allFiles.filter((item) => item.relativePath !== "index.html" && !item.relativePath.startsWith("assets/"));
  for (const entry of [...assetFiles, ...otherFiles]) {
    const remotePath = normalizeCloudPath(remotePagePath, entry.relativePath);
    await api.putFileFromDisk(remotePath, entry.absolutePath);
  }
}

function collectParentDirs(fullPath: string): string[] {
  const parts = fullPath.split("/").filter(Boolean);
  const result: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    result.push(`/${parts.slice(0, i + 1).join("/")}`);
  }
  return result;
}

function getCurrentTitleFromDOM(): string {
  const selectors = [
    ".layout__wnd--active .protyle-title__input",
    ".layout__wnd--active .protyle-background__title",
    ".item--focus .item__text",
    ".layout-tab-bar .item--focus",
  ];
  for (const selector of selectors) {
    const node = document.querySelector(selector) as HTMLInputElement | HTMLElement | null;
    const value = String((node as HTMLInputElement | null)?.value || node?.textContent || node?.getAttribute?.("aria-label") || "").trim();
    if (value) return value;
  }
  return "";
}

function getDocIdFromElement(node: Element | null): string {
  if (!node || typeof node.closest !== "function") return "";
  const candidates = [
    node,
    node.closest("[data-doc-id]"),
    node.closest("[data-root-id]"),
    node.closest("[data-node-id]"),
    node.closest(".protyle"),
    node.closest(".layout-tab-container"),
  ].filter(Boolean) as Element[];
  for (const item of candidates) {
    const values = [
      item.getAttribute?.("data-doc-id"),
      item.getAttribute?.("data-root-id"),
      item.getAttribute?.("data-node-id"),
      item.getAttribute?.("data-id"),
      (item as HTMLElement).dataset?.docId,
      (item as HTMLElement).dataset?.rootId,
      (item as HTMLElement).dataset?.nodeId,
      (item as HTMLElement).dataset?.id,
    ].filter(Boolean);
    const match = values.find((value) => /^\d{14}-[a-z0-9]+$/i.test(String(value).trim()));
    if (match) return String(match).trim();
  }
  return "";
}

function applyCurrentDocInfo(info: CurrentDocInfo): CurrentDocInfo {
  const normalized = normalizeDocInfo(info, info.source || "fallback");
  if (!normalized.docId) return normalized;
  lastActiveDocInfo = {
    ...normalized,
    title: normalized.title || normalized.docId,
    updatedAt: Date.now(),
  };
  return normalized;
}

function normalizeDocInfo(info: Partial<CurrentDocInfo>, source = "fallback"): CurrentDocInfo {
  return {
    docId: String(info.docId || "").trim(),
    title: String(info.title || "").trim(),
    source: String(info.source || source || "fallback"),
  };
}

function getDocTitleFromProtyle(protyle: any): string {
  if (!protyle) return "";
  const block = protyle.block || protyle.model || {};
  const directTitle = block.title || block.name || protyle.title || protyle.docTitle;
  if (directTitle) return String(directTitle).trim();
  const element = protyle.element || protyle.protyle?.element || protyle.wysiwyg?.element || null;
  if (!element || typeof element.querySelector !== "function") return "";
  const selectors = [
    ".protyle-title__input",
    ".protyle-background__title",
    "[data-type='NodeDocument'] .protyle-title__input",
  ];
  for (const selector of selectors) {
    const node = element.querySelector(selector) as HTMLInputElement | HTMLElement | null;
    const value = String((node as HTMLInputElement | null)?.value || node?.textContent || "").trim();
    if (value) return value;
  }
  return "";
}

function extractDocInfoFromProtyle(protyle: any, source = "active-protyle"): CurrentDocInfo {
  if (!protyle) return normalizeDocInfo({}, source);
  const block = protyle.block || protyle.model || {};
  const element = protyle.element || protyle.protyle?.element || protyle.wysiwyg?.element || null;
  const docId = String(
    block.rootID || block.rootId || block.id || protyle.rootID || protyle.rootId || getDocIdFromElement(element) || "",
  ).trim();
  const title = getDocTitleFromProtyle(protyle) || getCurrentTitleFromDOM() || "";
  return normalizeDocInfo({ docId, title, source }, source);
}

async function readDocMetaById(docId: string): Promise<{ docId: string; title: string } | null> {
  const id = String(docId || "").trim();
  if (!id) return null;
  try {
    const result = await fetchSyncPost("/api/block/getBlockInfo", { id });
    if (!result || result.code !== 0 || !result.data) return null;
    const data = result.data || {};
    const title = String(data.rootTitle || data.title || data.name || data.pathName || data.hPath || "").trim();
    const rootID = String(data.rootID || data.rootId || data.id || id).trim();
    return {
      docId: rootID || id,
      title,
    };
  } catch {
    return null;
  }
}

async function getValidatedLastActiveDocInfo(): Promise<CurrentDocInfo> {
  const cached = lastActiveDocInfo;
  if (!cached?.docId) return normalizeDocInfo({}, "cached-current-doc");
  const meta = await readDocMetaById(cached.docId);
  if (!meta?.docId) return normalizeDocInfo({}, "cached-current-doc");
  return normalizeDocInfo({
    docId: meta.docId,
    title: meta.title || cached.title || meta.docId,
    source: "cached-current-doc",
  }, "cached-current-doc");
}

function getCurrentDocInfoFromSelection(): CurrentDocInfo {
  const selectors = [
    ".layout__wnd--active .protyle-wysiwyg [data-node-id].protyle-wysiwyg--select",
    ".layout__wnd--active .protyle-wysiwyg [data-node-id].protyle-wysiwyg--hl",
    ".layout__wnd--active .protyle-wysiwyg [data-node-id][contenteditable='true']",
    ".layout__wnd--active .protyle-wysiwyg [data-node-id]",
  ];
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    const docId = getDocIdFromElement(node);
    if (docId) {
      return normalizeDocInfo({ docId, title: getCurrentTitleFromDOM(), source: "selected-block" }, "selected-block");
    }
  }
  return normalizeDocInfo({}, "selected-block");
}

function getCurrentDocInfoFromTab(): CurrentDocInfo {
  const selectors = [
    ".layout__wnd--active .item--focus[data-id]",
    ".layout-tab-bar .item--focus[data-id]",
    ".layout__wnd--active [data-activetime][data-id]",
  ];
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (!node) continue;
    const rawId = String(node.getAttribute("data-id") || "").trim();
    const docIdMatch = rawId.match(/\d{14}-[a-z0-9]+/i);
    if (!docIdMatch) continue;
    const docId = docIdMatch[0];
    const title = String(
      node.getAttribute("title")
      || node.getAttribute("aria-label")
      || (typeof (node as HTMLElement).querySelector === "function" ? (node as HTMLElement).querySelector(".item__text")?.textContent : "")
      || node.textContent
      || "",
    ).trim();
    return normalizeDocInfo({ docId, title, source: "tab-dom" }, "tab-dom");
  }
  return normalizeDocInfo({}, "tab-dom");
}

function getCurrentDocInfoFromSiyuanLayout(): CurrentDocInfo {
  const siyuan = globalThis.window?.siyuan as any;
  const protyles: any[] = [];
  const push = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    protyles.push(value);
  };
  push(siyuan?.mobile?.editor?.protyle);
  push(siyuan?.editor?.protyle);
  push(siyuan?.editor?.protyles);
  push(siyuan?.protyle);
  for (const protyle of protyles) {
    const info = extractDocInfoFromProtyle(protyle, "siyuan-layout");
    if (info.docId) return info;
  }
  return normalizeDocInfo({}, "siyuan-layout");
}

async function enrichDocInfo(info: CurrentDocInfo): Promise<CurrentDocInfo> {
  const normalized = normalizeDocInfo(info, info.source || "fallback");
  if (!normalized.docId) return normalized;
  const meta = await readDocMetaById(normalized.docId);
  if (meta?.docId) {
    return normalizeDocInfo({
      docId: meta.docId,
      title: meta.title || normalized.title || getCurrentTitleFromDOM() || meta.docId,
      source: normalized.source,
    }, normalized.source);
  }
  if (normalized.title) return normalized;
  const domTitle = getCurrentTitleFromDOM();
  if (domTitle) return normalizeDocInfo({ ...normalized, title: domTitle }, normalized.source);
  return normalizeDocInfo({ ...normalized, title: normalized.docId }, normalized.source);
}

function splitResourceRef(ref: string): { path: string; suffix: string } {
  const value = String(ref || "").trim();
  const match = value.match(/^([^?#]*)([?#].*)?$/);
  return {
    path: match?.[1] || value,
    suffix: match?.[2] || "",
  };
}

function isExternalResourceRef(ref: string): boolean {
  return /^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(ref);
}

function isLocalAbsoluteResource(ref: string): boolean {
  return /^(?:file:\/\/\/|[a-zA-Z]:[\\/]|\/[a-zA-Z]:\/)/.test(ref);
}

function extractLocalFilePath(ref: string): string {
  if (/^file:\/\/\//i.test(ref)) {
    try {
      let pathname = decodeURIComponent(new URL(ref).pathname || "");
      if (/^\/[a-zA-Z]:\//.test(pathname)) pathname = pathname.slice(1);
      return pathname.replace(/\//g, path.sep);
    } catch {
      return "";
    }
  }
  if (/^[a-zA-Z]:[\\/]/.test(ref)) {
    return ref.replace(/\//g, path.sep);
  }
  if (/^\/[a-zA-Z]:\//.test(ref)) {
    return ref.slice(1).replace(/\//g, path.sep);
  }
  return "";
}

function hashString(input: string): string {
  return crypto.createHash("md5").update(String(input || "")).digest("hex");
}

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function getDomParser(): DOMParser | null {
  const Ctor = globalThis.window?.DOMParser || globalThis.DOMParser;
  return Ctor ? new Ctor() : null;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeReadDir(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}
