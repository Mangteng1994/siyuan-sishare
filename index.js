"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => SiSharePlugin
});
module.exports = __toCommonJS(index_exports);
var import_siyuan3 = require("siyuan");

// src/path.ts
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = __toESM(require("node:path"));
var import_node_crypto = __toESM(require("node:crypto"));
function normalizeCloudPath(...parts) {
  const segments = [];
  for (const part of parts) {
    const text = String(part || "").trim().replace(/\\/g, "/");
    if (!text) continue;
    for (const segment of text.split("/")) {
      const current = segment.trim();
      if (!current || current === ".") continue;
      if (current === "..") {
        throw new Error(`\u68C0\u6D4B\u5230\u975E\u6CD5\u8DEF\u5F84\u6BB5 "..": ${parts.join(" / ")}`);
      }
      segments.push(current);
    }
  }
  if (!segments.length) {
    throw new Error("\u4E91\u7AEF\u8DEF\u5F84\u4E0D\u80FD\u4E3A\u7A7A");
  }
  return `/${segments.join("/")}`;
}
function joinUrl(...parts) {
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
function safeTitleSlug(title) {
  const normalizedTitle = String(title || "").normalize("NFKC").replace(/\s+/g, "-").replace(/[/?%*:|"<>#\\[\]{}^`~]+/g, "").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/-+/g, "-").replace(/^[-_.]+|[-_.]+$/g, "");
  return (normalizedTitle || "untitled").slice(0, 96);
}
function safeSlug(title, docId) {
  const base = safeTitleSlug(title);
  const safeDocId = String(docId || "").replace(/[^a-zA-Z0-9]/g, "");
  const suffix = safeDocId.slice(-8) || import_node_crypto.default.createHash("md5").update(`${title}:${docId}`).digest("hex").slice(0, 8);
  return `${base}-${suffix}`.slice(0, 96);
}
function safeDecodeUrl(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.split("/").map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    }).join("/");
    return `${parsed.origin}${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    try {
      return decodeURI(url);
    } catch {
      return url;
    }
  }
}
function mimeFromPath(filePath) {
  const ext = import_node_path.default.extname(filePath).toLowerCase();
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
function walkDirRecursive(dir) {
  const root = import_node_path.default.resolve(dir);
  if (!import_node_fs.default.existsSync(root) || !import_node_fs.default.statSync(root).isDirectory()) {
    return [];
  }
  const results = [];
  const visit = (currentDir) => {
    for (const entry of import_node_fs.default.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = import_node_path.default.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = import_node_fs.default.statSync(absolutePath);
      results.push({
        absolutePath,
        relativePath: import_node_path.default.relative(root, absolutePath).replace(/\\/g, "/"),
        size: stat.size
      });
    }
  };
  visit(root);
  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

// src/settings.ts
var DEFAULT_SETTINGS = {
  cloudToken: "",
  storageId: null,
  storageMountPath: "",
  publicBaseUrl: "",
  previewBaseUrl: "",
  uploadSharedAssets: true,
  includeChildDocuments: false,
  slugMode: "title-docid"
};
function normalizeSettings(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    cloudToken: String(source.cloudToken || "").trim(),
    storageId: Number.isFinite(source.storageId) ? Number(source.storageId) : null,
    storageMountPath: String(source.storageMountPath || "").trim(),
    publicBaseUrl: String(source.publicBaseUrl || "").trim().replace(/\/+$/, ""),
    previewBaseUrl: String(source.previewBaseUrl || "").trim().replace(/\/+$/, ""),
    uploadSharedAssets: source.uploadSharedAssets !== false,
    includeChildDocuments: source.includeChildDocuments === true,
    slugMode: source.slugMode === "title" ? "title" : "title-docid"
  };
}
function normalizeRemoteRoot(value) {
  const text = String(value || "").trim().replace(/\\/g, "/");
  if (!text) {
    return "";
  }
  const normalized = `/${text}`.replace(/\/+/g, "/").replace(/\/+$/, "");
  return normalized === "/" ? "" : normalized;
}
function deriveRemoteRootFromPublicBaseUrl(publicBaseUrl) {
  const value = String(publicBaseUrl || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return normalizeRemoteRoot(
      parsed.pathname.split("/").map((segment) => {
        try {
          return decodeURIComponent(segment);
        } catch {
          return segment;
        }
      }).join("/")
    );
  } catch {
    return "";
  }
}
function isSupportedStorage(storage) {
  const item = storage && typeof storage === "object" ? storage : {};
  return item.driver === "S3" && item.disabled !== true && item.status !== "disabled";
}
function filterSupportedStorages(storages) {
  return (Array.isArray(storages) ? storages : []).filter(isSupportedStorage).map((item) => ({
    id: Number(item.id),
    mount_path: String(item.mount_path || ""),
    driver: String(item.driver || ""),
    remark: String(item.remark || ""),
    status: String(item.status || ""),
    disabled: !!item.disabled
  })).filter((item) => Number.isFinite(item.id) && item.mount_path);
}
function storageLabel(storage) {
  const remark = storage.remark ? ` / ${storage.remark}` : "";
  const status = storage.status ? ` / ${storage.status}` : "";
  return `${storage.mount_path} / ${storage.driver}${remark}${status}`;
}

// src/shareStore.ts
var STORAGE_FILE = "cloud-pages.json";
var ShareStore = class {
  plugin;
  data = {
    settings: DEFAULT_SETTINGS,
    shares: []
  };
  constructor(plugin) {
    this.plugin = plugin;
  }
  async load() {
    const raw = await this.plugin.loadData(STORAGE_FILE).catch(() => null);
    this.data = {
      settings: normalizeSettings(raw?.settings),
      shares: normalizeRecords(raw?.shares)
    };
  }
  async save() {
    await this.plugin.saveData(STORAGE_FILE, this.data);
  }
  getSettings() {
    return { ...this.data.settings };
  }
  async updateSettings(input) {
    this.data.settings = normalizeSettings({
      ...this.data.settings,
      ...input
    });
    await this.save();
    return this.getSettings();
  }
  getShares() {
    return this.data.shares.map((item) => ({ ...item })).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }
  findByDocId(docId) {
    return this.getShares().find((item) => item.docId === docId);
  }
  async upsertShare(record) {
    const normalized = normalizeRecord(record);
    const index = this.data.shares.findIndex((item) => item.id === normalized.id || item.docId === normalized.docId && item.slug === normalized.slug);
    if (index >= 0) {
      const existing = this.data.shares[index];
      this.data.shares[index] = {
        ...existing,
        ...normalized,
        createdAt: existing.createdAt || normalized.createdAt
      };
    } else {
      this.data.shares.push(normalized);
    }
    await this.save();
    return { ...normalized };
  }
  async removeShare(id) {
    this.data.shares = this.data.shares.filter((item) => item.id !== id);
    await this.save();
  }
};
function normalizeRecords(records) {
  return (Array.isArray(records) ? records : []).map(normalizeRecord).filter(Boolean);
}
function normalizeRecord(record) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
    includeChildDocuments: record.includeChildDocuments === true,
    createdAt: String(record.createdAt || record.updatedAt || now),
    updatedAt: String(record.updatedAt || now),
    status: record.status === "failed" || record.status === "pending" ? record.status : "success",
    lastError: record.lastError ? String(record.lastError) : ""
  };
}

// src/ui.ts
var import_siyuan = require("siyuan");
var CloudPagesPanel = class {
  dialog = null;
  pluginName;
  root = null;
  state = null;
  handlers = null;
  searchQuery = "";
  tokenVisible = false;
  settingsSaveQueue = Promise.resolve();
  constructor(pluginName) {
    this.pluginName = pluginName;
  }
  open(state, handlers) {
    this.state = state;
    this.handlers = handlers;
    if (!this.dialog || !document.body.contains(this.dialog.element)) {
      this.dialog = new import_siyuan.Dialog({
        title: "\u4E91\u7AEF\u9759\u6001\u5206\u4EAB",
        content: `<div class="sishare-panel" data-plugin="${this.pluginName}"></div>`,
        width: "1040px",
        height: "82vh"
      });
      this.dialog.element.classList.add("sishare-setting-dialog");
      this.root = this.dialog.element.querySelector(".sishare-panel");
    }
    this.render();
  }
  rerender(state) {
    this.state = state;
    this.render();
  }
  render() {
    if (!this.root || !this.state || !this.handlers) return;
    this.root.innerHTML = "";
    const toolbar = document.createElement("div");
    toolbar.className = "sishare-toolbar";
    toolbar.innerHTML = `
      <button class="b3-button b3-button--outline" data-action="publish" ${this.state.busy ? "disabled" : ""}>\u5206\u4EAB\u5F53\u524D\u6587\u6863</button>
      <button class="b3-button b3-button--outline" data-action="refresh" ${this.state.busy ? "disabled" : ""}>\u5237\u65B0 S3 \u6302\u8F7D</button>
    `;
    this.root.appendChild(toolbar);
    const settings = document.createElement("div");
    settings.className = "sishare-settings-grid";
    settings.innerHTML = `
      <label class="sishare-field">
        <span class="sishare-label">siyuan-cloud Token</span>
        <span class="sishare-token-field">
          <input class="b3-text-field fn__block" type="${this.tokenVisible ? "text" : "password"}" id="sishare-cloudToken" value="${escapeAttr(this.state.settings.cloudToken)}" placeholder="X-Siyuan-Cloud-Authorization">
          <button class="sishare-token-toggle" type="button" data-action="toggle-token" aria-pressed="${this.tokenVisible}" aria-label="${this.tokenVisible ? "\u9690\u85CF Token" : "\u663E\u793A Token"}" title="${this.tokenVisible ? "\u9690\u85CF Token" : "\u663E\u793A Token"}">${tokenVisibilityIcon(this.tokenVisible)}</button>
        </span>
      </label>
      <label class="sishare-field">
        <span class="sishare-label">\u5206\u4EAB\u7F51\u76D8\uFF08\u4EC5 S3\uFF09</span>
        <select class="b3-select fn__block" id="sishare-storageId">
          <option value="">\u8BF7\u9009\u62E9\u6302\u8F7D</option>
          ${this.state.storages.map((item) => `<option value="${item.id}" ${item.id === this.state.settings.storageId ? "selected" : ""}>${escapeHtml(storageLabel(item))}</option>`).join("")}
        </select>
      </label>
      <label class="sishare-field">
        <span class="sishare-label">\u6E90\u6587\u4EF6\u6839\u5730\u5740</span>
        <input class="b3-text-field fn__block" type="text" id="sishare-publicBaseUrl" value="${escapeAttr(this.state.settings.publicBaseUrl)}" placeholder="https://bucket.s3.bitiful.net/notes-share">
      </label>
      <label class="sishare-field">
        <span class="sishare-label">\u9884\u89C8\u6839\u5730\u5740\uFF08\u53EF\u9009\uFF09</span>
        <input class="b3-text-field fn__block" type="text" id="sishare-previewBaseUrl" value="${escapeAttr(this.state.settings.previewBaseUrl)}" placeholder="https://preview.example.com/notes-share">
      </label>
      <label class="sishare-field">
        <span class="sishare-label">Slug \u7B56\u7565</span>
        <select class="b3-select fn__block" id="sishare-slugMode">
          <option value="title-docid" ${this.state.settings.slugMode === "title-docid" ? "selected" : ""}>\u6807\u9898 + docId \u540E 8 \u4F4D</option>
          <option value="title" ${this.state.settings.slugMode === "title" ? "selected" : ""}>\u6807\u9898</option>
        </select>
      </label>
      <label class="sishare-field sishare-checkbox">
        <span class="sishare-label">\u4E0A\u4F20 pages-pub-assets</span>
        <input type="checkbox" id="sishare-uploadSharedAssets" ${this.state.settings.uploadSharedAssets ? "checked" : ""}>
      </label>
      <label class="sishare-field sishare-checkbox">
        <span class="sishare-label">\u5305\u542B\u5B50\u6587\u6863</span>
        <input type="checkbox" id="sishare-includeChildDocuments" ${this.state.settings.includeChildDocuments ? "checked" : ""}>
      </label>
    `;
    this.root.appendChild(settings);
    settings.querySelector('[data-action="toggle-token"]')?.addEventListener("click", () => {
      this.tokenVisible = !this.tokenVisible;
      const input = settings.querySelector("#sishare-cloudToken");
      const button = settings.querySelector('[data-action="toggle-token"]');
      if (input) input.type = this.tokenVisible ? "text" : "password";
      if (button) {
        const label = this.tokenVisible ? "\u9690\u85CF Token" : "\u663E\u793A Token";
        button.innerHTML = tokenVisibilityIcon(this.tokenVisible);
        button.setAttribute("aria-pressed", String(this.tokenVisible));
        button.setAttribute("aria-label", label);
        button.title = label;
      }
    });
    settings.querySelectorAll("input, select").forEach((control) => {
      control.addEventListener("change", () => this.queueSettingsSave());
    });
    const note = document.createElement("div");
    note.className = "sishare-note";
    note.textContent = "\u8BBE\u7F6E\u4FEE\u6539\u540E\u81EA\u52A8\u4FDD\u5B58\u3002\u5F00\u542F\u201C\u5305\u542B\u5B50\u6587\u6863\u201D\u65F6\uFF0C\u5206\u4EAB\u4F1A\u5408\u5E76\u5F53\u524D\u6587\u6863\u4E0B\u7684\u5168\u90E8\u5B50\u6587\u6863\u3002";
    this.root.appendChild(note);
    const shareSection = document.createElement("section");
    shareSection.className = "sishare-share-section";
    shareSection.innerHTML = `
      <div class="sishare-share-head">
        <div class="sishare-share-title-row">
          <h2 class="sishare-share-title">\u5206\u4EAB\u5217\u8868</h2>
          <span class="sishare-share-count">0 \u6761</span>
        </div>
        <div class="sishare-share-tools">
          <input class="b3-text-field sishare-share-search" type="search" placeholder="\u641C\u7D22\u6587\u6863\u6807\u9898" value="${escapeAttr(this.searchQuery)}" spellcheck="false">
          <button class="b3-button b3-button--outline" data-action="refresh-shares" ${this.state.busy ? "disabled" : ""}>\u5237\u65B0</button>
        </div>
      </div>
      <div class="sishare-share-list"></div>
    `;
    this.root.appendChild(shareSection);
    const searchInput = shareSection.querySelector(".sishare-share-search");
    const list = shareSection.querySelector(".sishare-share-list");
    const count = shareSection.querySelector(".sishare-share-count");
    this.renderShareRecords(list, count);
    searchInput?.addEventListener("input", () => {
      this.searchQuery = searchInput.value || "";
      this.renderShareRecords(list, count);
    });
    shareSection.querySelector('[data-action="refresh-shares"]')?.addEventListener("click", () => this.handlers?.onRefreshShares());
    toolbar.querySelector('[data-action="publish"]')?.addEventListener("click", () => this.handlers?.onPublishCurrent());
    toolbar.querySelector('[data-action="refresh"]')?.addEventListener("click", () => this.handlers?.onRefreshStorages());
  }
  renderShareRecords(list, count) {
    if (!list || !this.state) return;
    const keyword = this.searchQuery.trim().toLocaleLowerCase();
    const records = this.state.shares.filter((record) => {
      if (!keyword) return true;
      return String(record.title || "").toLocaleLowerCase().includes(keyword);
    });
    if (count) {
      count.textContent = keyword ? `${records.length} / ${this.state.shares.length} \u6761` : `${this.state.shares.length} \u6761`;
    }
    list.innerHTML = "";
    if (!records.length) {
      list.innerHTML = keyword ? '<div class="sishare-empty">\u672A\u627E\u5230\u5339\u914D\u7684\u5206\u4EAB\u6587\u6863</div>' : '<div class="sishare-empty">\u8FD8\u6CA1\u6709\u5206\u4EAB\u8BB0\u5F55\uFF0C\u5148\u6253\u5F00\u4E00\u7BC7\u7B14\u8BB0\u518D\u70B9\u51FB\u201C\u5206\u4EAB\u5F53\u524D\u6587\u6863\u201D\u3002</div>';
      return;
    }
    for (const record of records) {
      list.appendChild(this.createShareCard(record));
    }
  }
  readSettingsFromForm() {
    if (!this.root) return null;
    const storageIdValue = this.root.querySelector("#sishare-storageId")?.value || "";
    const storageId = storageIdValue ? Number(storageIdValue) : null;
    const storage = this.state?.storages.find((item) => item.id === storageId) || null;
    return {
      cloudToken: this.root.querySelector("#sishare-cloudToken")?.value || "",
      storageId,
      storageMountPath: storage?.mount_path || "",
      publicBaseUrl: this.root.querySelector("#sishare-publicBaseUrl")?.value || "",
      previewBaseUrl: this.root.querySelector("#sishare-previewBaseUrl")?.value || "",
      slugMode: this.root.querySelector("#sishare-slugMode")?.value === "title" ? "title" : "title-docid",
      uploadSharedAssets: !!this.root.querySelector("#sishare-uploadSharedAssets")?.checked,
      includeChildDocuments: !!this.root.querySelector("#sishare-includeChildDocuments")?.checked
    };
  }
  queueSettingsSave() {
    const settings = this.readSettingsFromForm();
    const handlers = this.handlers;
    if (!settings || !handlers) return;
    this.settingsSaveQueue = this.settingsSaveQueue.catch(() => {
    }).then(() => handlers.onSaveSettings(settings)).catch((error) => {
      (0, import_siyuan.showMessage)(`\u8BBE\u7F6E\u4FDD\u5B58\u5931\u8D25: ${formatError(error)}`, 5e3, "error");
    });
  }
  createShareCard(record) {
    const card = document.createElement("div");
    card.className = "sishare-card";
    const hasDedicatedPreview = !!(record.previewBaseUrl && record.previewUrl && record.previewUrl !== record.sourceUrl);
    const primaryUrl = record.previewUrl || record.url || record.sourceUrl;
    const displayPrimaryUrl = safeDecodeUrl(primaryUrl);
    const displaySourceUrl = safeDecodeUrl(record.sourceUrl || record.url);
    const previewBlock = primaryUrl ? `
        <div class="sishare-grid-label">${hasDedicatedPreview ? "\u9884\u89C8\u94FE\u63A5" : "\u8BBF\u95EE\u94FE\u63A5"}</div>
        <div class="sishare-grid-value"><a href="${escapeAttr(primaryUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayPrimaryUrl)}</a></div>
      ` : "";
    const sourceBlock = record.sourceUrl && record.sourceUrl !== primaryUrl ? `
        <div class="sishare-grid-label">\u6E90\u6587\u4EF6\u94FE\u63A5</div>
        <div class="sishare-grid-value"><a href="${escapeAttr(record.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displaySourceUrl)}</a></div>
      ` : "";
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
        <div class="sishare-grid-label">\u8FDC\u7AEF\u8DEF\u5F84</div>
        <div class="sishare-grid-value">${escapeHtml(record.remotePath)}</div>
        ${previewBlock}
        ${sourceBlock}
        <div class="sishare-grid-label">\u66F4\u65B0\u65F6\u95F4</div>
        <div class="sishare-grid-value">${escapeHtml(formatDateTime(record.updatedAt))}</div>
      </div>
      ${errorBlock}
      <div class="sishare-actions">
        <button class="b3-button b3-button--outline" data-action="copy">\u590D\u5236\u94FE\u63A5</button>
        <button class="b3-button b3-button--outline" data-action="update">\u66F4\u65B0\u5206\u4EAB</button>
        <button class="b3-button b3-button--outline b3-button--warning" data-action="delete">\u5220\u9664\u5206\u4EAB</button>
      </div>
    `;
    card.querySelector('[data-action="copy"]')?.addEventListener("click", () => this.handlers?.onCopyUrl(primaryUrl || record.url || record.sourceUrl));
    card.querySelector('[data-action="update"]')?.addEventListener("click", () => this.handlers?.onUpdateShare(record));
    card.querySelector('[data-action="delete"]')?.addEventListener("click", () => this.handlers?.onDeleteShare(record));
    return card;
  }
};
var ProgressOverlay = class {
  root = null;
  timer = null;
  update(percent, text, isError = false) {
    if (!this.root) {
      const root = document.createElement("div");
      root.className = "sishare-progress";
      root.innerHTML = `
        <div class="sishare-progress-card">
          <div class="sishare-progress-title">\u4E91\u7AEF\u5206\u4EAB</div>
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
    const bar = this.root.querySelector(".sishare-progress-bar");
    const textNode = this.root.querySelector(".sishare-progress-text");
    const percentNode = this.root.querySelector(".sishare-progress-percent");
    if (bar) {
      bar.style.width = `${value}%`;
      bar.dataset.error = isError ? "true" : "false";
    }
    if (textNode) textNode.textContent = text;
    if (percentNode) percentNode.textContent = `${value}%`;
  }
  finish(text, isError = false) {
    this.update(100, text, isError);
    this.timer = window.setTimeout(() => {
      this.root?.remove();
      this.root = null;
      this.timer = null;
    }, isError ? 8e3 : 2800);
  }
};
function escapeHtml(text) {
  return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}
function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
function tokenVisibilityIcon(visible) {
  return visible ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5.2 9 5.2a14.7 14.7 0 0 1-2.1 2.6M6.6 6.6A15.8 15.8 0 0 0 3 9.2S6.5 14.4 12 14.4c1 0 2-.2 2.8-.5"></path></svg>` : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5S6.5 4.3 12 4.3s9 5.2 9 5.2-3.5 5.2-9 5.2S3 9.5 3 9.5Z"></path><circle cx="12" cy="9.5" r="2.5"></circle></svg>`;
}

// src/cloudApi.ts
var import_promises = __toESM(require("node:fs/promises"));
var SIYUAN_CLOUD_BASE = "/plugin/private/siyuan-cloud";
var AUTH_HEADER = "X-Siyuan-Cloud-Authorization";
var CloudApiError = class extends Error {
  status;
  code;
  constructor(message, options = {}) {
    super(message);
    this.name = "CloudApiError";
    this.status = options.status;
    this.code = options.code;
  }
};
var SiyuanCloudApi = class {
  token;
  constructor(token) {
    this.token = String(token || "").trim();
  }
  async listStorages() {
    const payload = await this.requestJson("/api/admin/storage/list", { method: "GET" });
    const content = payload?.data?.content || payload?.data || [];
    return Array.isArray(content) ? content : [];
  }
  async list(pathValue) {
    return this.requestJson("/api/fs/list", {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        path: pathValue,
        page: 1,
        per_page: 100,
        refresh: false
      })
    });
  }
  async mkdir(pathValue) {
    await this.requestJson("/api/fs/mkdir", {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({ path: pathValue })
    });
  }
  async remove(dir, names) {
    await this.requestJson("/api/fs/remove", {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({ dir, names })
    });
  }
  async putText(pathValue, content, contentType) {
    const bytes = new TextEncoder().encode(content);
    await this.putBytes(pathValue, bytes, contentType);
  }
  async putBinary(pathValue, filePath, contentType) {
    const buffer = await import_promises.default.readFile(filePath);
    await this.putBytes(pathValue, buffer, contentType || mimeFromPath(filePath));
  }
  async putBytes(pathValue, body, contentType) {
    const payload = Uint8Array.from(body).buffer;
    const response = await fetch(`${SIYUAN_CLOUD_BASE}/api/fs/put`, {
      method: "PUT",
      headers: {
        ...this.authHeaders(),
        "Content-Type": contentType,
        "File-Path": encodeURIComponent(pathValue),
        Overwrite: "true"
      },
      body: new Blob([payload], { type: contentType })
    });
    await this.ensureHttpSuccess(response, "\u6587\u4EF6\u4E0A\u4F20\u5931\u8D25");
    await this.ensurePayloadSuccess(await response.text());
  }
  async putFileFromDisk(pathValue, filePath) {
    const mime = mimeFromPath(filePath);
    if (/^(?:text\/|application\/(?:javascript|json|xml)|image\/svg\+xml)/i.test(mime)) {
      const text = await import_promises.default.readFile(filePath, "utf8");
      await this.putText(pathValue, text, mime);
      return;
    }
    await this.putBinary(pathValue, filePath, mime);
  }
  async ensureWritable(rootPath) {
    const probeName = `.sishare-probe-${Date.now()}`;
    const probePath = `${rootPath}/${probeName}`.replace(/\/+/g, "/");
    await this.mkdir(rootPath);
    await this.mkdir(probePath);
    await this.remove(rootPath, [probeName]);
  }
  async createShareRecord(id, files, remark = "") {
    await this.requestJson("/api/share/create", {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        id,
        files,
        remark
      })
    });
  }
  async updateShareRecord(id, files, remark = "") {
    await this.requestJson("/api/share/update", {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        id,
        new_id: id,
        files,
        remark
      })
    });
  }
  async deleteShareRecord(id) {
    await this.requestJson("/api/share/delete", {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({ id })
    });
  }
  authHeaders(headers = {}) {
    return this.token ? { ...headers, [AUTH_HEADER]: this.token } : headers;
  }
  jsonHeaders() {
    return this.authHeaders({
      "Content-Type": "application/json"
    });
  }
  async requestJson(pathValue, init) {
    const response = await fetch(`${SIYUAN_CLOUD_BASE}${pathValue}`, {
      ...init,
      headers: this.authHeaders(normalizeHeaders(init.headers))
    });
    const text = await response.text();
    if (!response.ok) {
      const detail = text || `HTTP ${response.status}`;
      throw this.classifyHttpError(response.status, detail);
    }
    const payload = text ? JSON.parse(text) : {};
    if (payload.code && payload.code !== 200) {
      throw this.classifyBusinessError(payload.code, payload.message || `Siyuan Cloud code ${payload.code}`);
    }
    return payload;
  }
  async ensureHttpSuccess(response, fallback) {
    if (response.ok) return;
    const text = await response.text().catch(() => "");
    throw this.classifyHttpError(response.status, text || fallback);
  }
  async ensurePayloadSuccess(text) {
    if (!text) return;
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      return;
    }
    if (payload?.code && payload.code !== 200) {
      throw this.classifyBusinessError(payload.code, payload.message || `Siyuan Cloud code ${payload.code}`);
    }
  }
  classifyHttpError(status, message) {
    if (status === 404) {
      return new CloudApiError("siyuan-cloud \u672A\u5B89\u88C5\u3001\u672A\u542F\u7528\uFF0C\u6216\u79C1\u6709 API \u8DEF\u7531\u4E0D\u53EF\u7528", { status });
    }
    if (status === 401 || status === 403) {
      return new CloudApiError("Token \u9519\u8BEF\u6216\u6743\u9650\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u8BBF\u95EE siyuan-cloud", { status });
    }
    return new CloudApiError(message || `HTTP ${status}`, { status });
  }
  classifyBusinessError(code, message) {
    const lower = String(message || "").toLowerCase();
    if (lower.includes("permission")) {
      return new CloudApiError("Token \u6743\u9650\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u6267\u884C\u5F53\u524D\u64CD\u4F5C", { code });
    }
    if (lower.includes("sharing not found")) {
      return new CloudApiError("\u672A\u627E\u5230\u5BF9\u5E94\u7684 siyuan-cloud \u5206\u4EAB\u8BB0\u5F55", { code });
    }
    return new CloudApiError(message || `Siyuan Cloud code ${code}`, { code });
  }
};
function normalizeHeaders(headers) {
  const result = {};
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

// src/exporter.ts
var import_node_fs2 = __toESM(require("node:fs"));
var import_promises2 = __toESM(require("node:fs/promises"));
var import_node_path2 = __toESM(require("node:path"));
var import_node_crypto2 = __toESM(require("node:crypto"));
var import_node_os = __toESM(require("node:os"));
var import_siyuan2 = require("siyuan");
var SHARED_ASSETS_DIR = "pages-pub-assets";
var SHARED_ASSET_FOLDERS = ["appearance", "stage", "link-icon"];
var currentProtyle = null;
var lastActiveDocInfo = null;
function setCurrentProtyle(protyle) {
  currentProtyle = protyle || null;
}
function clearTrackedDocContext() {
  currentProtyle = null;
  lastActiveDocInfo = null;
}
async function refreshTrackedDocInfo(source = "active-protyle") {
  const info = await getCurrentDocInfoSafe({ allowCache: false });
  if (info.docId) {
    return applyCurrentDocInfo({ ...info, source });
  }
  return info;
}
async function getCurrentDocInfoSafe(options = {}) {
  const readers = [
    () => extractDocInfoFromProtyle(currentProtyle, "active-protyle"),
    getCurrentDocInfoFromSelection,
    getCurrentDocInfoFromTab,
    getCurrentDocInfoFromSiyuanLayout
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
function buildRecordId(docId, slug) {
  return `${docId}:${slug}`;
}
function buildSlug(title, docId, mode = "title-docid") {
  return mode === "title" ? safeTitleSlug(title) : safeSlug(title, docId);
}
async function publishToSiyuanCloud(input) {
  validateSettings(input.settings);
  const api = new SiyuanCloudApi(input.settings.cloudToken);
  const warnings = [];
  const taskId = import_node_crypto2.default.randomUUID();
  const tempRoot = await createTempWorkspaceDir(taskId);
  const slug = input.slug || buildSlug(input.title, input.docId, input.settings.slugMode);
  const targetDir = import_node_path2.default.join(tempRoot, slug);
  const sharedRoot = import_node_path2.default.join(tempRoot, SHARED_ASSETS_DIR);
  const remoteRootPath = resolveRemoteRootPath(input.settings);
  const remotePagePath = normalizeCloudPath(remoteRootPath, slug);
  const remoteAssetsPath = normalizeCloudPath(remotePagePath, "assets");
  const remoteSharedPath = normalizeCloudPath(remoteRootPath, SHARED_ASSETS_DIR);
  try {
    input.onProgress?.(5, "\u68C0\u67E5\u914D\u7F6E");
    await api.listStorages();
    await api.ensureWritable(remoteRootPath);
    input.onProgress?.(12, "\u8BFB\u53D6\u5F53\u524D\u6587\u6863");
    const exported = await exportDocumentToTarget({
      docId: input.docId,
      title: input.title,
      slug,
      tempRoot,
      targetDir,
      includeChildDocuments: input.settings.includeChildDocuments
    });
    input.onProgress?.(34, "\u6574\u7406\u8D44\u6E90");
    consolidateSharedAssets(sharedRoot, targetDir);
    input.onProgress?.(45, "\u6821\u9A8C\u8D44\u6E90");
    const validation = validatePublishedHtml(targetDir, tempRoot);
    if (!validation.ok) {
      const issues = [
        validation.invalidPaths.length ? `\u672C\u5730\u7EDD\u5BF9\u8DEF\u5F84: ${validation.invalidPaths.slice(0, 6).join(", ")}` : "",
        validation.missingAssets.length ? `\u7F3A\u5931\u8D44\u6E90: ${validation.missingAssets.slice(0, 6).join(", ")}` : "",
        validation.tempLeaks.length ? `\u4E34\u65F6\u76EE\u5F55\u6CC4\u6F0F: ${validation.tempLeaks.slice(0, 6).join(", ")}` : ""
      ].filter(Boolean).join("\uFF1B");
      throw new Error(`\u5BFC\u51FA HTML \u6821\u9A8C\u5931\u8D25\u3002${issues}`);
    }
    input.onProgress?.(56, "\u521B\u5EFA\u8FDC\u7AEF\u76EE\u5F55");
    await ensureRemoteDirectories(api, remoteRootPath, remotePagePath, remoteAssetsPath, remoteSharedPath, targetDir, sharedRoot, input.settings.uploadSharedAssets);
    if (input.settings.uploadSharedAssets) {
      input.onProgress?.(68, "\u4E0A\u4F20\u5171\u4EAB\u8D44\u6E90");
      await uploadDirectory(api, sharedRoot, remoteSharedPath);
    }
    input.onProgress?.(82, "\u4E0A\u4F20\u9875\u9762\u8D44\u6E90");
    await uploadPageFiles(api, targetDir, remotePagePath);
    input.onProgress?.(94, "\u4E0A\u4F20 index.html");
    await api.putFileFromDisk(normalizeCloudPath(remotePagePath, "index.html"), import_node_path2.default.join(targetDir, "index.html"));
    input.onProgress?.(97, "\u751F\u6210\u5206\u4EAB\u94FE\u63A5");
    const encodedSlug = encodeURIComponent(slug);
    const sourceUrl = joinUrl(input.settings.publicBaseUrl, encodedSlug, "index.html");
    const previewUrl = input.settings.previewBaseUrl ? joinUrl(input.settings.previewBaseUrl, encodedSlug, "index.html") : sourceUrl;
    const url = previewUrl;
    if (!/^https?:\/\//i.test(sourceUrl)) {
      warnings.push("\u4E0A\u4F20\u6210\u529F\uFF0C\u4F46 publicBaseUrl \u4E0D\u662F\u6807\u51C6 http(s) \u5730\u5740\uFF0C\u751F\u6210\u94FE\u63A5\u53EF\u80FD\u4E0D\u53EF\u8BBF\u95EE\u3002");
    }
    if (!input.settings.previewBaseUrl) {
      try {
        const previewBehavior = await detectAttachmentDownload(sourceUrl);
        if (previewBehavior === "attachment") {
          warnings.push("\u5F53\u524D\u6E90\u6587\u4EF6\u57DF\u540D\u8FD4\u56DE attachment \u4E0B\u8F7D\u5934\uFF0C\u6D4F\u89C8\u5668\u4F1A\u76F4\u63A5\u4E0B\u8F7D\u800C\u4E0D\u662F\u5728\u7EBF\u9884\u89C8\u3002\u5EFA\u8BAE\u989D\u5916\u914D\u7F6E\u9884\u89C8\u6839\u5730\u5740\u3002");
        }
      } catch {
      }
    }
    input.onProgress?.(100, "\u5B8C\u6210");
    return {
      exportedTitle: exported.exportedTitle || input.title,
      slug,
      url,
      previewUrl,
      sourceUrl,
      remoteRootPath,
      remotePagePath,
      warnings
    };
  } finally {
    await import_promises2.default.rm(tempRoot, { recursive: true, force: true }).catch(() => {
    });
  }
}
async function deleteRemoteShare(input) {
  validateSettings(input.settings);
  const api = new SiyuanCloudApi(input.settings.cloudToken);
  const remoteRootPath = resolveRemoteRootPath(input.settings);
  input.onProgress?.(20, "\u68C0\u67E5\u914D\u7F6E");
  await api.listStorages();
  input.onProgress?.(60, "\u5220\u9664\u8FDC\u7AEF\u76EE\u5F55");
  await api.remove(remoteRootPath, [input.slug]);
  input.onProgress?.(100, "\u5B8C\u6210");
}
function validateSettings(settings) {
  if (!settings.cloudToken) {
    throw new Error("\u8BF7\u5148\u914D\u7F6E siyuan-cloud Token");
  }
  if (!settings.storageId || !settings.storageMountPath) {
    throw new Error("\u8BF7\u5148\u9009\u62E9\u53EF\u7528\u7684 S3 \u6302\u8F7D");
  }
  if (!settings.publicBaseUrl) {
    throw new Error("publicBaseUrl \u672A\u914D\u7F6E\uFF0C\u65E0\u6CD5\u751F\u6210\u516C\u7F51\u5206\u4EAB\u94FE\u63A5");
  }
  try {
    const parsed = new URL(settings.publicBaseUrl);
    if (!/^https?:$/i.test(parsed.protocol)) {
      throw new Error("publicBaseUrl \u5FC5\u987B\u662F http(s) \u5730\u5740");
    }
  } catch {
    throw new Error("publicBaseUrl \u5FC5\u987B\u662F\u5B8C\u6574\u7684 http(s) \u5730\u5740");
  }
  if (settings.previewBaseUrl) {
    try {
      const parsed = new URL(settings.previewBaseUrl);
      if (!/^https?:$/i.test(parsed.protocol)) {
        throw new Error("previewBaseUrl \u5FC5\u987B\u662F http(s) \u5730\u5740");
      }
    } catch {
      throw new Error("previewBaseUrl \u5FC5\u987B\u662F\u5B8C\u6574\u7684 http(s) \u5730\u5740");
    }
  }
}
function resolveRemoteRootPath(settings) {
  const derivedRoot = deriveRemoteRootFromPublicBaseUrl(settings.publicBaseUrl);
  return derivedRoot ? normalizeCloudPath(settings.storageMountPath, derivedRoot) : normalizeCloudPath(settings.storageMountPath);
}
async function detectAttachmentDownload(url) {
  const response = await fetch(url, {
    method: "HEAD",
    redirect: "follow"
  });
  if (!response.ok) return "unknown";
  const disposition = String(response.headers.get("content-disposition") || "").toLowerCase();
  const forceAttachment = String(response.headers.get("x-bitiful-force-attachment") || "").toLowerCase();
  if (disposition.includes("attachment") || forceAttachment === "true") {
    return "attachment";
  }
  return "inline";
}
async function createTempWorkspaceDir(taskId) {
  const workspaceDir = String(globalThis.window?.siyuan?.config?.system?.workspaceDir || "").trim();
  const base = workspaceDir ? import_node_path2.default.join(workspaceDir, "temp", "siyuan-cloud-pages") : import_node_path2.default.join(import_node_os.default.tmpdir(), "siyuan-cloud-pages");
  const dir = import_node_path2.default.join(base, taskId);
  await import_promises2.default.mkdir(dir, { recursive: true });
  return dir;
}
async function exportDocumentToTarget(options) {
  const exportStartedAt = Date.now();
  const exportResp = await (0, import_siyuan2.fetchSyncPost)("/api/export/exportHTML", {
    id: options.docId,
    pdf: false,
    removeAssets: false,
    merge: options.includeChildDocuments,
    savePath: ""
  });
  if (!exportResp || exportResp.code !== 0 || !exportResp.data) {
    throw new Error(`\u5BFC\u51FA\u5931\u8D25: ${exportResp?.msg || "\u672A\u77E5\u9519\u8BEF"}`);
  }
  ensureEmptyDir(options.targetDir);
  const exportedTitle = String(exportResp.data.name || options.title || "").trim() || options.title;
  let copied = copyNativeExportFolder(exportResp.data.folder, options.targetDir);
  if (!copied) {
    const savedResp = await (0, import_siyuan2.fetchSyncPost)("/api/export/exportHTML", {
      id: options.docId,
      pdf: false,
      removeAssets: false,
      merge: options.includeChildDocuments,
      savePath: options.targetDir
    });
    if (!savedResp || savedResp.code !== 0 || !savedResp.data) {
      throw new Error(`\u8D44\u6E90\u5BFC\u51FA\u5931\u8D25: ${savedResp?.msg || "\u672A\u77E5\u9519\u8BEF"}`);
    }
    copied = true;
  }
  const content = String(exportResp.data.content || "").trim();
  if (!content) {
    throw new Error("\u5BFC\u51FA\u7ED3\u679C\u7F3A\u5C11 HTML \u5185\u5BB9");
  }
  const html = buildSiYuanNativeHTML(content, exportedTitle, {
    targetDir: options.targetDir,
    sharedBase: `../${SHARED_ASSETS_DIR}`,
    buildToken: String(exportStartedAt)
  });
  await import_promises2.default.writeFile(import_node_path2.default.join(options.targetDir, "index.html"), html, "utf8");
  const resolved = resolveExportOutput({
    baseDir: options.tempRoot,
    targetDir: options.targetDir,
    title: options.title,
    exportedTitle,
    slug: options.slug,
    exportStartedAt
  });
  if (!resolved) {
    throw new Error("\u5BFC\u51FA\u5931\u8D25\uFF1A\u672A\u627E\u5230\u6709\u6548\u7684 index.html");
  }
  return { exportedTitle };
}
function resolveExportOutput(input) {
  normalizeExportLayout(input.targetDir, input.exportedTitle);
  if (hasIndex(input.targetDir)) {
    return true;
  }
  const candidates = [
    import_node_path2.default.join(input.baseDir, input.slug),
    import_node_path2.default.join(input.baseDir, input.exportedTitle),
    import_node_path2.default.join(input.baseDir, input.title)
  ];
  for (const candidate of candidates) {
    if (!import_node_fs2.default.existsSync(candidate) || !import_node_fs2.default.statSync(candidate).isDirectory()) continue;
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
function hasIndex(dir) {
  return import_node_fs2.default.existsSync(import_node_path2.default.join(dir, "index.html"));
}
function normalizeExportLayout(targetDir, exportedTitle) {
  if (!import_node_fs2.default.existsSync(targetDir) || hasIndex(targetDir)) return;
  const candidates = [];
  if (exportedTitle) {
    candidates.push(import_node_path2.default.join(targetDir, exportedTitle));
  }
  for (const entry of safeReadDir(targetDir)) {
    if (entry.isDirectory()) {
      candidates.push(import_node_path2.default.join(targetDir, entry.name));
    }
  }
  for (const candidate of candidates) {
    if (hasIndex(candidate)) {
      moveChildrenToDir(candidate, targetDir);
      return;
    }
  }
}
function moveChildrenToDir(srcDir, dstDir) {
  for (const entry of safeReadDir(srcDir)) {
    const from = import_node_path2.default.join(srcDir, entry.name);
    const to = import_node_path2.default.join(dstDir, entry.name);
    if (import_node_fs2.default.existsSync(to)) {
      import_node_fs2.default.rmSync(to, { recursive: true, force: true });
    }
    import_node_fs2.default.renameSync(from, to);
  }
  import_node_fs2.default.rmSync(srcDir, { recursive: true, force: true });
}
function pickRootHtmlCandidate(baseDir, slug, title, exportedTitle, exportStartedAt) {
  const candidates = [
    import_node_path2.default.join(baseDir, `${slug}.html`),
    import_node_path2.default.join(baseDir, `${title}.html`),
    import_node_path2.default.join(baseDir, `${exportedTitle}.html`)
  ];
  for (const entry of safeReadDir(baseDir)) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".html") && entry.name.toLowerCase() !== "index.html") {
      candidates.push(import_node_path2.default.join(baseDir, entry.name));
    }
  }
  for (const candidate of candidates) {
    if (!import_node_fs2.default.existsSync(candidate)) continue;
    const stat = import_node_fs2.default.statSync(candidate);
    if (stat.isFile() && stat.mtimeMs >= exportStartedAt - 3e4) {
      return candidate;
    }
  }
  return null;
}
function buildTargetFromFlatRoot(baseDir, targetDir, htmlPath) {
  ensureEmptyDir(targetDir);
  import_node_fs2.default.copyFileSync(htmlPath, import_node_path2.default.join(targetDir, "index.html"));
  for (const name of ["appearance", "stage", "assets", "link-icon"]) {
    const src = import_node_path2.default.join(baseDir, name);
    if (import_node_fs2.default.existsSync(src) && import_node_fs2.default.statSync(src).isDirectory()) {
      copyRecursive(src, import_node_path2.default.join(targetDir, name));
    }
  }
}
function copyNativeExportFolder(folder, targetDir) {
  if (!folder) return false;
  const workspaceDir = String(globalThis.window?.siyuan?.config?.system?.workspaceDir || "").trim();
  const candidates = [
    folder,
    import_node_path2.default.resolve(folder),
    workspaceDir ? import_node_path2.default.join(workspaceDir, folder) : "",
    workspaceDir ? import_node_path2.default.join(workspaceDir, "temp", folder) : ""
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (!import_node_fs2.default.existsSync(candidate) || !import_node_fs2.default.statSync(candidate).isDirectory()) continue;
      copyRecursive(candidate, targetDir);
      return true;
    } catch {
    }
  }
  return false;
}
function consolidateSharedAssets(sharedRoot, targetDir) {
  import_node_fs2.default.mkdirSync(sharedRoot, { recursive: true });
  for (const name of SHARED_ASSET_FOLDERS) {
    const src = import_node_path2.default.join(targetDir, name);
    if (!import_node_fs2.default.existsSync(src)) continue;
    copyRecursiveSmart(src, import_node_path2.default.join(sharedRoot, name));
    import_node_fs2.default.rmSync(src, { recursive: true, force: true });
  }
}
function ensureEmptyDir(dir) {
  import_node_fs2.default.rmSync(dir, { recursive: true, force: true });
  import_node_fs2.default.mkdirSync(dir, { recursive: true });
}
function copyDirToTarget(srcDir, targetDir) {
  ensureEmptyDir(targetDir);
  copyRecursive(srcDir, targetDir);
}
function copyRecursive(src, dst) {
  const stat = import_node_fs2.default.statSync(src);
  if (stat.isDirectory()) {
    import_node_fs2.default.mkdirSync(dst, { recursive: true });
    for (const entry of safeReadDir(src)) {
      copyRecursive(import_node_path2.default.join(src, entry.name), import_node_path2.default.join(dst, entry.name));
    }
    return;
  }
  import_node_fs2.default.mkdirSync(import_node_path2.default.dirname(dst), { recursive: true });
  import_node_fs2.default.copyFileSync(src, dst);
}
function copyRecursiveSmart(src, dst) {
  const stat = import_node_fs2.default.statSync(src);
  if (stat.isDirectory()) {
    import_node_fs2.default.mkdirSync(dst, { recursive: true });
    for (const entry of safeReadDir(src)) {
      copyRecursiveSmart(import_node_path2.default.join(src, entry.name), import_node_path2.default.join(dst, entry.name));
    }
    return;
  }
  import_node_fs2.default.mkdirSync(import_node_path2.default.dirname(dst), { recursive: true });
  if (!import_node_fs2.default.existsSync(dst) || import_node_fs2.default.statSync(dst).size !== stat.size) {
    import_node_fs2.default.copyFileSync(src, dst);
  }
}
function validatePublishedHtml(targetDir, tempRoot) {
  const indexPath = import_node_path2.default.join(targetDir, "index.html");
  if (!import_node_fs2.default.existsSync(indexPath)) {
    return { ok: false, invalidPaths: [], missingAssets: ["index.html"], tempLeaks: [] };
  }
  const html = import_node_fs2.default.readFileSync(indexPath, "utf8");
  const invalidPaths = [];
  const missingAssets = [];
  const tempLeaks = [];
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
    const refPath = splitResourceRef(raw).path.replace(/\//g, import_node_path2.default.sep);
    const resolved = import_node_path2.default.resolve(targetDir, refPath);
    if (!import_node_fs2.default.existsSync(resolved)) {
      missingAssets.push(raw);
    }
  }
  return {
    ok: invalidPaths.length === 0 && missingAssets.length === 0 && tempLeaks.length === 0,
    invalidPaths: Array.from(new Set(invalidPaths)),
    missingAssets: Array.from(new Set(missingAssets)),
    tempLeaks: Array.from(new Set(tempLeaks))
  };
}
function buildSiYuanNativeHTML(content, title, options) {
  const prepared = preparePublishedContent(content, {
    targetDir: options.targetDir,
    sharedBase: options.sharedBase
  });
  const siyuan = globalThis.window?.siyuan || {};
  const appearance = siyuan.config?.appearance || {};
  const lang = appearance.lang || "zh_CN";
  const lightTheme = appearance.themeLight || "daylight";
  const darkTheme = appearance.themeDark || "midnight";
  const mode = Number(appearance.mode || 0);
  const themeName = mode === 1 ? darkTheme : lightTheme;
  const themeMode = mode === 1 ? "dark" : "light";
  const tocStateClass = prepared.hasToc ? "" : " pages-pub-toc--empty";
  const bodyStateClass = prepared.hasToc ? "" : " pages-pub-no-toc";
  return `<!DOCTYPE html>
<html lang="${escapeAttr2(lang)}" data-theme-mode="${escapeAttr2(themeMode)}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml2(title || "Untitled")}</title>
  <link rel="stylesheet" href="${escapeAttr2(options.sharedBase)}/stage/build/export/base.css?v=${escapeAttr2(options.buildToken)}">
  <link rel="stylesheet" href="${escapeAttr2(options.sharedBase)}/appearance/themes/${escapeAttr2(themeName)}/theme.css?v=${escapeAttr2(options.buildToken)}">
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
    <aside id="pages-pub-toc" aria-label="\u76EE\u5F55" class="${tocStateClass.trim()}">
      <div class="pages-pub-toc__head">
        <div class="pages-pub-toc__title">\u76EE\u5F55</div>
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
function preparePublishedContent(content, options) {
  const parser = getDomParser();
  if (!parser) {
    return {
      contentHtml: content,
      tocHtml: '<div class="pages-pub-toc-empty">\u6682\u65E0\u76EE\u5F55</div>',
      hasToc: false
    };
  }
  const doc = parser.parseFromString(`<div id="pages-pub-root">${content}</div>`, "text/html");
  const root = doc.getElementById("pages-pub-root");
  if (!root) {
    return {
      contentHtml: content,
      tocHtml: '<div class="pages-pub-toc-empty">\u6682\u65E0\u76EE\u5F55</div>',
      hasToc: false
    };
  }
  const copiedMap = /* @__PURE__ */ new Map();
  for (const el of Array.from(root.querySelectorAll("link[href], script[src], img[src], source[src]"))) {
    const attr = el.hasAttribute("href") ? "href" : "src";
    const raw = String(el.getAttribute(attr) || "");
    const rewritten = rewritePublishedResourcePath(raw, {
      targetDir: options.targetDir,
      sharedBase: options.sharedBase,
      copiedMap
    });
    if (rewritten.ok && rewritten.value !== raw) {
      el.setAttribute(attr, rewritten.value);
    }
  }
  const tocItems = buildStaticTocData(root);
  return {
    contentHtml: root.innerHTML,
    tocHtml: tocItems.length ? tocItems.map((item) => `<a class="pages-pub-toc-link toc-level-${item.level}" href="#${escapeAttr2(item.id)}">${escapeHtml2(item.text)}</a>`).join("") : '<div class="pages-pub-toc-empty">\u6682\u65E0\u76EE\u5F55</div>',
    hasToc: tocItems.length > 0
  };
}
function rewritePublishedResourcePath(ref, options) {
  const { path: rawPath, suffix } = splitResourceRef(ref);
  const trimmed = rawPath.trim();
  if (!trimmed || trimmed.startsWith("#") || isExternalResourceRef(trimmed)) {
    return { ok: true, value: trimmed + suffix };
  }
  if (isLocalAbsoluteResource(trimmed)) {
    const localPath = extractLocalFilePath(trimmed);
    if (!localPath || !import_node_fs2.default.existsSync(localPath) || !import_node_fs2.default.statSync(localPath).isFile()) {
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
function copyPublishedDependencyFile(sourcePath, targetDir, copiedMap) {
  const cacheKey = import_node_path2.default.resolve(sourcePath);
  if (copiedMap.has(cacheKey)) {
    return copiedMap.get(cacheKey);
  }
  const ext = import_node_path2.default.extname(sourcePath);
  const name = `${import_node_path2.default.basename(sourcePath, ext)}-${hashString(cacheKey).slice(0, 8)}${ext}`;
  const relativePath = `./assets/published/${name}`;
  const outputPath = import_node_path2.default.join(targetDir, "assets", "published", name);
  import_node_fs2.default.mkdirSync(import_node_path2.default.dirname(outputPath), { recursive: true });
  import_node_fs2.default.copyFileSync(sourcePath, outputPath);
  copiedMap.set(cacheKey, relativePath);
  return relativePath;
}
function buildStaticTocData(root) {
  const selector = [
    "h1",
    "h2",
    "h3",
    "[data-type='NodeHeading']",
    "[data-type~='NodeHeading']",
    "[data-subtype='h1']",
    "[data-subtype='h2']",
    "[data-subtype='h3']"
  ].join(",");
  const items = [];
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
async function ensureRemoteDirectories(api, remoteRootPath, remotePagePath, remoteAssetsPath, remoteSharedPath, targetDir, sharedRoot, uploadSharedAssets) {
  const dirSet = /* @__PURE__ */ new Set([remoteRootPath, remotePagePath, remoteAssetsPath]);
  for (const entry of walkDirRecursive(targetDir)) {
    const parent = import_node_path2.default.posix.dirname(normalizeCloudPath(remotePagePath, entry.relativePath));
    collectParentDirs(parent).forEach((item) => dirSet.add(item));
  }
  if (uploadSharedAssets) {
    dirSet.add(remoteSharedPath);
    for (const entry of walkDirRecursive(sharedRoot)) {
      const parent = import_node_path2.default.posix.dirname(normalizeCloudPath(remoteSharedPath, entry.relativePath));
      collectParentDirs(parent).forEach((item) => dirSet.add(item));
    }
  }
  const sorted = Array.from(dirSet).sort((a, b) => a.split("/").length - b.split("/").length);
  for (const dir of sorted) {
    await api.mkdir(dir);
  }
}
async function uploadDirectory(api, localDir, remoteBase) {
  for (const entry of walkDirRecursive(localDir)) {
    const remotePath = normalizeCloudPath(remoteBase, entry.relativePath);
    await api.putFileFromDisk(remotePath, entry.absolutePath);
  }
}
async function uploadPageFiles(api, targetDir, remotePagePath) {
  const allFiles = walkDirRecursive(targetDir);
  const assetFiles = allFiles.filter((item) => item.relativePath.startsWith("assets/"));
  const otherFiles = allFiles.filter((item) => item.relativePath !== "index.html" && !item.relativePath.startsWith("assets/"));
  for (const entry of [...assetFiles, ...otherFiles]) {
    const remotePath = normalizeCloudPath(remotePagePath, entry.relativePath);
    await api.putFileFromDisk(remotePath, entry.absolutePath);
  }
}
function collectParentDirs(fullPath) {
  const parts = fullPath.split("/").filter(Boolean);
  const result = [];
  for (let i = 0; i < parts.length; i += 1) {
    result.push(`/${parts.slice(0, i + 1).join("/")}`);
  }
  return result;
}
function getCurrentTitleFromDOM() {
  const selectors = [
    ".layout__wnd--active .protyle-title__input",
    ".layout__wnd--active .protyle-background__title",
    ".item--focus .item__text",
    ".layout-tab-bar .item--focus"
  ];
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    const value = String(node?.value || node?.textContent || node?.getAttribute?.("aria-label") || "").trim();
    if (value) return value;
  }
  return "";
}
function getDocIdFromElement(node) {
  if (!node || typeof node.closest !== "function") return "";
  const candidates = [
    node,
    node.closest("[data-doc-id]"),
    node.closest("[data-root-id]"),
    node.closest("[data-node-id]"),
    node.closest(".protyle"),
    node.closest(".layout-tab-container")
  ].filter(Boolean);
  for (const item of candidates) {
    const values = [
      item.getAttribute?.("data-doc-id"),
      item.getAttribute?.("data-root-id"),
      item.getAttribute?.("data-node-id"),
      item.getAttribute?.("data-id"),
      item.dataset?.docId,
      item.dataset?.rootId,
      item.dataset?.nodeId,
      item.dataset?.id
    ].filter(Boolean);
    const match = values.find((value) => /^\d{14}-[a-z0-9]+$/i.test(String(value).trim()));
    if (match) return String(match).trim();
  }
  return "";
}
function applyCurrentDocInfo(info) {
  const normalized = normalizeDocInfo(info, info.source || "fallback");
  if (!normalized.docId) return normalized;
  lastActiveDocInfo = {
    ...normalized,
    title: normalized.title || normalized.docId,
    updatedAt: Date.now()
  };
  return normalized;
}
function normalizeDocInfo(info, source = "fallback") {
  return {
    docId: String(info.docId || "").trim(),
    title: String(info.title || "").trim(),
    source: String(info.source || source || "fallback")
  };
}
function getDocTitleFromProtyle(protyle) {
  if (!protyle) return "";
  const block = protyle.block || protyle.model || {};
  const directTitle = block.title || block.name || protyle.title || protyle.docTitle;
  if (directTitle) return String(directTitle).trim();
  const element = protyle.element || protyle.protyle?.element || protyle.wysiwyg?.element || null;
  if (!element || typeof element.querySelector !== "function") return "";
  const selectors = [
    ".protyle-title__input",
    ".protyle-background__title",
    "[data-type='NodeDocument'] .protyle-title__input"
  ];
  for (const selector of selectors) {
    const node = element.querySelector(selector);
    const value = String(node?.value || node?.textContent || "").trim();
    if (value) return value;
  }
  return "";
}
function extractDocInfoFromProtyle(protyle, source = "active-protyle") {
  if (!protyle) return normalizeDocInfo({}, source);
  const block = protyle.block || protyle.model || {};
  const element = protyle.element || protyle.protyle?.element || protyle.wysiwyg?.element || null;
  const docId = String(
    block.rootID || block.rootId || block.id || protyle.rootID || protyle.rootId || getDocIdFromElement(element) || ""
  ).trim();
  const title = getDocTitleFromProtyle(protyle) || getCurrentTitleFromDOM() || "";
  return normalizeDocInfo({ docId, title, source }, source);
}
async function readDocMetaById(docId) {
  const id = String(docId || "").trim();
  if (!id) return null;
  try {
    const result = await (0, import_siyuan2.fetchSyncPost)("/api/block/getBlockInfo", { id });
    if (!result || result.code !== 0 || !result.data) return null;
    const data = result.data || {};
    const title = String(data.rootTitle || data.title || data.name || data.pathName || data.hPath || "").trim();
    const rootID = String(data.rootID || data.rootId || data.id || id).trim();
    return {
      docId: rootID || id,
      title
    };
  } catch {
    return null;
  }
}
async function getValidatedLastActiveDocInfo() {
  const cached = lastActiveDocInfo;
  if (!cached?.docId) return normalizeDocInfo({}, "cached-current-doc");
  const meta = await readDocMetaById(cached.docId);
  if (!meta?.docId) return normalizeDocInfo({}, "cached-current-doc");
  return normalizeDocInfo({
    docId: meta.docId,
    title: meta.title || cached.title || meta.docId,
    source: "cached-current-doc"
  }, "cached-current-doc");
}
function getCurrentDocInfoFromSelection() {
  const selectors = [
    ".layout__wnd--active .protyle-wysiwyg [data-node-id].protyle-wysiwyg--select",
    ".layout__wnd--active .protyle-wysiwyg [data-node-id].protyle-wysiwyg--hl",
    ".layout__wnd--active .protyle-wysiwyg [data-node-id][contenteditable='true']",
    ".layout__wnd--active .protyle-wysiwyg [data-node-id]"
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
function getCurrentDocInfoFromTab() {
  const selectors = [
    ".layout__wnd--active .item--focus[data-id]",
    ".layout-tab-bar .item--focus[data-id]",
    ".layout__wnd--active [data-activetime][data-id]"
  ];
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (!node) continue;
    const rawId = String(node.getAttribute("data-id") || "").trim();
    const docIdMatch = rawId.match(/\d{14}-[a-z0-9]+/i);
    if (!docIdMatch) continue;
    const docId = docIdMatch[0];
    const title = String(
      node.getAttribute("title") || node.getAttribute("aria-label") || (typeof node.querySelector === "function" ? node.querySelector(".item__text")?.textContent : "") || node.textContent || ""
    ).trim();
    return normalizeDocInfo({ docId, title, source: "tab-dom" }, "tab-dom");
  }
  return normalizeDocInfo({}, "tab-dom");
}
function getCurrentDocInfoFromSiyuanLayout() {
  const siyuan = globalThis.window?.siyuan;
  const protyles = [];
  const push = (value) => {
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
async function enrichDocInfo(info) {
  const normalized = normalizeDocInfo(info, info.source || "fallback");
  if (!normalized.docId) return normalized;
  const meta = await readDocMetaById(normalized.docId);
  if (meta?.docId) {
    return normalizeDocInfo({
      docId: meta.docId,
      title: meta.title || normalized.title || getCurrentTitleFromDOM() || meta.docId,
      source: normalized.source
    }, normalized.source);
  }
  if (normalized.title) return normalized;
  const domTitle = getCurrentTitleFromDOM();
  if (domTitle) return normalizeDocInfo({ ...normalized, title: domTitle }, normalized.source);
  return normalizeDocInfo({ ...normalized, title: normalized.docId }, normalized.source);
}
function splitResourceRef(ref) {
  const value = String(ref || "").trim();
  const match = value.match(/^([^?#]*)([?#].*)?$/);
  return {
    path: match?.[1] || value,
    suffix: match?.[2] || ""
  };
}
function isExternalResourceRef(ref) {
  return /^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(ref);
}
function isLocalAbsoluteResource(ref) {
  return /^(?:file:\/\/\/|[a-zA-Z]:[\\/]|\/[a-zA-Z]:\/)/.test(ref);
}
function extractLocalFilePath(ref) {
  if (/^file:\/\/\//i.test(ref)) {
    try {
      let pathname = decodeURIComponent(new URL(ref).pathname || "");
      if (/^\/[a-zA-Z]:\//.test(pathname)) pathname = pathname.slice(1);
      return pathname.replace(/\//g, import_node_path2.default.sep);
    } catch {
      return "";
    }
  }
  if (/^[a-zA-Z]:[\\/]/.test(ref)) {
    return ref.replace(/\//g, import_node_path2.default.sep);
  }
  if (/^\/[a-zA-Z]:\//.test(ref)) {
    return ref.slice(1).replace(/\//g, import_node_path2.default.sep);
  }
  return "";
}
function hashString(input) {
  return import_node_crypto2.default.createHash("md5").update(String(input || "")).digest("hex");
}
function escapeHtml2(text) {
  return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr2(text) {
  return escapeHtml2(text).replace(/"/g, "&quot;");
}
function getDomParser() {
  const Ctor = globalThis.window?.DOMParser || globalThis.DOMParser;
  return Ctor ? new Ctor() : null;
}
function safeReadDir(dir) {
  try {
    return import_node_fs2.default.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

// src/index.ts
var SHARE_TOPBAR_ICON = `
  <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <path d="M512 0C229.23 0 0 229.23 0 512s229.23 512 512 512 512-229.23 512-512S794.77 0 512 0z m150.888 822.576c-56.452 0-102.807-43.195-107.838-98.335l-175.252-71.917c-16.481 10.135-35.881 15.985-56.648 15.985-59.812 0-108.299-48.487-108.299-108.299s48.487-108.299 108.299-108.299c11.68 0 22.925 1.857 33.464 5.278l128.185-128.185c-4.694-12.125-7.274-25.303-7.274-39.084 0-59.812 48.487-108.299 108.299-108.299s108.299 48.487 108.299 108.299c0 59.812-48.487 108.299-108.299 108.299-19.668 0-38.11-5.244-54.008-14.408L414.149 501.277c10.943 16.92 17.299 37.083 17.299 58.733 0 11.697-1.862 22.958-5.293 33.51l146.883 60.275c19.456-28.847 52.437-47.818 89.849-47.818 59.812 0 108.299 48.487 108.299 108.299s-48.486 108.3-108.298 108.3z" fill="currentColor"/>
  </svg>
`;
var SiSharePlugin = class extends import_siyuan3.Plugin {
  progress = new ProgressOverlay();
  store;
  panel;
  storages = [];
  busy = false;
  treeMarkerObserver = null;
  treeMarkerTimer = null;
  boundHandleSwitchProtyle = (event) => {
    setCurrentProtyle(event.detail?.protyle || null);
    void refreshTrackedDocInfo("active-protyle").catch(() => {
    });
  };
  async onload() {
    this.store = new ShareStore(this);
    await this.store.load();
    this.panel = new CloudPagesPanel(this.name);
    this.eventBus.on("switch-protyle", this.boundHandleSwitchProtyle);
    this.eventBus.on("loaded-protyle-dynamic", this.boundHandleSwitchProtyle);
    this.initTreeMarkerSync();
    this.scheduleRefreshTreeShareMarkers();
    this.addTopBar({
      icon: SHARE_TOPBAR_ICON,
      title: "\u4E91\u7AEF\u9759\u6001\u5206\u4EAB",
      callback: () => {
        this.openSetting();
      }
    });
  }
  onunload() {
    this.eventBus.off("switch-protyle", this.boundHandleSwitchProtyle);
    this.eventBus.off("loaded-protyle-dynamic", this.boundHandleSwitchProtyle);
    this.treeMarkerObserver?.disconnect();
    this.treeMarkerObserver = null;
    if (this.treeMarkerTimer !== null) {
      window.clearTimeout(this.treeMarkerTimer);
      this.treeMarkerTimer = null;
    }
    document.querySelectorAll(".sishare-tree-share-icon").forEach((node) => node.remove());
    clearTrackedDocContext();
  }
  openSetting() {
    void this.ensureStoragesLoaded().catch((error) => {
      (0, import_siyuan3.showMessage)(formatError2(error), 5e3, "error");
    });
    this.renderPanel();
  }
  renderPanel() {
    this.panel.open(this.getPanelState(), {
      onSaveSettings: async (settings) => {
        await this.store.updateSettings(settings);
      },
      onRefreshStorages: async () => {
        await this.refreshStorages(true);
      },
      onRefreshShares: async () => {
        await this.store.load();
        this.rerenderPanel();
        (0, import_siyuan3.showMessage)("\u5206\u4EAB\u5217\u8868\u5DF2\u5237\u65B0", 2e3, "info");
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
        (0, import_siyuan3.confirm)("\u5220\u9664\u5206\u4EAB", `\u786E\u8BA4\u5220\u9664\u8FDC\u7AEF\u76EE\u5F55 ${record.slug} \u5417\uFF1F\u8FD9\u4E0D\u4F1A\u5220\u9664 pages-pub-assets\u3002`, async () => {
          await this.runTask(async () => {
            await this.deleteShare(record);
          });
        });
      },
      onCopyUrl: async (url) => {
        try {
          await navigator.clipboard.writeText(url);
          (0, import_siyuan3.showMessage)("\u94FE\u63A5\u5DF2\u590D\u5236", 2e3, "info");
        } catch (error) {
          (0, import_siyuan3.showMessage)(`\u590D\u5236\u5931\u8D25: ${formatError2(error)}`, 4e3, "error");
        }
      }
    });
  }
  rerenderPanel() {
    this.panel.rerender(this.getPanelState());
    this.scheduleRefreshTreeShareMarkers();
  }
  initTreeMarkerSync() {
    this.treeMarkerObserver?.disconnect();
    this.treeMarkerObserver = new MutationObserver(() => {
      this.scheduleRefreshTreeShareMarkers();
    });
    this.treeMarkerObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  scheduleRefreshTreeShareMarkers() {
    if (this.treeMarkerTimer !== null) {
      window.clearTimeout(this.treeMarkerTimer);
    }
    this.treeMarkerTimer = window.setTimeout(() => {
      this.treeMarkerTimer = null;
      this.refreshTreeShareMarkers();
    }, 80);
  }
  getSharedDocIdSet() {
    return new Set(
      this.store.getShares().map((record) => String(record.docId || "").trim()).filter(Boolean)
    );
  }
  getTreeItemDocId(node) {
    if (!node) return "";
    const element = node;
    const candidates = [
      element.getAttribute("data-node-id"),
      element.dataset?.nodeId,
      element.dataset?.id,
      element.getAttribute("data-id")
    ].filter(Boolean);
    const matched = candidates.find((value) => /^\d{14}-[a-z0-9]+$/i.test(String(value).trim()));
    return matched ? String(matched).trim() : "";
  }
  isLikelyTreeItem(node) {
    if (!(node instanceof HTMLElement)) return false;
    if (node.closest(".protyle, .protyle-wysiwyg, .block__popover, .layout-tab-bar")) return false;
    if (!node.classList.contains("b3-list-item")) return false;
    if (!this.getTreeItemDocId(node)) return false;
    if (node.getAttribute("data-type") === "navigation-file") return true;
    if (node.getAttribute("data-type") === "navigation-root") return false;
    if (node.querySelector(".b3-list-item__toggle")) return false;
    return !!node.closest(".sy__file, .file-tree, [data-type='sidebar-file'], [data-type='file']");
  }
  createTreeShareIcon(docId) {
    const icon = document.createElement("span");
    icon.className = "sishare-tree-share-icon";
    icon.dataset.docId = docId;
    icon.title = "\u5DF2\u5206\u4EAB";
    icon.setAttribute("aria-label", "\u5DF2\u5206\u4EAB");
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 16a3 3 0 0 0-2.39 1.2l-6.44-3.22a3.1 3.1 0 0 0 0-1.96l6.44-3.22A3 3 0 1 0 15 7a3.1 3.1 0 0 0 .09.74L8.65 10.96a3 3 0 1 0 0 2.08l6.44 3.22A3.1 3.1 0 0 0 15 17a3 3 0 1 0 3-1Z"></path>
      </svg>
    `;
    return icon;
  }
  refreshTreeShareMarkers() {
    const sharedDocIds = this.getSharedDocIdSet();
    const nodes = Array.from(document.querySelectorAll(".b3-list-item[data-node-id], .b3-list-item [data-node-id]"));
    const visited = /* @__PURE__ */ new Set();
    for (const node of nodes) {
      const row = node.classList.contains("b3-list-item") ? node : node.closest(".b3-list-item");
      if (!this.isLikelyTreeItem(row) || visited.has(row)) continue;
      visited.add(row);
      const docId = this.getTreeItemDocId(row) || this.getTreeItemDocId(node);
      const existing = row.querySelector(".sishare-tree-share-icon");
      if (!docId || !sharedDocIds.has(docId)) {
        existing?.remove();
        continue;
      }
      if (existing) continue;
      const anchor = row.querySelector(".b3-list-item__text, .b3-list-item__name, .b3-list-item__title, .b3-list-item__label");
      const icon = this.createTreeShareIcon(docId);
      if (anchor) {
        anchor.classList.add("sishare-tree-share-anchor");
        anchor.insertAdjacentElement("afterend", icon);
      } else {
        row.appendChild(icon);
      }
    }
    document.querySelectorAll(".sishare-tree-share-icon").forEach((icon) => {
      const row = icon.closest(".b3-list-item");
      if (!this.isLikelyTreeItem(row) || !sharedDocIds.has(icon.dataset.docId || this.getTreeItemDocId(row))) {
        icon.remove();
      }
    });
  }
  getPanelState() {
    return {
      settings: this.store.getSettings(),
      storages: this.storages,
      shares: this.store.getShares(),
      busy: this.busy
    };
  }
  async runTask(task) {
    if (this.busy) {
      (0, import_siyuan3.showMessage)("\u5DF2\u6709\u4EFB\u52A1\u6B63\u5728\u6267\u884C\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5", 3e3, "info");
      return;
    }
    this.busy = true;
    this.rerenderPanel();
    try {
      await task();
    } catch (error) {
      (0, import_siyuan3.showMessage)(formatError2(error), 6e3, "error");
    } finally {
      this.busy = false;
      this.rerenderPanel();
    }
  }
  async publishCurrentDocument() {
    const settings = await this.ensureValidSettings();
    const docInfo = await getCurrentDocInfoSafe();
    if (!docInfo.docId) {
      throw new Error("\u672A\u80FD\u8BC6\u522B\u5F53\u524D\u6D3B\u8DC3\u6587\u6863\uFF0C\u8BF7\u5148\u70B9\u51FB\u6B63\u6587\u540E\u518D\u8BD5");
    }
    const existing = this.store.findByDocId(docInfo.docId);
    const slug = existing?.slug || buildSlug(docInfo.title || docInfo.docId, docInfo.docId, settings.slugMode);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const remoteBasePath = deriveRemoteRootFromPublicBaseUrl(settings.publicBaseUrl);
    const baseRecord = {
      id: existing?.id || buildRecordId(docInfo.docId, slug),
      docId: docInfo.docId,
      title: docInfo.title || existing?.title || docInfo.docId,
      slug,
      url: existing?.url || "",
      previewUrl: existing?.previewUrl || existing?.url || "",
      sourceUrl: existing?.sourceUrl || "",
      storageId: Number(settings.storageId),
      storageMountPath: settings.storageMountPath,
      remotePath: remoteBasePath ? normalizeCloudPath(settings.storageMountPath, remoteBasePath, slug) : normalizeCloudPath(settings.storageMountPath, slug),
      publicBaseUrl: settings.publicBaseUrl,
      previewBaseUrl: settings.previewBaseUrl,
      uploadSharedAssets: settings.uploadSharedAssets,
      includeChildDocuments: settings.includeChildDocuments,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      status: "pending",
      lastError: ""
    };
    await this.store.upsertShare(baseRecord);
    this.rerenderPanel();
    try {
      const output = await publishToSiyuanCloud({
        docId: docInfo.docId,
        title: docInfo.title || docInfo.docId,
        slug,
        settings,
        onProgress: (percent, text) => this.progress.update(percent, text)
      });
      await this.store.upsertShare({
        ...baseRecord,
        title: output.exportedTitle,
        url: output.url,
        previewUrl: output.previewUrl,
        sourceUrl: output.sourceUrl,
        remotePath: output.remotePagePath,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        status: "success",
        lastError: ""
      });
      this.progress.finish("\u4E91\u7AEF\u5206\u4EAB\u5B8C\u6210");
      this.rerenderPanel();
      const warningText = output.warnings.length ? `
${output.warnings.join("\n")}` : "";
      (0, import_siyuan3.showMessage)(`\u5206\u4EAB\u6210\u529F: ${output.url}${warningText}`, 7e3, "info");
    } catch (error) {
      await this.store.upsertShare({
        ...baseRecord,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        status: "failed",
        lastError: formatError2(error)
      });
      this.progress.finish(`\u5931\u8D25\uFF1A${formatError2(error)}`, true);
      this.rerenderPanel();
      throw error;
    }
  }
  async updateShare(record) {
    const settings = await this.ensureValidSettings();
    const pending = {
      ...record,
      storageId: Number(settings.storageId),
      storageMountPath: settings.storageMountPath,
      publicBaseUrl: settings.publicBaseUrl,
      previewBaseUrl: settings.previewBaseUrl,
      uploadSharedAssets: settings.uploadSharedAssets,
      includeChildDocuments: settings.includeChildDocuments,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "pending",
      lastError: ""
    };
    await this.store.upsertShare(pending);
    this.rerenderPanel();
    try {
      const output = await publishToSiyuanCloud({
        docId: record.docId,
        title: record.title || record.slug,
        slug: record.slug,
        settings,
        onProgress: (percent, text) => this.progress.update(percent, text)
      });
      await this.store.upsertShare({
        ...pending,
        title: output.exportedTitle,
        url: output.url,
        previewUrl: output.previewUrl,
        sourceUrl: output.sourceUrl,
        remotePath: output.remotePagePath,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        status: "success",
        lastError: ""
      });
      this.progress.finish("\u5206\u4EAB\u5DF2\u66F4\u65B0");
      this.rerenderPanel();
      const warningText = output.warnings.length ? `
${output.warnings.join("\n")}` : "";
      (0, import_siyuan3.showMessage)(`\u5206\u4EAB\u5DF2\u66F4\u65B0: ${output.url}${warningText}`, 7e3, "info");
    } catch (error) {
      await this.store.upsertShare({
        ...pending,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        status: "failed",
        lastError: formatError2(error)
      });
      this.progress.finish(`\u66F4\u65B0\u5931\u8D25\uFF1A${formatError2(error)}`, true);
      this.rerenderPanel();
      throw error;
    }
  }
  async deleteShare(record) {
    const settings = await this.ensureValidSettings();
    try {
      await deleteRemoteShare({
        slug: record.slug,
        settings,
        onProgress: (percent, text) => this.progress.update(percent, text)
      });
      await this.store.removeShare(record.id);
      this.progress.finish("\u5206\u4EAB\u5DF2\u5220\u9664");
      this.rerenderPanel();
      (0, import_siyuan3.showMessage)("\u5206\u4EAB\u5DF2\u5220\u9664\uFF0C\u4EC5\u5220\u9664\u8BE5\u6587\u6863\u5BF9\u5E94\u8FDC\u7AEF\u76EE\u5F55", 4e3, "info");
    } catch (error) {
      this.progress.finish(`\u5220\u9664\u5931\u8D25\uFF1A${formatError2(error)}`, true);
      throw error;
    }
  }
  async ensureValidSettings() {
    const settings = normalizeSettings(this.store.getSettings());
    if (!settings.cloudToken) {
      throw new Error("\u8BF7\u5148\u914D\u7F6E siyuan-cloud Token");
    }
    await this.ensureStoragesLoaded(true);
    const selected = this.storages.find((item) => item.id === settings.storageId);
    if (!selected) {
      throw new Error("\u672A\u627E\u5230\u53EF\u7528\u7684 S3 \u6302\u8F7D\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u65B0\u9009\u62E9");
    }
    if (selected.mount_path !== settings.storageMountPath) {
      settings.storageMountPath = selected.mount_path;
      await this.store.updateSettings({ storageMountPath: selected.mount_path });
    }
    if (!settings.publicBaseUrl) {
      throw new Error("\u672A\u914D\u7F6E publicBaseUrl\uFF0C\u4E0D\u5141\u8BB8\u5B8C\u6210\u5206\u4EAB");
    }
    return settings;
  }
  async ensureStoragesLoaded(force = false) {
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
      throw new Error("\u672A\u627E\u5230\u53EF\u7528\u7684 S3 \u6302\u8F7D");
    }
  }
  async refreshStorages(force = false) {
    const settings = this.store.getSettings();
    if (!settings.cloudToken) {
      throw new Error("\u8BF7\u5148\u586B\u5199 siyuan-cloud Token \u518D\u5237\u65B0\u6302\u8F7D");
    }
    await this.ensureStoragesLoaded(force);
    this.rerenderPanel();
    (0, import_siyuan3.showMessage)("S3 \u6302\u8F7D\u5217\u8868\u5DF2\u5237\u65B0", 2e3, "info");
  }
};
function formatError2(error) {
  return error instanceof Error ? error.message : String(error);
}
