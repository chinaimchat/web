# AI抖商学院 PC 打包手册（唯一口径）

> **从本文档落地起，本仓库 PC 客户端只保留 Electron 一套打包工具链。**
> Tauri（`src-tauri/`、`@tauri-apps/*`）已于 2026-04 全部移除，历史记录在 git。

## 1. 只剩两种"运行形态"

两种形态**产物是同一包**，只靠一行配置切换：

| 形态 | 什么时候用 | 入口做了什么 | 关键配置 |
|---|---|---|---|
| **A. 离线 `app://`**（默认、推荐）| 你想让用户"断网也能打开登录页、有原生菜单、支持自定义协议、快捷键、截图、粘贴弹窗"<br>走**真·桌面客户端**体验 | 主进程注册自定义 `app://local` 协议，`loadURL('app://local/index.html?sid=xxx')` 从打进安装包里的 `build/` 读静态资源；登录后用 HTTP API 打服务端 | `src-election/main/confing.ts` 里 `remoteWebEntryUrl: ''` |
| **B. 封装远端网页** | 你只想要一个"带图标的壳"，所有页面都从线上拉；版本跟着 Web 部署走，不想发新客户端 | 主进程直接 `loadURL('http://your-domain/?sid=xxx')`，等同于一个 Chromium 站点隔离窗口 | `src-election/main/confing.ts` 里 `remoteWebEntryUrl: 'http://www.你的域名/'` |

两种形态都**原样支持**：
- 粘贴图片/视频弹出预览 → 发送（`MessageInput` + `ImageToolbar` + `VideoToolbar`）
- 多账号多开（稳定 partition、重启不掉登录）
- 同账号多窗（`Command+N`）
- 系统级通知、托盘未读、`Ctrl+Shift+A` 截屏
- 外链 `target="_blank"` 走系统浏览器（`setWindowOpenHandler` 保护）

## 2. 目录地图

```
apps/web/
├─ package.json            # electron / electron-builder / 构建脚本
├─ electron-builder.js     # mac x64 默认
├─ electron-builder-arm64.js
├─ electron-builder-x64.js
├─ electron-builder-universal.js
├─ build/                  # React 产物；被 Electron 打进安装包
├─ resources/              # 托盘图标、dmg 背景等静态资源
├─ out-election/           # tsc 产物（主进程 JS）；electron 入口
└─ src-election/
   ├─ main/
   │  ├─ index.ts          # 主进程：生命周期/窗口/菜单/托盘/IPC
   │  ├─ appProtocol.ts    # 注册 app:// 协议（形态 A）
   │  ├─ profileStore.ts   # profiles.json：多账号持久化
   │  ├─ confing.ts        # 切 A / B 形态的唯一开关
   │  ├─ update.ts         # electron-updater 自动更新
   │  ├─ notification.ts   # 系统通知
   │  ├─ logo.ts           # 托盘图标（含未读角标）
   │  └─ utils/search.ts   # sid 生成
   └─ preload/
      └─ index.ts          # contextBridge + IPC 白名单
```

## 3. 切换形态

编辑 `apps/web/src-election/main/confing.ts`：

```ts
// 形态 A：默认，离线包
remoteWebEntryUrl: '' as string,

// 形态 B：封装远端
// 必须带协议；http 也要写 http://；与安卓/iOS 填的主域一致
remoteWebEntryUrl: 'http://www.你的域名/' as string,
```

> **形态 B 注意：** Web 端 `apps/web/src/index.tsx` 里 `ELECTRON_FILE_API_ROOT` 在形态 B 下不会被用（因为此时页面协议是 http:/https:，走同源 `/api/v1/`）。所以形态 B 要求远端站点已经反代好 `/api/v1/` 到 `chinaim-server`。

## 4. 构建流程

### 4.1 本地开发（热更新 + 主进程 watch）

```bash
cd apps/web
yarn                  # 只需装一次
yarn dev-ele          # 同时跑 CRA dev-server + electron watch
```

