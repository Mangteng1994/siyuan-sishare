export type SlugMode = "title-docid" | "title";

export interface CloudStorageMount {
  id: number;
  mount_path: string;
  driver: string;
  remark?: string;
  status?: string;
  disabled?: boolean;
}

export interface CloudPagesSettings {
  cloudToken: string;
  storageId: number | null;
  storageMountPath: string;
  publicBaseUrl: string;
  previewBaseUrl: string;
  uploadSharedAssets: boolean;
  slugMode: SlugMode;
}

export const DEFAULT_SETTINGS: CloudPagesSettings = {
  cloudToken: "",
  storageId: null,
  storageMountPath: "",
  publicBaseUrl: "",
  previewBaseUrl: "",
  uploadSharedAssets: true,
  slugMode: "title-docid",
};

export function normalizeSettings(input: unknown): CloudPagesSettings {
  const source = (input && typeof input === "object" ? input : {}) as Partial<CloudPagesSettings>;
  return {
    cloudToken: String(source.cloudToken || "").trim(),
    storageId: Number.isFinite(source.storageId as number) ? Number(source.storageId) : null,
    storageMountPath: String(source.storageMountPath || "").trim(),
    publicBaseUrl: String(source.publicBaseUrl || "").trim().replace(/\/+$/, ""),
    previewBaseUrl: String(source.previewBaseUrl || "").trim().replace(/\/+$/, ""),
    uploadSharedAssets: source.uploadSharedAssets !== false,
    slugMode: source.slugMode === "title" ? "title" : "title-docid",
  };
}

export function normalizeRemoteRoot(value: unknown): string {
  const text = String(value || "").trim().replace(/\\/g, "/");
  if (!text) {
    return "";
  }
  const normalized = `/${text}`.replace(/\/+/g, "/").replace(/\/+$/, "");
  return normalized === "/" ? "" : normalized;
}

export function deriveRemoteRootFromPublicBaseUrl(publicBaseUrl: string): string {
  const value = String(publicBaseUrl || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return normalizeRemoteRoot(
      parsed.pathname
        .split("/")
        .map((segment) => {
          try {
            return decodeURIComponent(segment);
          } catch {
            return segment;
          }
        })
        .join("/"),
    );
  } catch {
    return "";
  }
}

export function isSupportedStorage(storage: unknown): storage is CloudStorageMount {
  const item = (storage && typeof storage === "object" ? storage : {}) as Partial<CloudStorageMount>;
  return item.driver === "S3" && item.disabled !== true && item.status !== "disabled";
}

export function filterSupportedStorages(storages: unknown[]): CloudStorageMount[] {
  return (Array.isArray(storages) ? storages : [])
    .filter(isSupportedStorage)
    .map((item) => ({
      id: Number(item.id),
      mount_path: String(item.mount_path || ""),
      driver: String(item.driver || ""),
      remark: String(item.remark || ""),
      status: String(item.status || ""),
      disabled: !!item.disabled,
    }))
    .filter((item) => Number.isFinite(item.id) && item.mount_path);
}

export function storageLabel(storage: CloudStorageMount): string {
  const remark = storage.remark ? ` / ${storage.remark}` : "";
  const status = storage.status ? ` / ${storage.status}` : "";
  return `${storage.mount_path} / ${storage.driver}${remark}${status}`;
}
