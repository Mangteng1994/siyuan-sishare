import { Plugin, confirm, showMessage } from "siyuan";
import { normalizeCloudPath } from "./path";
import { deriveRemoteRootFromPublicBaseUrl, filterSupportedStorages, normalizeSettings, type CloudPagesSettings, type CloudStorageMount } from "./settings";
import { ShareStore, type ShareRecord } from "./shareStore";
import { CloudPagesPanel, ProgressOverlay } from "./ui";
import { SiyuanCloudApi } from "./cloudApi";
import { buildRecordId, buildSlug, clearTrackedDocContext, deleteRemoteShare, getCurrentDocInfoSafe, publishToSiyuanCloud, refreshTrackedDocInfo, setCurrentProtyle } from "./exporter";

const SHARE_TOPBAR_ICON = `
  <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <path d="M512 0C229.23 0 0 229.23 0 512s229.23 512 512 512 512-229.23 512-512S794.77 0 512 0z m150.888 822.576c-56.452 0-102.807-43.195-107.838-98.335l-175.252-71.917c-16.481 10.135-35.881 15.985-56.648 15.985-59.812 0-108.299-48.487-108.299-108.299s48.487-108.299 108.299-108.299c11.68 0 22.925 1.857 33.464 5.278l128.185-128.185c-4.694-12.125-7.274-25.303-7.274-39.084 0-59.812 48.487-108.299 108.299-108.299s108.299 48.487 108.299 108.299c0 59.812-48.487 108.299-108.299 108.299-19.668 0-38.11-5.244-54.008-14.408L414.149 501.277c10.943 16.92 17.299 37.083 17.299 58.733 0 11.697-1.862 22.958-5.293 33.51l146.883 60.275c19.456-28.847 52.437-47.818 89.849-47.818 59.812 0 108.299 48.487 108.299 108.299s-48.486 108.3-108.298 108.3z" fill="currentColor"/>
  </svg>
`;

export default class SiSharePlugin extends Plugin {
  private readonly progress = new ProgressOverlay();
  private store!: ShareStore;
  private panel!: CloudPagesPanel;
  private storages: CloudStorageMount[] = [];
  private busy = false;
  private readonly boundHandleSwitchProtyle = (event: CustomEvent<{ protyle?: any }>) => {
    setCurrentProtyle(event.detail?.protyle || null);
    void refreshTrackedDocInfo("active-protyle").catch(() => {});
  };

  async onload(): Promise<void> {
    this.store = new ShareStore(this);
    await this.store.load();
    this.panel = new CloudPagesPanel(this.name);
    this.eventBus.on("switch-protyle", this.boundHandleSwitchProtyle);
    this.eventBus.on("loaded-protyle-dynamic", this.boundHandleSwitchProtyle);

    this.addTopBar({
      icon: SHARE_TOPBAR_ICON,
      title: "云端静态分享",
      callback: () => {
        this.openSetting();
      },
    });
  }

  onunload(): void {
    this.eventBus.off("switch-protyle", this.boundHandleSwitchProtyle);
    this.eventBus.off("loaded-protyle-dynamic", this.boundHandleSwitchProtyle);
    clearTrackedDocContext();
  }

  openSetting(): void {
    void this.ensureStoragesLoaded().catch((error) => {
      showMessage(formatError(error), 5000, "error");
    });
    this.renderPanel();
  }