- CRA 在 `http://localhost:3000`，主进程会直接 `loadURL('http://localhost:3000')`；形态 A/B 配置此时都**不生效**。
- 改 `src-election/**` 会自动 `tsc` 重跑并重启 Electron。
- 改 `src/**` 会被 CRA 热更新。

### 4.2 出正式安装包

**一步到位脚本**（按你自己的平台挑一个）：

```bash
cd apps/web

# macOS：当前架构
yarn build-ele:mac

# macOS：x64（Intel）
yarn build-ele:mac-x64

# macOS：arm64（Apple Silicon）
yarn build-ele:mac-arm64

# macOS：通用二进制（x64+arm64 合成一个 .dmg）
yarn build-ele:mac-universal

# Windows
yarn build-ele:win

# Linux x64 / arm64
yarn build-ele:linux
yarn build-ele:linux-arm64
```

> 每一条都会**先** `yarn build`（生成 `apps/web/build/`），**再** `tsc -p tsconfig.e.json`（生成 `apps/web/out-election/`），**再** `electron-builder`。你不需要手工单步跑。

### 4.3 产物位置

- `apps/web/dist-ele/`：所有平台的安装包和未打包产物
  - `*.dmg`、`*.exe`、`*.AppImage`、`*.deb` 会在这里
- 安装后的运行时数据 / `profiles.json` / 分区：
  - macOS: `~/Library/Application Support/AI抖商学院/`
  - Windows: `%APPDATA%/AI抖商学院/`
  - Linux: `~/.config/AI抖商学院/`

## 5. 多账号多开操作说明（给用户/测试写的）

启动流程：
1. 第一次打开自动创建"账号 1"并登录。
2. **菜单 → 窗口 → 新建窗口（同账号）** 或 `Command+N`：给当前账号再开一扇窗，两扇窗共享登录态，适合一边聊天一边看另一会话。
3. **菜单 → 窗口 → 新建窗口（另一个账号）** 或 `Shift+Command+N`：创建一个新账号档案，跳到登录页。登录后**关机重启也能自动恢复**。
4. **菜单 → 窗口 → 账号管理**：列出所有 profile、重命名、删除（删除会**连本地数据和分区一并清除**）。
5. 右键托盘图标：显示/隐藏全部窗口、快速切账号、查看每个账号的未读。

二次启动行为：
- 双击图标再启动一次，进程直接退出（单例锁），由已运行的进程用"最近使用过的 profile"**新开一扇窗**，不会抢 `userData`。

Windows 任务栏分组：
- 默认所有窗口归到同一个任务栏图标（`AUMID = TSDD_FONFIG.name`）。
- 想让不同账号分组显示，启动前设环境变量：`TSDD_AUMID=abc.com.tsdaodao.account1`（各 profile 自己跑一份 shortcut 即可）。

## 6. 注意事项（很重要，踩过的坑）

### 6.1 不要再用 `loadFile`
老代码里 `mainWindow.loadFile(...)` 分支已彻底删除。想改入口请改 `confing.ts`，**不要再把 file:// 加回来**：
- file:// 在新版 Chromium 下 fetch 限制越来越多；
- 无法用 Service Worker；
- 部分粘贴行为（`navigator.clipboard.read`）在 file:// 下表现不稳定。

`app://local` 已在 `appProtocol.ts` 注册为 `standard + supportFetchAPI + stream + corsEnabled + bypassCSP`，并通过命令行开关 `unsafely-treat-insecure-origin-as-secure` 标为可信来源，替代 file:// 且**不退化**。

### 6.2 混合内容（form B 特别注意）
- 形态 A：页面协议是 `app:`，后端 API 是 `http://`，不会触发"混合内容"。
- 形态 B：如果 `remoteWebEntryUrl` 是 `https://`，**后端 API 也必须 `https://`**；否则 Chromium 会在正式包里静默阻断 http API 请求。

