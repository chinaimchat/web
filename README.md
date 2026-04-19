# TAS PC 端

<a href="https://zh-hans.react.dev/" target="_blank" rel="noopener" style="display:inline-block;">
	<img src="https://img.shields.io/badge/React-17.0.2-%236CB52D.svg?logo=React" alt="React" />
</a> &nbsp;
<a href="https://ts.nodejs.cn/" target="_blank" rel="noopener" style="display:inline-block;">
	<img src="https://img.shields.io/badge/TypeScript-5.0.4-%236CB52D.svg?logo=TypeScript&logoColor=FFF" alt="TypeScript" />
</a> &nbsp;
<a href="https://yarn.bootcss.com/" target="_blank" rel="noopener" style="display:inline-block;">
	<img src="https://img.shields.io/badge/Yarn-1.22.17-%236CB52D.svg?logo=Yarn&logoColor=FFF" alt="Yarn" />
</a> &nbsp;
<a href="https://nodejs.org/" target="_blank" rel="noopener" style="display:inline-block;">
	<img src="https://img.shields.io/badge/Node-18.17.1-%236CB52D.svg?logo=Node&logoColor=FFF" alt="Node">
</a> &nbsp;
<a href="https://webpack.docschina.org/" target="_blank" rel="noopener" style="display:inline-block;">
	<img src="https://img.shields.io/badge/Webpack-5.88.2-%236CB52D.svg?logo=Webpack" alt="Webpack" />
</a> &nbsp;
<a href="https://www.electronjs.org/zh/" target="_blank" rel="noopener" style="display:inline-block;">
	<img src="https://img.shields.io/badge/Electron-26.0.0-%236CB52D.svg?logo=Electron&logoColor=FFF" alt="Electron" />
</a> &nbsp;
<a href="https://www.electron.build/" target="_blank" rel="noopener" style="display:inline-block;">
	<img src="https://img.shields.io/badge/ElectronBuilder-24.9.1-%236CB52D.svg?logo=ElectronBuilder&logoColor=FFF" alt="ElectronBuilder" />
</a> &nbsp;
<a href="https://semi.design/zh-CN/" target="_blank" rel="noopener" style="display:inline-block;">
	<img src="https://img.shields.io/badge/Semi UI-2.24.2-%236CB52D.svg?logo=SemiUI" alt="SemiUI">
</a> &nbsp;
<a href="https://turbo.build/repo" target="_blank" rel="noopener" style="display:inline-block;">
	<img src="https://img.shields.io/badge/turbo-2.0.9-%236CB52D.svg?logo=Turbo&logoColor=FFF" alt="Turbo" />
</a> &nbsp;
<a href="https://githubim.com/" target="_blank" rel="noopener" style="display:inline-block;">
	<img src="https://img.shields.io/badge/WukongIm-1.2.10-%236CB52D.svg?logo=WukonIm" alt="Wukongim" />
</a> &nbsp;

