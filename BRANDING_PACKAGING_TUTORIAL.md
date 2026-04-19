# 品牌改名与桌面图标打包教程（Web/Electron）

这份文档用于以后快速执行以下流程：

- 改应用名称（网页标题、桌面应用名、快捷方式名）
- 改桌面图标（Windows `icon.ico`）
- 执行开发与打包命令

> [!IMPORTANT]
> Windows 桌面端打包方式是：**Electron 本地资源（`file://`）运行页面 + API 走远程 HTTP(S) 地址**。  
> 这不是 `loadURL` 远程网页壳模式。

---

## 1) 以后你只要发这句指令

在 Cursor 里直接发：

`执行品牌打包向导`

我会先按固定问题问你：

1. 新名字是什么（例如：`抖商学院`）  
2. logo 文件路径是什么（例如：`/root/logo.jpg`）  
3. 是否需要我自动提交并推送到 git（`是/否`）

---

## 2) 环境要求（先装好）

建议环境（本次实测可用）：

- Node.js（建议 `22.x`，至少 `>=20`）
- Yarn `1.22.x`
- Electron Builder（项目内已声明依赖）

如果在 Linux 上打 Windows 包（`yarn build-ele:win`），需要：

- `wine64`
- `wine32:i386`（必须开启 i386 架构后安装）
- `nsis`（electron-builder 会自动拉取其二进制资源）

建议先执行：

```bash
node -v
yarn -v
```

---

## 3) 一次性环境准备命令（Linux）

### 3.1 Node 与 Yarn

```bash
# 仅示例：安装 Node 22（你也可以用 nvm）
apt-get update
apt-get install -y nodejs npm
npm install -g yarn
```

### 3.2 Windows 打包依赖（在 Linux 打包 win 时）

```bash
apt-get update
apt-get install -y wine64
dpkg --add-architecture i386
apt-get update
apt-get install -y wine32:i386
```

---

## 4) 需要修改的关键文件

- `apps/web/electron-builder.js`
  - `productName`（应用名）
  - `nsis.shortcutName`（桌面快捷方式名）
  - `win.icon`（Windows 图标文件，默认 `resources/icons/icon.ico`）
- `apps/web/public/index.html`
  - `<title>` 与 favicon
- `apps/web/public/manifest.json`
  - `name`、`short_name`、icons
- `packages/tsdaodaobase/src/App.tsx`
  - 应用内默认名称 `appName`

Windows 图标资源：

- `apps/web/resources/icons/icon.ico`（打包关键）

---

## 5) 标准命令流程（按顺序）

在 `web` 根目录执行：

```bash
yarn install
```

本地联调 Electron：

```bash
yarn dev-ele
```

正式打包前先编译：

```bash
yarn build
```

打 Windows 安装包：

```bash
yarn build-ele:win
```

桌面端 API 建议使用绝对地址（例如 `https://your-domain/api/v1/` 或 `http://your-domain:82/api/v1/`），避免出现 `file:///api/...` 的相对路径请求失败。

---

## 6) 本次踩坑与处理（重点）

### 问题 A：`yarn: command not found`

原因：未安装 Yarn。  
处理：

```bash
npm install -g yarn
```

### 问题 B：`minimatch@10 ... Expected node 20 || >=22`

原因：Node 版本过低（18 不满足某些依赖引擎要求）。  
处理：升级到 Node 22 后重试 `yarn install`。

### 问题 C：`... npmmirror ... statusCode=403`

原因：网络/代理对镜像源限制。  
处理：

- 检查网络代理设置；
- 换可访问网络后重跑 `yarn install`；
- 必要时更换 npm/yarn registry。

### 问题 D：`wine is required` / `wine32 is missing`

原因：Linux 打 Windows 包缺少 wine 依赖。  
处理：安装 `wine64` + `wine32:i386`（见上文 3.2）。

### 问题 E：`Bad system call`（沙箱内 wine 调用失败）

原因：受运行环境沙箱限制。  
处理：在允许完整系统调用的环境执行打包命令（非受限沙箱）。

### 问题 F：`winCodeSign-2.6.0.7z ... status code 503`

原因：`electron-builder` 在生成 Windows 安装包时，需要下载 `winCodeSign`，但访问 GitHub 资源返回 503。  
处理：

- 这是网络可达性问题，不是业务代码编译错误；
- 先确认 `yarn build` 已成功（前端构建和该错误无关）；
- 配置镜像后重试：

```bash
export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export CSC_IDENTITY_AUTO_DISCOVERY=false
yarn build-ele:win
```

- 如果仍失败，手动预下载并写入缓存：

```bash
mkdir -p ~/.cache/electron-builder/winCodeSign
curl -fL "https://npmmirror.com/mirrors/electron-builder-binaries/winCodeSign-2.6.0/winCodeSign-2.6.0.7z" \
  -o ~/.cache/electron-builder/winCodeSign/winCodeSign-2.6.0.7z
```

---

## 7) 常见注意事项

- 必须先执行 `yarn build`，再执行 `yarn build-ele:win`
- 同一个仓库尽量只用一种包管理器（推荐 Yarn），避免 `npm install` 与 `yarn install` 混用
- `logo.jpg` 不能直接给 Windows 打包当图标，需转换为 `icon.ico`
- 改名后若界面未更新，需重启应用/清缓存再看
- 若打包命令报错，优先看报错中的缺失依赖提示并按缺啥补啥

Windows 产物说明：

- `*-Setup-*.exe`：安装版（适合正式发布，支持安装/卸载）
- `*-Portable-*.exe`：便携版（免安装，适合临时分发或 U 盘使用）

---

## 8) 一句话使用示例

你以后只需说：

`执行品牌打包向导：名字改成 抖商学院，logo 用 /root/logo.jpg，并打 Windows 包`

我会按流程自动处理并回报结果。

