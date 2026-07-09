import { Dialog } from "siyuan";
import { safeDecodeUrl } from "./path";
import { storageLabel, type CloudPagesSettings, type CloudStorageMount } from "./settings";
import type { ShareRecord } from "./shareStore";

export interface PanelState {
  settings: CloudPagesSettings;
  storages: CloudStorageMount[];
  shares: ShareRecord[];
  busy: boolean;
}

export interface PanelHandlers {
  onSaveSettings: (settings: Partial<CloudPagesSettings>) => Promise<void>;
  onRefreshStorages: () => Promise<void>;
  onPublishCurrent: () => Promise<void>;
  onUpdateShare: (record: ShareRecord) => Promise<void>;
  onDeleteShare: (record: ShareRecord) => Promise<void>;
  onCopyUrl: (url: string) => Promise<void>;
}

export class CloudPagesPanel {
  private dialog: Dialog | null = null;
  private readonly pluginName: string;
  private root: HTMLElement | null = null;
  private state: PanelState | null = null;
  private handlers: PanelHandlers | null = null;

  constructor(pluginName: string) {
    this.pluginName = pluginName;
  }

  open(state: PanelState, handlers: PanelHandlers): void {
    this.state = state;
    this.handlers = handlers;
    if (!this.dialog || !document.body.contains(this.dialog.element)) {
      this.dialog = new Dialog({
        title: "云端静态分享",
        content: `<div class="sishare-panel" data-plugin="${this.pluginName}"></div>`,
        width: "960px",
        height: "72vh",
      });
      this.root = this.dialog.element.querySelector(".sishare-panel") as HTMLElement | null;
    }
    this.render();
  }

  rerender(state: PanelState): void {
    this.state = state;
    this.render();
  }

  private render(): void {
    if (!this.root || !this.state || !this.handlers) return;
    this.root.innerHTML = "";

    const toolbar = document.createElement("div");
    toolbar.className = "sishare-toolbar";
    toolbar.innerHTML = `
      <button class="b3-button b3-button--outline" data-action="publish" ${this.state.busy ? "disabled" : ""}>分享当前文档</button>
      <button class="b3-button b3-button--outline" data-action="refresh" ${this.state.busy ? "disabled" : ""}>刷新 S3 挂载</button>
      <button class="b3-button" data-action="save" ${this.state.busy ? "disabled" : ""}>保存设置</button>
    `;
    this.root.appendChild(toolbar);

    const settings = document.createElement("div");
    settings.className = "sishare-settings-grid";
    settings.innerHTML = `
      <label class="sishare-field">
        <span class="sishare-label">siyuan-cloud Token</span>
        <input class="b3-text-field fn__block" type="password" id="sishare-cloudToken" value="${escapeAttr(this.state.settings.cloudToken)}" placeholder="X-Siyuan-Cloud-Authorization">
      </label>
      <label class="sishare-field">
        <span class="sishare-label">分享网盘（仅 S3）</span>
        <select class="b3-select fn__block" id="sishare-storageId">
          <option value="">请选择挂载</option>
          ${this.state.storages.map((item) => `<option value="${item.id}" ${item.id === this.state!.settings.storageId ? "selected" : ""}>${escapeHtml(storageLabel(item))}</option>`).join("")}
        </select>
      </label>
      <label class="sishare-field">
        <span class="sishare-label">源文件根地址</span>
        <input class="b3-text-field fn__block" type="text" id="sishare-publicBaseUrl" value="${escapeAttr(this.state.settings.publicBaseUrl)}" placeholder="https://bucket.s3.bitiful.net/notes-share">
      </label>
      <label class="sishare-field">
        <span class="sishare-label">预览根地址（可选）</span>
        <input class="b3-text-field fn__block" type="text" id="sishare-previewBaseUrl" value="${escapeAttr(this.state.settings.previewBaseUrl)}" placeholder="https://preview.example.com/notes-share">
      </label>
      <label class="sishare-field">
        <span class="sishare-label">Slug 策略</span>
        <select class="b3-select fn__block" id="sishare-slugMode">
          <option value="title-docid" selected>标题 + docId 后 8 位</option>
        </select>
      </label>
      <label class="sishare-field sishare-checkbox">
        <span class="sishare-label">上传 pages-pub-assets</span>
        <input type="checkbox" id="sishare-uploadSharedAssets" ${this.state.settings.uploadSharedAssets ? "checked" : ""}>
      </label>
    `;
    this.root.appendChild(settings);

    const note = document.createElement("div");
    note.className = "sishare-note";
    note.textContent = "上传目录会直接取源文件根地址中的路径部分；如果填写预览根地址，分享卡片和复制链接会优先使用预览链接。";
    this.root.appendChild(note);

    const list = document.createElement("div");
    list.className = "sishare-share-list";
    if (!this.state.shares.length) {
      list.innerHTML = '<div class="sishare-empty">还没有分享记录，先打开一篇笔记再点击“分享当前文档”。</div>';
    } else {
      for (const record of this.state.shares) {
        list.appendChild(this.createShareCard(record));
      }
    }
    this.root.appendChild(list);

    toolbar.querySelector('[data-action="publish"]')?.addEventListener("click", () => this.handlers?.onPublishCurrent());
    toolbar.querySelector('[data-action="refresh"]')?.addEventListener("click", () => this.handlers?.onRefreshStorages());
    toolbar.querySelector('[data-action="save"]')?.addEventListener("click", () => this.saveSettingsFromForm());
  }