📚 [在线文档](https://tsdaodao.com/) | 🚀 [演示地址](https://web.botgate.cn/)（账号/密码：15900000002/a1234567）

## 简介

TAS PC 端支持 Web 端、Mac 端、Windows 端、Linux 端，是一款高颜值 IM 即时通讯聊天软件，让企业轻松拥有自己的即时通讯软件。由[悟空 IM](https://githubim.com/)提供动力。

## Web 版本运行

> [!TIP]
> 本地开发建议`node v22.12.0`、 `yarn 1.22.19`

1. 安装依赖

```shell
yarn install 或者 yarn bootstrap
```

2. 本地开发调试

```shell
yarn dev
```

3. 编译

```shell
yarn build
```

4.  发布镜像

> [!TIP]
> 修改 api 地址：在 `apps/web/src/index.tsx` 中配置 `WKApp.apiClient.config.apiURL`；生产环境默认使用 `/api/v1/`（相对当前域名）。

> [!WARNING]
> **若出现接口 404（如表情商店加载失败）**：说明当前访问的域名下没有提供 `/api/v1/*` 接口。请在 Nginx/网关中把路径 `/api` 反向代理到唐僧叨叨后端（见下方「方案 B：Nginx 代理后端」）。  
> **Electron 桌面端**：推荐在 `confing.ts` 设置 **`remoteWebEntryUrl`**（远程网页壳，见 [docs/pc-electron-remote-web.md](docs/pc-electron-remote-web.md)）；若仍用 **`file://`** 本地包，再按 **「API 根地址说明」** 修改 **`ELECTRON_FILE_API_ROOT`** 后执行 `yarn build`。

```shell
make deploy
```

5. 清除缓存

```sh
yarn clean
```

### Docker 镜像构建（提速与维护）

根目录 `Dockerfile` 已做**依赖与源码分层**，避免「改一行业务代码就整包 `yarn install`」：

1. **第一层**：只复制根目录 `package.json`、`yarn.lock`、`.yarnrc`，以及各 workspace（`apps/*`、`packages/*`）下的 **`package.json`**，再执行 `yarn install`。
2. **第二层**：`COPY` 全部源码后执行 `yarn build`。

因此：**仅当依赖声明变化**（根或任一 workspace 的 `package.json` / 根 `yarn.lock`）时，Docker 才会重新安装依赖；日常只改 `.ts` / `.tsx` 等源码时，构建会复用依赖层，主要耗时在 `yarn build`。

此外使用 **BuildKit** 的 `RUN --mount=type=cache` 挂载 Yarn 缓存目录，在依赖层失效时也能减少重复下载。Compose / Docker 较新版本默认开启 BuildKit；若构建报错可执行 `export DOCKER_BUILDKIT=1` 后再构建。

**新建 workspace 时**：在仓库里增加了新的 `apps/*` 或 `packages/*` 包以后，必须在 `Dockerfile` 里为**该包**增加一行与现有风格一致的 `COPY …/package.json …`，否则安装阶段缺少目录，`yarn install` 会失败。

**日常构建建议**：使用 `docker compose build web`（或 `docker build`）即可利用缓存；**不要**在常规迭代里加 `--no-cache`，否则会强制跳过缓存、重新全量安装依赖。

`.dockerignore` 中已忽略 `.turbo`、`tmp_inspect` 等，以略微缩小构建上下文。

与 Compose 编排一起部署时，说明见上级目录 **`compose/README.md`**。

### 方案 B：Nginx 代理后端（同源 /api/v1）

后端 **已有** 表情商店等接口：`TangSengDaoDaoServer/modules/sticker` 在 `api.go` 中注册了 `/v1/sticker` 下的全部接口（如 `GET /v1/sticker/store`、`GET /v1/sticker/user/category` 等），且 `internal/modules.go` 已引入该模块。404 是因为当前提供页面的服务器（如 82 端口）没有把 `/api` 转到后端。

- **Docker 部署**：项目根目录的 `nginx.conf.template` 已配置 `location /api/`，会把 `/api/*` 转发到后端。**启动容器时传入后端地址**即可，例如：
  ```bash
  docker run -d -p 82:80 -e API_URL=http://唐僧叨叨后端地址:端口/ your-web-image
  ```
  其中 `API_URL` 为后端根 URL且**必须以 `/` 结尾**（如 `http://192.252.187.229:8080/`），这样请求 `http://你的域名:82/api/v1/sticker/store` 会被转发为 `http://后端:8080/v1/sticker/store`。

- **自建 Nginx**：在对应 `server` 里增加：
  ```nginx
  location /api/ {
      proxy_pass http://唐僧叨叨后端地址:端口/;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
  }
  ```
  重载 Nginx 后，表情商店等接口即可通过同源 `/api/v1/` 访问。

### API 根地址说明（Web / PC）

| 运行形态 | 使用的 API 根 | 换环境时怎么做 |
|---------|----------------|----------------|
| **Web（浏览器）** | 默认同源相对路径 **`/api/v1/`** | 用 Nginx/网关把 `/api` 反代到唐僧叨叨后端（见上文「方案 B」）；确需改默认行为时再改 `apps/web/src/index.tsx`。 |
| **Electron 本地调试**（页面为 `http://` / `https://`，如 `yarn dev-ele`） | **`/api/v1/`** | 与 Web 一致，依赖开发服务器或本机反代。 |
| **Electron 正式包**（页面为 **`file://`**） | `apps/web/src/index.tsx` 中的常量 **`ELECTRON_FILE_API_ROOT`** | 出包前改为当前环境的**完整** API 根（含协议、域名或 IP、端口、路径前缀）；或由 CI 在 `yarn build` 前对该常量做字符串替换后再编译。 |
| **Electron 正式包（推荐）** | **`apps/web/src-election/main/confing.ts` → `remoteWebEntryUrl`** | 填 **`http://www.你的域名/`**（与浏览器、HTTP 及安卓配置一致）；生产用 **`loadURL`** 打开线上 Web，接口走同源 **`/api/v1/`**。详见 **[PC 远程网页壳说明](docs/pc-electron-remote-web.md)**。 |

**关于「注入域名」、不用 `REACT_APP_API_URL`**：仅在使用 **本地 `file://` 包** 时，PC 无法像浏览器那样用相对路径走当前站点，须在 `ELECTRON_FILE_API_ROOT` 写完整 API 根。若改用 **`remoteWebEntryUrl` 远程网页壳**，则与 Web 一致，一般**不必**再配 `ELECTRON_FILE_API_ROOT`。

**地址格式**：须与真实可请求的 URL 一致，例如 `https://im.example.com/v1/`、`http://192.168.1.10:8080/v1/`；若网关统一前缀为 `/api/v1/`，则写 `https://你的域名/api/v1/` 等**绝对地址**，避免桌面端出现 `file:///api/...` 这类无效相对请求。

## Electron 版本运行

支持打包 Mac、Windows、Linux 操作系统桌面应用。

### PC 文档索引

> 📘 **使用者 / 测试 / 客服**：先看 **[PC 客户端使用说明（大白话版）](docs/pc-usage-guide.md)** —— 五种"开窗"场景、窗口缩放/最大化/全屏、托盘、通知、多账号、卸载、常见问题速查。
> 🛠 **开发 / 打包**：再看下面的远程网页壳/形态切换文档。

主文档：**[docs/pc-electron-remote-web.md](docs/pc-electron-remote-web.md)**（下文锚点在该文件内；GitHub / VS Code 等预览中可点击跳转。）

| 序号 | 章节 | 锚点 |
|------|------|------|
| 0 | 文档总述（远程壳 `loadURL`、与本地 `file` 关系） | [#pc-doc-overview](docs/pc-electron-remote-web.md#pc-doc-overview) |
| 1 | 适用场景 | [#pc-scenarios](docs/pc-electron-remote-web.md#pc-scenarios) |
| 2 | 你需要改哪里（总） | [#pc-config](docs/pc-electron-remote-web.md#pc-config) |
| 2.1 | 配置远程入口 `remoteWebEntryUrl` | [#pc-config-remote](docs/pc-electron-remote-web.md#pc-config-remote) |
| 2.2 | 打包命令 | [#pc-build-cmd](docs/pc-electron-remote-web.md#pc-build-cmd) |
| 2.3 | 服务端与网关 | [#pc-server-gw](docs/pc-electron-remote-web.md#pc-server-gw) |
| 3 | 前端行为说明（`/api/v1/`、`ELECTRON_FILE_API_ROOT`） | [#pc-frontend](docs/pc-electron-remote-web.md#pc-frontend) |
| 4 | 安全与运维提示（域名、离线、IPC 白名单登记） | [#pc-ops](docs/pc-electron-remote-web.md#pc-ops) |
| 5 | 与「本地 file + 绝对 API」对比表 | [#pc-compare](docs/pc-electron-remote-web.md#pc-compare) |
| 6 | 多开、多账号（`second-instance`、session partition） | [#pc-multi](docs/pc-electron-remote-web.md#pc-multi) |
| 6.1 | 安全收紧（sandbox、`contextIsolation`、preload 通道白名单、`update.ts`） | [#pc-security](docs/pc-electron-remote-web.md#pc-security) |
| 6.2 | 托盘按窗口未读、Windows 托盘角标数字 | [#pc-tray](docs/pc-electron-remote-web.md#pc-tray) |
| 6.3 | 主进程小优化（子窗关闭、`ready` 顺序、IPC 单次注册） | [#pc-main-optim](docs/pc-electron-remote-web.md#pc-main-optim) |

> [!TIP]
> **以后 PC 默认推荐**：在 `apps/web/src-election/main/confing.ts` 设置 **`remoteWebEntryUrl`**（如 `http://www.tu2t0.com/`），用远程网页壳方式出包。  
> 同一篇说明里还汇总了：**远程壳 / 本地 file 对比**、**多开与独立会话（partition）**、**安全收紧（sandbox + IPC 白名单）**、**托盘按窗口未读 + Windows 托盘角标数字**、**主进程启动顺序等小优化**。详见 **[docs/pc-electron-remote-web.md](docs/pc-electron-remote-web.md)**。

1. 安装依赖

```shell
yarn install
```

2. 本地开发调试

```shell
yarn dev-ele
```

3. 编译

```shell
yarn build
```

4. Mac APP 打包

> [!TIP]
> 注意先运行`yarn build`编译

```shell
yarn build-ele:mac
```

5. Windows APP 打包

> [!IMPORTANT]
> **推荐**：在 `confing.ts` 配置 **`remoteWebEntryUrl`**（例如 `http://www.tu2t0.com/`），生产环境用 **`loadURL`** 打开已部署 Web，与浏览器、HTTP、安卓填的主域一致；详见 **[docs/pc-electron-remote-web.md](docs/pc-electron-remote-web.md)**。  
> **备选**：`remoteWebEntryUrl` 留空时，仍为本地 **`file://` + `build/index.html`**，此时须按上文 **「API 根地址说明」** 设置 **`ELECTRON_FILE_API_ROOT`**。

```shell
yarn build
yarn build-ele:win
```

> [!TIP]
> 使用 **`file://`** 备选方案时，须使用**绝对** API 根（`ELECTRON_FILE_API_ROOT`）；使用远程网页壳时，一般走同源 **`/api/v1/`**，无需再配该常量。

### Linux 环境执行 Windows 打包（同一打包方式）

如果在 Linux 上执行同一个 `yarn build-ele:win` 命令，建议先安装以下依赖：

- `wine`
- `mono`
- `7z`（`p7zip-full`）
- `nsis`（`makensis`）
- `osslsigncode`（若需要签名）
- `mingw-w64`（可选，交叉编译工具链）

```bash
cd /root && apt-get update && apt-get install -y mono-complete p7zip-full nsis osslsigncode mingw-w64
```

```bash
cd /root && mono --version && 7z | head -n 2 && makensis -VERSION && osslsigncode --version && x86_64-w64-mingw32-gcc --version
```

> [!WARNING]
> 若在 Linux + Wine 环境下遇到 `rcedit` 失败（如 `Fatal error: U...`），通常是 Windows 可执行文件名包含中文导致。  
> 本仓库已将 Windows 可执行文件名固定为 ASCII（`TASIM`）以规避该问题。
>
> 若仍出现 `rcedit` 相关报错（例如版本信息中的 Unicode 字符导致失败），可在 `apps/web/electron-builder.js` 的 `win` 配置中保持：
>
> ```js
> signAndEditExecutable: false
> ```
>
> 该配置会跳过 Linux + Wine 环境中不稳定的可执行文件版本信息编辑步骤，提升打包成功率。

5. Linux APP 打包

> [!TIP]
> 注意先运行`yarn build`编译

```shell
yarn build-ele:linux
```