  private renderPanel(): void {
    this.panel.open(this.getPanelState(), {
      onSaveSettings: async (settings) => {
        const next = await this.store.updateSettings(settings);
        const selected = this.storages.find((item) => item.id === next.storageId);
        if (selected && selected.mount_path !== next.storageMountPath) {
          await this.store.updateSettings({
            storageMountPath: selected.mount_path,
          });
        }
        showMessage("设置已保存", 2000, "info");
        this.rerenderPanel();
      },
      onRefreshStorages: async () => {
        await this.refreshStorages(true);
      },
      onPublishCurrent: async () => {
        await this.runTask(async () => {
          await this.publishCurrentDocument();
        });
      },
      onUpdateShare: async (record) => {
        await this.runTask(async () => {
          await this.updateShare(record);
        });
      },
      onDeleteShare: async (record) => {
        confirm("删除分享", `确认删除远端目录 ${record.slug} 吗？这不会删除 pages-pub-assets。`, async () => {
          await this.runTask(async () => {
            await this.deleteShare(record);
          });
        });
      },
      onCopyUrl: async (url) => {
        try {
          await navigator.clipboard.writeText(url);
          showMessage("链接已复制", 2000, "info");
        } catch (error) {
          showMessage(`复制失败: ${formatError(error)}`, 4000, "error");
        }
      },
    });
  }

  private rerenderPanel(): void {
    this.panel.rerender(this.getPanelState());
  }

  private getPanelState() {
    return {
      settings: this.store.getSettings(),
      storages: this.storages,
      shares: this.store.getShares(),
      busy: this.busy,
    };
  }

  private async runTask(task: () => Promise<void>): Promise<void> {
    if (this.busy) {
      showMessage("已有任务正在执行，请稍后再试", 3000, "info");
      return;
    }
    this.busy = true;
    this.rerenderPanel();
    try {
      await task();
    } catch (error) {
      showMessage(formatError(error), 6000, "error");
    } finally {
      this.busy = false;
      this.rerenderPanel();
    }
  }

  private async publishCurrentDocument(): Promise<void> {
    const settings = await this.ensureValidSettings();
    const docInfo = await getCurrentDocInfoSafe();
    if (!docInfo.docId) {
      throw new Error("未能识别当前活跃文档，请先点击正文后再试");
    }
    const existing = this.store.findByDocId(docInfo.docId);
    const slug = existing?.slug || buildSlug(docInfo.title || docInfo.docId, docInfo.docId);
    const now = new Date().toISOString();
    const remoteBasePath = deriveRemoteRootFromPublicBaseUrl(settings.publicBaseUrl);
    const baseRecord: ShareRecord = {
      id: existing?.id || buildRecordId(docInfo.docId, slug),
      docId: docInfo.docId,
      title: docInfo.title || existing?.title || docInfo.docId,
      slug,
      url: existing?.url || "",
      previewUrl: existing?.previewUrl || existing?.url || "",
      sourceUrl: existing?.sourceUrl || "",
      storageId: Number(settings.storageId),
      storageMountPath: settings.storageMountPath,
      remotePath: remoteBasePath
        ? normalizeCloudPath(settings.storageMountPath, remoteBasePath, slug)
        : normalizeCloudPath(settings.storageMountPath, slug),
      publicBaseUrl: settings.publicBaseUrl,
      previewBaseUrl: settings.previewBaseUrl,
      uploadSharedAssets: settings.uploadSharedAssets,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      status: "pending",
      lastError: "",
    };
    await this.store.upsertShare(baseRecord);
    this.rerenderPanel();

    try {
      const output = await publishToSiyuanCloud({
        docId: docInfo.docId,
        title: docInfo.title || docInfo.docId,
        slug,
        settings,
        onProgress: (percent, text) => this.progress.update(percent, text),
      });
      await this.store.upsertShare({
        ...baseRecord,
        title: output.exportedTitle,
        url: output.url,
        previewUrl: output.previewUrl,
        sourceUrl: output.sourceUrl,
        remotePath: output.remotePagePath,
        updatedAt: new Date().toISOString(),
        status: "success",
        lastError: "",
      });
      this.progress.finish("云端分享完成");
      this.rerenderPanel();
      const warningText = output.warnings.length ? `\n${output.warnings.join("\n")}` : "";
      showMessage(`分享成功: ${output.url}${warningText}`, 7000, "info");
    } catch (error) {
      await this.store.upsertShare({
        ...baseRecord,
        updatedAt: new Date().toISOString(),
        status: "failed",
        lastError: formatError(error),
      });
      this.progress.finish(`失败：${formatError(error)}`, true);
      this.rerenderPanel();
      throw error;
    }
  }

