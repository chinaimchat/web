# EXE 登录/扫码排障记录

## 问题现象

- Windows `exe` 端扫码登录页二维码区域空白。
- 手机号登录点击后提示“未知错误”。
- 同一版本的 Web 端登录正常。

## 根因

- 渲染端 API 默认地址使用了相对路径 `"/api/v1/"`。
- Web 端通过同源代理可正常请求；但 Electron `exe` 端页面协议为 `file://`，相对路径不会走 Nginx 代理，导致接口请求失败。
- 登录页依赖接口：
  - `GET user/loginuuid`（生成扫码 uuid/二维码内容）
  - `POST user/login`（手机号登录）
  请求失败后表现为“二维码不显示”和“未知错误”。

## 修复

文件：`apps/web/src/index.tsx`

- 新增 Electron 环境判断 `isElectron`。
- Electron `file://` 正式包使用 `apps/web/src/index.tsx` 中的常量 `ELECTRON_FILE_API_ROOT`（默认 `http://www.tu2t0.com/v1/`）；与 README 中 **「API 根地址说明（Web / PC）」** 一致：换环境时改该常量或由 CI 注入后再 `yarn build`，不使用 `REACT_APP_API_URL`。
- Web 端仍保持默认 `"/api/v1/"`。

文件：`packages/tsdaodaologin/src/login_vm.tsx`

- `requestUUID()` 失败时补充明确提示：
  - `获取二维码失败，请检查服务器地址或网络`

## 部署与打包注意事项（避免复发）

- 推荐在打包前在 `apps/web/src/index.tsx` 将 `ELECTRON_FILE_API_ROOT` 改为目标环境的完整 API 根（如 `http://你的域名或IP:端口/v1/`）。
- 重新打包后验证：
  - 扫码页出现二维码；
  - 手机号登录不再出现“未知错误”。
- 若更换服务器域名/IP，同步更新上述常量后再 `yarn build`。

## 补充：退出登录后 `/login` 页面 logo 裂图

### 现象

- `exe` 启动时 logo 正常；
- 登录后退出回到 `/login`，logo 显示破图。

### 根因

- 登录页 logo 使用了相对路径；
- Electron 在 `file://` 协议下路由切换到 `/login` 时，相对路径可能被解析到错误位置。

### 修复

文件：`packages/tsdaodaologin/src/login.tsx`

- 新增 `resolveAppLogo()`：
  - `file://` 环境下，从 `main.*.js` 的绝对路径回推 `build/logo.jpg`；
  - 非 `file://` 环境继续使用 `PUBLIC_URL`。
- 登录/注册页 logo 统一使用 `APP_LOGO`，避免路由切换后路径漂移。
