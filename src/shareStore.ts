import type { Plugin } from "siyuan";
import { DEFAULT_SETTINGS, normalizeSettings, type CloudPagesSettings } from "./settings";

export interface ShareRecord {
  id: string;
  docId: string;
  title: string;
  slug: string;
  url: string;
  previewUrl: string;
  sourceUrl: string;
  storageId: number;
  storageMountPath: string;
  remotePath: string;
  publicBaseUrl: string;
  previewBaseUrl: string;
  uploadSharedAssets: boolean;
  createdAt: string;
  updatedAt: string;
  status: "success" | "failed" | "pending";
  lastError?: string;
}

interface StoreFileShape {
  settings?: Partial<CloudPagesSettings>;
  shares?: ShareRecord[];
}

const STORAGE_FILE = "cloud-pages.json";

export class ShareStore {
  private readonly plugin: Plugin;
  private data: { settings: CloudPagesSettings; shares: ShareRecord[] } = {
    settings: DEFAULT_SETTINGS,
    shares: [],
  };

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  async load(): Promise<void> {
    const raw = await this.plugin.loadData(STORAGE_FILE).catch(() => null) as StoreFileShape | null;
    this.data = {
      settings: normalizeSettings(raw?.settings),
      shares: normalizeRecords(raw?.shares),
    };
  }

  async save(): Promise<void> {
    await this.plugin.saveData(STORAGE_FILE, this.data);
  }

  getSettings(): CloudPagesSettings {
    return { ...this.data.settings };
  }

  async updateSettings(input: Partial<CloudPagesSettings>): Promise<CloudPagesSettings> {
    this.data.settings = normalizeSettings({
      ...this.data.settings,
      ...input,
    });
    await this.save();
    return this.getSettings();
  }

  getShares(): ShareRecord[] {
    return this.data.shares
      .map((item) => ({ ...item }))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }

  findByDocId(docId: string): ShareRecord | undefined {
    return this.getShares().find((item) => item.docId === docId);
  }

  async upsertShare(record: ShareRecord): Promise<ShareRecord> {
    const normalized = normalizeRecord(record);
    const index = this.data.shares.findIndex((item) => item.id === normalized.id || (item.docId === normalized.docId && item.slug === normalized.slug));
    if (index >= 0) {
      const existing = this.data.shares[index];
      this.data.shares[index] = {
        ...existing,
        ...normalized,
        createdAt: existing.createdAt || normalized.createdAt,
      };
    } else {
      this.data.shares.push(normalized);
    }
    await this.save();
    return { ...normalized };
  }

  async removeShare(id: string): Promise<void> {
    this.data.shares = this.data.shares.filter((item) => item.id !== id);
    await this.save();
  }
}

function normalizeRecords(records: unknown): ShareRecord[] {
  return (Array.isArray(records) ? records : [])
    .map(normalizeRecord)
    .filter(Boolean);
}

function normalizeRecord(record: Partial<ShareRecord>): ShareRecord {
  const now = new Date().toISOString();
  return {
    id: String(record.id || `${record.docId || "doc"}:${record.slug || "share"}`),
    docId: String(record.docId || ""),
    title: String(record.title || ""),
    slug: String(record.slug || ""),
    url: String(record.url || ""),
    previewUrl: String(record.previewUrl || record.url || ""),
    sourceUrl: String(record.sourceUrl || record.url || ""),
    storageId: Number(record.storageId || 0),
    storageMountPath: String(record.storageMountPath || ""),
    remotePath: String(record.remotePath || ""),
    publicBaseUrl: String(record.publicBaseUrl || ""),
    previewBaseUrl: String(record.previewBaseUrl || ""),
    uploadSharedAssets: record.uploadSharedAssets !== false,
    createdAt: String(record.createdAt || record.updatedAt || now),
    updatedAt: String(record.updatedAt || now),
    status: record.status === "failed" || record.status === "pending" ? record.status : "success",
    lastError: record.lastError ? String(record.lastError) : "",
  };
}
