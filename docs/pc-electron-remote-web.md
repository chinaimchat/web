# PC 端：Electron 远程网页壳（推荐默认方式）

<a id="pc-doc-overview"></a>

以后 PC 安装包优先采用 **「壳 + 已部署 Web」**：生产环境 Electron 用 **`loadURL`** 打开线上页面（与手机浏览器、Web 端同一套站点），不再依赖安装包内的 `file://` 静态页 + 单独写 API 绝对地址。

<a id="pc-scenarios"></a>

## 适用场景

- 与 **Android / iOS** 使用同一套域名与网关（例如宿主机 Nginx 示例 `chinaim-server/deploy/nginx/tsdd.conf`：`/` → Web 容器，`/v1/` → 后端）。
- 使用 **HTTP**（未上 HTTPS）时，配置里须带 **`http://`**，避免部分环境默认成 `https://`。
- 希望 **发版主要改 Web 部署**，PC 壳版本可较少变更。

<a id="pc-config"></a>

## 你需要改哪里

<a id="pc-config-remote"></a>

### 1. 配置远程入口（必做）

编辑 `apps/web/src-election/main/confing.ts` 中的 **`remoteWebEntryUrl`**：

- **走远程网页壳**：填 **浏览器打开 IM 的完整入口 URL**（须含协议），例如：
  - `http://www.tu2t0.com/`
  - `http://tu2t0.com/`（与 DNS、`server_name` 一致即可）
- **仍走本地打包的 `index.html`（旧方式）**：保持 **`''`（空字符串）**，此时需在 `apps/web/src/index.tsx` 维护 **`ELECTRON_FILE_API_ROOT`**，见根目录 README「API 根地址说明」。

与移动端对齐时：若 App 里填的是 **`http://www.你的域名`**，此处一般填 **`http://www.你的域名/`**（与浏览器地址栏一致；子路径部署则带上路径，如 `http://www.你的域名/im/`）。

<a id="pc-build-cmd"></a>

### 2. 打包命令（与现有一致）

在 `apps/web` 下先打 Web 再打 Electron（具体脚本以仓库为准），例如：

```shell
yarn build
yarn build-ele:win
```

`yarn build` 仍会生成 `build/`，供 **Web 镜像部署**；当 `remoteWebEntryUrl` 非空时，**用户实际打开的是线上 URL**，本地 `build` 仅作部署产物，与壳内首屏无强绑定。

<a id="pc-server-gw"></a>

### 3. 服务端与网关

- 远程页所在域名下，须能通过 **同源相对路径 `/api/v1/`** 访问接口（Web 容器内 Nginx 模板见 `nginx.conf.template`）。
- 原生 SDK 走 **`/v1/`** 的，由宿主机 **`location /v1/`** 反代到后端（与仓库内 `deploy/nginx/tsdd.conf` 注释一致）。

<a id="pc-frontend"></a>

## 前端行为说明

- 页面为 **`http(s)://` 来源**时，`index.tsx` 中 Electron 与 Web 一样使用 **`/api/v1/`**，**无需**再为 PC 单独配置 `ELECTRON_FILE_API_ROOT`。
- 仅当 **`remoteWebEntryUrl` 为空**、生产仍 **`loadFile`**（`file://`）时，才依赖 `ELECTRON_FILE_API_ROOT`。

<a id="pc-ops"></a>

## 安全与运维提示

- 业务窗口已 **`contextIsolation` + `sandbox` + 关闭 `nodeIntegration`**，并通过 **preload 白名单 IPC**（见下文「安全收紧」）。仍应只 **`loadURL`** 到 **你们自己控制的域名**，避免加载不可信第三方页。
- **离线**：无网络时远程页无法加载；本地 `file://` 方案至少能打开壳内静态页（接口仍依赖网络）。
- **版本**：业务逻辑以线上 Web 为准；PC 壳可单独做自动更新（如沿用 `updataUrl` 等机制）。
- **新增 IPC 通道**：须在 **`apps/web/src-election/preload/index.ts`** 白名单中登记，否则会被拦截。

<a id="pc-compare"></a>

## 与「本地 file + 绝对 API」对比

| 项目 | `remoteWebEntryUrl` 有值（远程壳） | `remoteWebEntryUrl` 为空（本地 file） |
|------|-------------------------------------|----------------------------------------|
| 生产加载 | `loadURL(线上 Web)` | `loadFile(build/index.html)` |
| API | 同源 `/api/v1/` | 依赖 `ELECTRON_FILE_API_ROOT` |
| 与安卓填 `http://www.域名` | 一致（同一站点） | 需单独保证 API 根与网关一致 |

主进程实现位置：`apps/web/src-election/main/index.ts`（主窗口与新窗口的生产分支）。

<a id="pc-multi"></a>

## 多开、多账号（同一台 PC）

- **再次运行/双击快捷方式**：仍只保留**一个** Electron 进程（避免多进程争用同一 `userData` 目录），但会触发 **`second-instance`**，自动再开一个**独立窗口**。
- **每个窗口**使用不同的 **`session` partition**（`persist:tsdd-…`），**登录态、本地缓存互不串号**。
- 菜单 **「窗口 → 新建窗口」**（`Command+N` / `Ctrl+N` 视平台而定）同样会新开独立会话窗口。
- **托盘**：左键或 **「显示/隐藏全部窗口」** 会对**所有**业务窗口生效。
- Windows 任务栏上，同一应用的多窗口可能被**叠成一组**；与「多个 exe 进程各占一个图标」外观不同，但更符合 Electron 对数据目录的推荐用法。若必须多进程多图标，需单独做多套 `userData` 启动方案（维护成本高，本仓库未采用）。

<a id="pc-security"></a>

### 安全收紧（主进程 + preload）

- 所有业务窗口 **`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`**，渲染页不再直接持有 Node；与已有 **`contextBridge` preload** 一致。
- **`preload/index.ts`** 对 **`ipc.send` / `invoke` / `on` / `once`** 做**通道白名单**，未知通道会拒绝并打日志，降低被 XSS 后滥用 IPC 的风险。
- 自动更新相关 IPC（`check-update`、`update-app`、`install-update`）集中在 **`update.ts`**，且**只注册一次**；更新事件向**所有**业务窗口广播，多开时各窗都能收到。

<a id="pc-tray"></a>

### 托盘「按窗口」未读

- 渲染进程仍发 **`conversation-anager-unread-count`** 与**单个数字**；主进程用 **`event.sender.id`**（`webContents`）记入 **按窗口的 Map**。
- 托盘 **右键菜单** 中列出 **每个窗口标题 + 该窗未读数**，点击可 **聚焦该窗**；并显示 **未读合计**。
- **Windows**：`Tray.setToolTip` 展示多行摘要（应用名、合计、各窗）；托盘图标右上角用 **SVG 叠红色角标 + 合计数字**（`>99` 显示 `99+`），实现见 `logo.ts` 中 `buildWindowsTrayImageWithUnreadBadge`。
- **macOS**：托盘标题区仍显示 **合计未读**。
- 窗口 **`closed`** 时从 Map 中移除该窗并刷新托盘。

<a id="pc-main-optim"></a>

### 主进程已做的优化（实现细节）

- 多开子窗口**不再**在 `close` 里手动 `destroy()`，交给系统默认关闭，避免多余一次销毁。
- **`ipcMain` 监听**集中到 `registerMainProcessIpcOnce()`，且 **`app.ready` 里先初始化 `screenshots`、再注册 IPC、最后 `createMainWindow()`**，避免截图模块未就绪或重复注册监听器。
