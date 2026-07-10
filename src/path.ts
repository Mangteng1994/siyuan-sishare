import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface FileEntry {
  absolutePath: string;
  relativePath: string;
  size: number;
}

export function normalizeCloudPath(...parts: string[]): string {
  const segments: string[] = [];
  for (const part of parts) {
    const text = String(part || "").trim().replace(/\\/g, "/");
    if (!text) continue;
    for (const segment of text.split("/")) {
      const current = segment.trim();
      if (!current || current === ".") continue;
      if (current === "..") {
        throw new Error(`检测到非法路径段 "..": ${parts.join(" / ")}`);
      }
      segments.push(current);
    }
  }
  if (!segments.length) {
    throw new Error("云端路径不能为空");
  }
  return `/${segments.join("/")}`;
}

export function joinUrl(...parts: string[]): string {
  const list = parts.map((item) => String(item || "").trim()).filter(Boolean);
  if (!list.length) {
    return "";
  }
  let url = list[0].replace(/\/+$/, "");
  for (let i = 1; i < list.length; i += 1) {
    url += `/${list[i].replace(/^\/+|\/+$/g, "")}`;
  }
  return url.replace(/([^:])\/{2,}/g, "$1/");
}

export function safeTitleSlug(title: string): string {
  const normalizedTitle = String(title || "")
    .normalize("NFKC")
    .replace(/\s+/g, "-")
    .replace(/[/?%*:|"<>#\\[\]{}^`~]+/g, "")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return (normalizedTitle || "untitled").slice(0, 96);
}

export function safeSlug(title: string, docId: string): string {
  const base = safeTitleSlug(title);
  const safeDocId = String(docId || "").replace(/[^a-zA-Z0-9]/g, "");
  const suffix = safeDocId.slice(-8) || crypto.createHash("md5").update(`${title}:${docId}`).digest("hex").slice(0, 8);
  return `${base}-${suffix}`.slice(0, 96);
}

export function safeDecodeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname
      .split("/")
      .map((segment) => {
        try {
          return decodeURIComponent(segment);
        } catch {
          return segment;
        }
      })
      .join("/");
    return `${parsed.origin}${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    try {
      return decodeURI(url);
    } catch {
      return url;
    }
  }
}

export function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
    case ".htm":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ttf":
      return "font/ttf";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".xml":
      return "application/xml; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export function walkDirRecursive(dir: string): FileEntry[] {
  const root = path.resolve(dir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return [];
  }
  const results: FileEntry[] = [];
  const visit = (currentDir: string) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = fs.statSync(absolutePath);
      results.push({
        absolutePath,
        relativePath: path.relative(root, absolutePath).replace(/\\/g, "/"),
        size: stat.size,
      });
    }
  };
  visit(root);
  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function isTextMime(mime: string): boolean {
  return /^text\//i.test(mime)
    || /(?:javascript|json|xml|svg)/i.test(mime);
}