  private async saveSettingsFromForm(): Promise<void> {
    if (!this.root || !this.handlers) return;
    const storageIdValue = (this.root.querySelector("#sishare-storageId") as HTMLSelectElement | null)?.value || "";
    const storageId = storageIdValue ? Number(storageIdValue) : null;
    const storage = this.state?.storages.find((item) => item.id === storageId) || null;
    await this.handlers.onSaveSettings({
      cloudToken: (this.root.querySelector("#sishare-cloudToken") as HTMLInputElement | null)?.value || "",
      storageId,
      storageMountPath: storage?.mount_path || "",
      publicBaseUrl: (this.root.querySelector("#sishare-publicBaseUrl") as HTMLInputElement | null)?.value || "",
      previewBaseUrl: (this.root.querySelector("#sishare-previewBaseUrl") as HTMLInputElement | null)?.value || "",
      slugMode: "title-docid",
      uploadSharedAssets: !!(this.root.querySelector("#sishare-uploadSharedAssets") as HTMLInputElement | null)?.checked,
    });
  }

  private createShareCard(record: ShareRecord): HTMLElement {
    const card = document.createElement("div");
    card.className = "sishare-card";
    const hasDedicatedPreview = !!(record.previewBaseUrl && record.previewUrl && record.previewUrl !== record.sourceUrl);
    const primaryUrl = record.previewUrl || record.url || record.sourceUrl;
    const displayPrimaryUrl = safeDecodeUrl(primaryUrl);
    const displaySourceUrl = safeDecodeUrl(record.sourceUrl || record.url);
    const previewBlock = primaryUrl
      ? `
        <div class="sishare-grid-label">${hasDedicatedPreview ? "预览链接" : "访问链接"}</div>
        <div class="sishare-grid-value"><a href="${escapeAttr(primaryUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayPrimaryUrl)}</a></div>
      `
      : "";
    const sourceBlock = record.sourceUrl && record.sourceUrl !== primaryUrl
      ? `
        <div class="sishare-grid-label">源文件链接</div>
        <div class="sishare-grid-value"><a href="${escapeAttr(record.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displaySourceUrl)}</a></div>
      `
      : "";
    const errorBlock = record.lastError ? `<div class="sishare-error">${escapeHtml(record.lastError)}</div>` : "";
    card.innerHTML = `
      <div class="sishare-card-head">
        <div>
          <div class="sishare-card-title">${escapeHtml(record.title || record.slug)}</div>
          <div class="sishare-card-meta">${escapeHtml(record.docId)}</div>
        </div>
        <span class="sishare-status sishare-status--${escapeAttr(record.status)}">${escapeHtml(record.status)}</span>
      </div>
      <div class="sishare-grid">
        <div class="sishare-grid-label">远端路径</div>
        <div class="sishare-grid-value">${escapeHtml(record.remotePath)}</div>
        ${previewBlock}
        ${sourceBlock}
        <div class="sishare-grid-label">更新时间</div>
        <div class="sishare-grid-value">${escapeHtml(formatDateTime(record.updatedAt))}</div>
      </div>
      ${errorBlock}
      <div class="sishare-actions">
        <button class="b3-button b3-button--outline" data-action="copy">复制链接</button>
        <button class="b3-button b3-button--outline" data-action="update">更新分享</button>
        <button class="b3-button b3-button--outline b3-button--warning" data-action="delete">删除分享</button>
      </div>
    `;
    card.querySelector('[data-action="copy"]')?.addEventListener("click", () => this.handlers?.onCopyUrl(primaryUrl || record.url || record.sourceUrl));
    card.querySelector('[data-action="update"]')?.addEventListener("click", () => this.handlers?.onUpdateShare(record));
    card.querySelector('[data-action="delete"]')?.addEventListener("click", () => this.handlers?.onDeleteShare(record));
    return card;
  }
}

export class ProgressOverlay {
  private root: HTMLElement | null = null;
  private timer: number | null = null;

  update(percent: number, text: string, isError = false): void {
    if (!this.root) {
      const root = document.createElement("div");
      root.className = "sishare-progress";
      root.innerHTML = `
        <div class="sishare-progress-card">
          <div class="sishare-progress-title">云端分享</div>
          <div class="sishare-progress-text"></div>
          <div class="sishare-progress-track"><div class="sishare-progress-bar"></div></div>
          <div class="sishare-progress-percent"></div>
        </div>
      `;
      document.body.appendChild(root);
      this.root = root;
    }
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    const bar = this.root.querySelector(".sishare-progress-bar") as HTMLElement | null;
    const textNode = this.root.querySelector(".sishare-progress-text") as HTMLElement | null;
    const percentNode = this.root.querySelector(".sishare-progress-percent") as HTMLElement | null;
    if (bar) {
      bar.style.width = `${value}%`;
      bar.dataset.error = isError ? "true" : "false";
    }
    if (textNode) textNode.textContent = text;
    if (percentNode) percentNode.textContent = `${value}%`;
  }

  finish(text: string, isError = false): void {
    this.update(100, text, isError);
    this.timer = window.setTimeout(() => {
      this.root?.remove();
      this.root = null;
      this.timer = null;
    }, isError ? 8000 : 2800);
  }
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

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