  private async updateShare(record: ShareRecord): Promise<void> {
    const settings = await this.ensureValidSettings();
    const pending: ShareRecord = {
      ...record,
      storageId: Number(settings.storageId),
      storageMountPath: settings.storageMountPath,
      publicBaseUrl: settings.publicBaseUrl,
      previewBaseUrl: settings.previewBaseUrl,
      uploadSharedAssets: settings.uploadSharedAssets,
      updatedAt: new Date().toISOString(),
      status: "pending",
      lastError: "",
    };
    await this.store.upsertShare(pending);
    this.rerenderPanel();

    try {
      const output = await publishToSiyuanCloud({
        docId: record.docId,
        title: record.title || record.slug,
        slug: record.slug,
        settings,
        onProgress: (percent, text) => this.progress.update(percent, text),
      });
      await this.store.upsertShare({
        ...pending,
        title: output.exportedTitle,
        url: output.url,
        previewUrl: output.previewUrl,
        sourceUrl: output.sourceUrl,
        remotePath: output.remotePagePath,
        updatedAt: new Date().toISOString(),
        status: "success",
        lastError: "",
      });
      this.progress.finish("分享已更新");
      this.rerenderPanel();
      const warningText = output.warnings.length ? `\n${output.warnings.join("\n")}` : "";
      showMessage(`分享已更新: ${output.url}${warningText}`, 7000, "info");
    } catch (error) {
      await this.store.upsertShare({
        ...pending,
        updatedAt: new Date().toISOString(),
        status: "failed",
        lastError: formatError(error),
      });
      this.progress.finish(`更新失败：${formatError(error)}`, true);
      this.rerenderPanel();
      throw error;
    }
  }

  private async deleteShare(record: ShareRecord): Promise<void> {
    const settings = await this.ensureValidSettings();
    try {
      await deleteRemoteShare({
        slug: record.slug,
        settings,
        onProgress: (percent, text) => this.progress.update(percent, text),
      });
      await this.store.removeShare(record.id);
      this.progress.finish("分享已删除");
      this.rerenderPanel();
      showMessage("分享已删除，仅删除该文档对应远端目录", 4000, "info");
    } catch (error) {
      this.progress.finish(`删除失败：${formatError(error)}`, true);
      throw error;
    }
  }

  private async ensureValidSettings(): Promise<CloudPagesSettings> {
    const settings = normalizeSettings(this.store.getSettings());
    if (!settings.cloudToken) {
      throw new Error("请先配置 siyuan-cloud Token");
    }
    await this.ensureStoragesLoaded(true);
    const selected = this.storages.find((item) => item.id === settings.storageId);
    if (!selected) {
      throw new Error("未找到可用的 S3 挂载，请刷新后重新选择");
    }
    if (selected.mount_path !== settings.storageMountPath) {
      settings.storageMountPath = selected.mount_path;
      await this.store.updateSettings({ storageMountPath: selected.mount_path });
    }
    if (!settings.publicBaseUrl) {
      throw new Error("未配置 publicBaseUrl，不允许完成分享");
    }
    return settings;
  }

  private async ensureStoragesLoaded(force = false): Promise<void> {
    if (this.storages.length && !force) return;
    const settings = this.store.getSettings();
    if (!settings.cloudToken) {
      this.storages = [];
      return;
    }
    const api = new SiyuanCloudApi(settings.cloudToken);
    const list = await api.listStorages();
    this.storages = filterSupportedStorages(list);
    if (!this.storages.length) {
      throw new Error("未找到可用的 S3 挂载");
    }
  }

  private async refreshStorages(force = false): Promise<void> {
    const settings = this.store.getSettings();
    if (!settings.cloudToken) {
      throw new Error("请先填写 siyuan-cloud Token 再刷新挂载");
    }
    await this.ensureStoragesLoaded(force);
    this.rerenderPanel();
    showMessage("S3 挂载列表已刷新", 2000, "info");
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
