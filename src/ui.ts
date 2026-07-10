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
  onRefreshShares: () => Promise<void>;
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
  private searchQuery = "";
  private tokenVisible = false;

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
        width: "1040px",
        height: "82vh",
      });
      this.dialog.element.classList.add("sishare-setting-dialog");
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
        <span class="sishare-token-field">
          <input class="b3-text-field fn__block" type="${this.tokenVisible ? "text" : "password"}" id="sishare-cloudToken" value="${escapeAttr(this.state.settings.cloudToken)}" placeholder="X-Siyuan-Cloud-Authorization">
          <button class="sishare-token-toggle" type="button" data-action="toggle-token" aria-pressed="${this.tokenVisible}" aria-label="${this.tokenVisible ? "隐藏 Token" : "显示 Token"}" title="${this.tokenVisible ? "隐藏 Token" : "显示 Token"}">${tokenVisibilityIcon(this.tokenVisible)}</button>
        </span>
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
          <option value="title-docid" ${this.state.settings.slugMode === "title-docid" ? "selected" : ""}>标题 + docId 后 8 位</option>
          <option value="title" ${this.state.settings.slugMode === "title" ? "selected" : ""}>标题</option>
        </select>
      </label>
      <label class="sishare-field sishare-checkbox">
        <span class="sishare-label">上传 pages-pub-assets</span>
        <input type="checkbox" id="sishare-uploadSharedAssets" ${this.state.settings.uploadSharedAssets ? "checked" : ""}>
      </label>
    `;
    this.root.appendChild(settings);
    settings.querySelector('[data-action="toggle-token"]')?.addEventListener("click", () => {
      this.tokenVisible = !this.tokenVisible;
      const input = settings.querySelector("#sishare-cloudToken") as HTMLInputElement | null;
      const button = settings.querySelector('[data-action="toggle-token"]') as HTMLButtonElement | null;
      if (input) input.type = this.tokenVisible ? "text" : "password";
      if (button) {
        const label = this.tokenVisible ? "隐藏 Token" : "显示 Token";
        button.innerHTML = tokenVisibilityIcon(this.tokenVisible);
        button.setAttribute("aria-pressed", String(this.tokenVisible));
        button.setAttribute("aria-label", label);
        button.title = label;
      }
    });

    const note = document.createElement("div");
    note.className = "sishare-note";
    note.textContent = "上传目录会直接取源文件根地址中的路径部分；如果填写预览根地址，分享卡片和复制链接会优先使用预览链接。";
    this.root.appendChild(note);

    const shareSection = document.createElement("section");
    shareSection.className = "sishare-share-section";
    shareSection.innerHTML = `
      <div class="sishare-share-head">
        <div class="sishare-share-title-row">
          <h2 class="sishare-share-title">分享列表</h2>
          <span class="sishare-share-count">0 条</span>
        </div>
        <div class="sishare-share-tools">
          <input class="b3-text-field sishare-share-search" type="search" placeholder="搜索文档标题" value="${escapeAttr(this.searchQuery)}" spellcheck="false">
          <button class="b3-button b3-button--outline" data-action="refresh-shares" ${this.state.busy ? "disabled" : ""}>刷新</button>
        </div>
      </div>
      <div class="sishare-share-list"></div>
    `;
    this.root.appendChild(shareSection);

    const searchInput = shareSection.querySelector(".sishare-share-search") as HTMLInputElement | null;
    const list = shareSection.querySelector(".sishare-share-list") as HTMLElement | null;
    const count = shareSection.querySelector(".sishare-share-count") as HTMLElement | null;
    this.renderShareRecords(list, count);
    searchInput?.addEventListener("input", () => {
      this.searchQuery = searchInput.value || "";
      this.renderShareRecords(list, count);
    });
    shareSection.querySelector('[data-action="refresh-shares"]')?.addEventListener("click", () => this.handlers?.onRefreshShares());

    toolbar.querySelector('[data-action="publish"]')?.addEventListener("click", () => this.handlers?.onPublishCurrent());
    toolbar.querySelector('[data-action="refresh"]')?.addEventListener("click", () => this.handlers?.onRefreshStorages());
    toolbar.querySelector('[data-action="save"]')?.addEventListener("click", () => this.saveSettingsFromForm());
  }

  private renderShareRecords(list: HTMLElement | null, count: HTMLElement | null): void {
    if (!list || !this.state) return;
    const keyword = this.searchQuery.trim().toLocaleLowerCase();
    const records = this.state.shares.filter((record) => {
      if (!keyword) return true;
      return String(record.title || "").toLocaleLowerCase().includes(keyword);
    });
    if (count) {
      count.textContent = keyword ? `${records.length} / ${this.state.shares.length} 条` : `${this.state.shares.length} 条`;
    }
    list.innerHTML = "";
    if (!records.length) {
      list.innerHTML = keyword
        ? '<div class="sishare-empty">未找到匹配的分享文档</div>'
        : '<div class="sishare-empty">还没有分享记录，先打开一篇笔记再点击“分享当前文档”。</div>';
      return;
    }
    for (const record of records) {
      list.appendChild(this.createShareCard(record));
    }
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
      slugMode: (this.root.querySelector("#sishare-slugMode") as HTMLSelectElement | null)?.value === "title" ? "title" : "title-docid",
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

function tokenVisibilityIcon(visible: boolean): string {
  return visible
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5.2 9 5.2a14.7 14.7 0 0 1-2.1 2.6M6.6 6.6A15.8 15.8 0 0 0 3 9.2S6.5 14.4 12 14.4c1 0 2-.2 2.8-.5"></path></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5S6.5 4.3 12 4.3s9 5.2 9 5.2-3.5 5.2-9 5.2S3 9.5 3 9.5Z"></path><circle cx="12" cy="9.5" r="2.5"></circle></svg>`;
}