### 6.3 分区目录会攒垃圾，但我们会自动清
- 稳定 partition 是 `persist:tsdd-profile-<id>`，从 `profiles.json` 读。
- 历史上（旧版本）每次启动都是 `persist:tsdd-<ts>-<rand>`，留了一堆垃圾。
- 应用启动时 `cleanOrphanPartitions()` 会**只清自家前缀**的孤儿分区（`tsdd-` / `tsdd-profile-`），绝不碰 `electron-screenshots` 等第三方 partition。

### 6.4 preload 白名单一定要手动加
`src-election/preload/index.ts` 里的 `IPC_SEND_ALLOW / IPC_INVOKE_ALLOW / IPC_ON_ALLOW` 是**默认拒绝**策略。你加任何新 IPC 通道，**必须在这里显式注册**，否则渲染进程会被拦成 `blocked ipc.xxx`。

目前的通道对照表（来源：`src-election/preload/index.ts`）：
- send：`screenshots-start` / `update-app` / `install-update` / `conversation-anager-unread-count`（历史）/ `conversation-manager-unread-count` / `check-update` / `set-window-title` / `set-profile-name` / `open-window-same-account` / `open-window-new-account` / `restart-app`
- invoke：`show-native-notification` / `close-native-notification` / `close-all-native-notifications` / `test-notification-icon` / `get-profile-info`
- on：`update-*` / `download-progress` / `notification-clicked` / `notification-action-clicked` / `show-conversations` / `deep-link` / `screenshots-ok`

### 6.5 自动更新（electron-updater）
- 使用 `electron-builder.js` 里 `publish` 字段声明的更新源。
- 更新包校验用签名，不要跳过。
- 旧的 Tauri updater（`https://api.botgate.cn/v1/common/updater/...`）已下线，不会再被调用。

### 6.6 外链安全
所有窗口都通过 `setWindowOpenHandler` 拦截 `window.open` / `<a target="_blank">`，`http(s)://` 交给系统浏览器，其它一律 `deny`。Web 端想弹新窗请用 `window.ipc.send('open-window-same-account')` 或自己发明的业务路由。

### 6.7 `APP_ORIGIN` 要与 `src/index.tsx` 协议判断保持同步
如果哪天要把 scheme 从 `app://` 换成比如 `tsdd://`，必须同步改两处：
1. `src-election/main/appProtocol.ts` 里的 `APP_SCHEME` / `APP_HOST`
2. `apps/web/src/index.tsx` 里 `isLocalShellProto` 的 `pageProto === "app:"` 判断

## 7. 从源码签出到出包的"冷启动"命令列表

```bash
# 1. 装依赖（monorepo 根）
cd chinaim-web
yarn

# 2. 首次构建 Web 产物
cd apps/web
yarn build

# 3. 编译 Electron 主进程
./node_modules/.bin/tsc -p tsconfig.e.json

# 4. 打你平台的安装包（三选一）
yarn build-ele:mac-universal
yarn build-ele:win
yarn build-ele:linux

# 5. 产物位置
ls dist-ele/
```

## 8. 彻底移除的东西（只作记录，不用去找）

- `apps/web/src-tauri/`（整个 Rust 工程）
- `@tauri-apps/api`、`@tauri-apps/cli`
- `package.json` 里的 `"tauri"` 脚本
- `apps/web/src/Layout/index.tsx` 里 `tauriCheckUpdate` / `showUpdateUI` / `listen('tauri://update-status', ...)` 整段
- `apps/web/src/index.tsx`、`packages/tsdaodaobase/src/App.tsx` 里的 `__TAURI_IPC__` 判断

`yarn.lock` / `package-lock.json` 里残留的 `@tauri-apps/*` 在下一次 `yarn install` 后会自动消失。`apps/web/public/owt.js` 是 WebRTC 第三方库，内部的 `window.__TAURI_IPC__` 只是它自己的能力探测，**不要改**。
