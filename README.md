# siyuan-sishare

一个独立的思源笔记插件仓库，用于把当前活跃文档导出为静态 HTML，并上传到 `siyuan-cloud` 已挂载的 S3 网盘路径中，再通过 `publicBaseUrl` 生成公网访问链接。

## 当前实现范围

- 新建独立插件工程，不依赖 `siyuan-plugin-gitee-pages` 原仓库源码路径
- 保留并重构了导出、资源整理、分享记录、更新分享、删除分享、分享卡片等核心流程
- 删除 Git、Gitee Pages、GitHub Pages、本地仓库、Git 推送相关能力
- 上传目标改为 `siyuan-cloud` 私有 OpenList 风格 API
- 分享链接优先使用用户配置的 `publicBaseUrl`
- `index.html` 最后上传，避免用户访问到半成品页面
- 删除单篇分享仅删除 `{slug}/`，不删除 `pages-pub-assets/`

## 目录结构

```text
plugin.json
package.json
tsconfig.json
scripts/build.mjs
src/
  cloudApi.ts
  exporter.ts
  index.ts
  path.ts
  settings.ts
  shareStore.ts
  style.css
  ui.ts
```

## 安装与构建

```bash
npm install
npm run build
```

构建完成后，思源插件根目录会得到：

- `index.js`
- `index.css`
- `plugin.json`

这三个文件配合源码仓库内容即可独立放入思源插件目录运行。

## 配置说明

打开插件面板后，至少配置以下字段：

1. `siyuan-cloud Token`
2. `分享网盘（仅 S3）`
3. `网盘分享路径`
   例如：`/notes-share`
4. `公网访问根地址 publicBaseUrl`
   例如：`https://cdn.example.com/notes-share`
5. `是否上传 pages-pub-assets`

最终上传根路径为：

```text
{storageMountPath}/{remoteRoot}
```

最终分享链接为：

```text
{publicBaseUrl}/{encodeURIComponent(slug)}/index.html
```

## 测试建议

1. 在思源桌面端安装并启用 `siyuan-cloud`
2. 准备一个可写的 S3 挂载
3. 配置本插件的 Token、挂载、`remoteRoot`、`publicBaseUrl`
4. 打开任意笔记，点击“分享当前文档”
5. 检查远端是否生成：

```text
{remoteRoot}/pages-pub-assets/
{remoteRoot}/{slug}/index.html
{remoteRoot}/{slug}/assets/
```

6. 再次点击“更新分享”，确认 URL 不变
7. 点击“删除分享”，确认仅删除 `{slug}/`

## 已知风险

- 当前版本对思源 `exportHTML` 的不同小版本行为做了兼容兜底，但没有真实运行环境回归时，仍可能遇到导出目录结构差异
- `siyuan-cloud /api/share/*` 目前仅作为同步内部元数据的 best-effort 行为，真正外链仍以 `publicBaseUrl` 为准
- 如果用户关闭 `uploadSharedAssets`，默认假定远端已有 `pages-pub-assets/`
- `publicBaseUrl` 的真实可访问性无法在插件内完全保证，只能做基础格式提示
