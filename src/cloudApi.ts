import fs from "node:fs/promises";
import { mimeFromPath } from "./path";
import type { CloudStorageMount } from "./settings";

export const SIYUAN_CLOUD_BASE = "/plugin/private/siyuan-cloud";
const AUTH_HEADER = "X-Siyuan-Cloud-Authorization";

interface OpenListPayload<T = any> {
  code?: number;
  message?: string;
  data?: T;
}

export class CloudApiError extends Error {
  status?: number;
  code?: number;

  constructor(message: string, options: { status?: number; code?: number } = {}) {
    super(message);
    this.name = "CloudApiError";
    this.status = options.status;
    this.code = options.code;
  }
}

export class SiyuanCloudApi {
  private readonly token: string;

  constructor(token: string) {
    this.token = String(token || "").trim();
  }

  async listStorages(): Promise<CloudStorageMount[]> {
    const payload = await this.requestJson<any>("/api/admin/storage/list", { method: "GET" });
    const content = payload?.data?.content || payload?.data || [];
    return Array.isArray(content) ? content : [];
  }

  async list(pathValue: string): Promise<any> {
    return this.requestJson("/api/fs/list", {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        path: pathValue,
        page: 1,
        per_page: 100,
        refresh: false,
      }),
    });
  }

  async mkdir(pathValue: string): Promise<void> {
    await this.requestJson("/api/fs/mkdir", {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({ path: pathValue }),
    });
  }

  async remove(dir: string, names: string[]): Promise<void> {
    await this.requestJson("/api/fs/remove", {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({ dir, names }),
    });
  }

  async putText(pathValue: string, content: string, contentType: string): Promise<void> {
    const bytes = new TextEncoder().encode(content);
    await this.putBytes(pathValue, bytes, contentType);
  }

  async putBinary(pathValue: string, filePath: string, contentType?: string): Promise<void> {
    const buffer = await fs.readFile(filePath);
    await this.putBytes(pathValue, buffer, contentType || mimeFromPath(filePath));
  }

  private async putBytes(pathValue: string, body: Uint8Array, contentType: string): Promise<void> {
    const payload = Uint8Array.from(body).buffer;
    const response = await fetch(`${SIYUAN_CLOUD_BASE}/api/fs/put`, {
      method: "PUT",
      headers: {
        ...this.authHeaders(),
        "Content-Type": contentType,
        "File-Path": encodeURIComponent(pathValue),
        Overwrite: "true",
      },
      body: new Blob([payload], { type: contentType }),
    });
    await this.ensureHttpSuccess(response, "文件上传失败");
    await this.ensurePayloadSuccess(await response.text());
  }

  async putFileFromDisk(pathValue: string, filePath: string): Promise<void> {
    const mime = mimeFromPath(filePath);
    if (/^(?:text\/|application\/(?:javascript|json|xml)|image\/svg\+xml)/i.test(mime)) {
      const text = await fs.readFile(filePath, "utf8");
      await this.putText(pathValue, text, mime);
      return;
    }
    await this.putBinary(pathValue, filePath, mime);
  }

  async ensureWritable(rootPath: string): Promise<void> {
    const probeName = `.sishare-probe-${Date.now()}`;
    const probePath = `${rootPath}/${probeName}`.replace(/\/+/g, "/");
    await this.mkdir(rootPath);
    await this.mkdir(probePath);
    await this.remove(rootPath, [probeName]);
  }

  async createShareRecord(id: string, files: string[], remark = ""): Promise<void> {
    await this.requestJson("/api/share/create", {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        id,
        files,
        remark,
      }),
    });
  }

  async updateShareRecord(id: string, files: string[], remark = ""): Promise<void> {
    await this.requestJson("/api/share/update", {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        id,
        new_id: id,
        files,
        remark,
      }),
    });
  }

  async deleteShareRecord(id: string): Promise<void> {
    await this.requestJson("/api/share/delete", {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({ id }),
    });
  }

  private authHeaders(headers: Record<string, string> = {}): Record<string, string> {
    return this.token
      ? { ...headers, [AUTH_HEADER]: this.token }
      : headers;
  }

  private jsonHeaders(): Record<string, string> {
    return this.authHeaders({
      "Content-Type": "application/json",
    });
  }

  private async requestJson<T = any>(pathValue: string, init: RequestInit): Promise<OpenListPayload<T>> {
    const response = await fetch(`${SIYUAN_CLOUD_BASE}${pathValue}`, {
      ...init,
      headers: this.authHeaders(normalizeHeaders(init.headers)),
    });
    const text = await response.text();
    if (!response.ok) {
      const detail = text || `HTTP ${response.status}`;
      throw this.classifyHttpError(response.status, detail);
    }
    const payload = text ? JSON.parse(text) as OpenListPayload<T> : {};
    if (payload.code && payload.code !== 200) {
      throw this.classifyBusinessError(payload.code, payload.message || `Siyuan Cloud code ${payload.code}`);
    }
    return payload;
  }

  private async ensureHttpSuccess(response: Response, fallback: string): Promise<void> {
    if (response.ok) return;
    const text = await response.text().catch(() => "");
    throw this.classifyHttpError(response.status, text || fallback);
  }

  private async ensurePayloadSuccess(text: string): Promise<void> {
    if (!text) return;
    let payload: OpenListPayload | null = null;
    try {
      payload = JSON.parse(text);
    } catch {
      return;
    }
    if (payload?.code && payload.code !== 200) {
      throw this.classifyBusinessError(payload.code, payload.message || `Siyuan Cloud code ${payload.code}`);
    }
  }

  private classifyHttpError(status: number, message: string): CloudApiError {
    if (status === 404) {
      return new CloudApiError("siyuan-cloud 未安装、未启用，或私有 API 路由不可用", { status });
    }
    if (status === 401 || status === 403) {
      return new CloudApiError("Token 错误或权限不足，无法访问 siyuan-cloud", { status });
    }
    return new CloudApiError(message || `HTTP ${status}`, { status });
  }

  private classifyBusinessError(code: number, message: string): CloudApiError {
    const lower = String(message || "").toLowerCase();
    if (lower.includes("permission")) {
      return new CloudApiError("Token 权限不足，无法执行当前操作", { code });
    }
    if (lower.includes("sharing not found")) {
      return new CloudApiError("未找到对应的 siyuan-cloud 分享记录", { code });
    }
    return new CloudApiError(message || `Siyuan Cloud code ${code}`, { code });
  }
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      result[key] = String(value);
    }
    return result;
  }
  for (const [key, value] of Object.entries(headers)) {
    result[key] = String(value);
  }
  return result;
}
