import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BaseModule, WKApp, StorageService } from '@tsdaodao/base';
import { LoginModule } from '@tsdaodao/login';
import { DataSourceModule } from '@tsdaodao/datasource';
import { ContactsModule } from '@tsdaodao/contacts';
import { GroupManagerModule } from '@tsdaodao/groupmanager';
import { AdvancedModule } from '@tsdaodao/advanced';
// import { MomentsModule } from '@tsdaodao/moments';
import { PrivacyModule } from '@tsdaodao/privacy';
import { StickerModule } from '@tsdaodao/sticker';
import { VideoModule } from '@tsdaodao/video';
import { FavoriteModule } from '@tsdaodao/favorite';
import { FileModule } from '@tsdaodao/file';

const ua = (navigator?.userAgent || "").toLowerCase()
const pageProto = (typeof window !== "undefined" && window.location && window.location.protocol) || ""
// app: 与 file: 都是本地壳协议（自定义 app:// 与传统 file://），统一识别为 Electron 离线入口
const isLocalShellProto = pageProto === "file:" || pageProto === "app:"
const isElectron = !!(window as any)?.__POWERED_ELECTRON__ || ua.includes("electron") || isLocalShellProto
const electronCanUseRelativeApi = pageProto === "http:" || pageProto === "https:"

/** PC Electron 正式包（file://）的 API 根；换服务器时改此处或由构建流水线替换后再 yarn build。 */
const ELECTRON_FILE_API_ROOT = "http://www.tu2t0.com/v1/"

// 浏览器默认同源反代 /api/v1/；Electron 开发（http/https 页）同上；file:// 正式包使用上方常量。
let defaultAPI: string
if (isElectron) {
  if (electronCanUseRelativeApi) {
    defaultAPI = "/api/v1/"
  } else {
    defaultAPI = ELECTRON_FILE_API_ROOT
  }
} else {
  defaultAPI = "/api/v1/"
}

WKApp.apiClient.config.apiURL = defaultAPI


WKApp.apiClient.config.tokenCallback = () => {
  return WKApp.loginInfo.token
}
WKApp.config.appVersion = `${process.env.REACT_APP_VERSION || "0.0.0"}`

// H5：无 sid 时 LoginInfo 用空后缀存 token，登录后 Layout 再写入随机 sid 会导致刷新后读不到登录态。
// 进入页面即补齐 sid，确保 LoginInfo 始终使用稳定的 storage key。
function ensureStableSessionSidInUrl() {
  // Tauri 路线已下线，只判 Electron / 本地壳协议
  if ((window as any).__POWERED_ELECTRON__ || isElectron || isLocalShellProto) {
    return
  }
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.get("sid")) {
      return
    }
    const key = "wk_web_tab_sid"
    let sid = StorageService.shared.getItem(key) || ""
    if (!sid) {
      sid = Math.random().toString(36).slice(-8)
      StorageService.shared.setItem(key, sid)
    }
    url.searchParams.set("sid", sid)
    window.history.replaceState(null, document.title, url.toString())
  } catch {
    // ignore
  }
}
ensureStableSessionSidInUrl();

WKApp.loginInfo.load() // 加载登录信息（若上一步已写入 storage，此处会再次合并）

WKApp.shared.registerModule(new BaseModule()); // 基础模块
WKApp.shared.registerModule(new DataSourceModule()) // 数据源模块
WKApp.shared.registerModule(new LoginModule()); // 登录模块
WKApp.shared.registerModule(new ContactsModule()); // 联系模块
WKApp.shared.registerModule(new GroupManagerModule()); // 群管理模块
WKApp.shared.registerModule(new AdvancedModule()); // 旗舰模块
// WKApp.shared.registerModule(new MomentsModule()); // 朋友圈模块（已禁用）
WKApp.shared.registerModule(new PrivacyModule()); // 安全与隐私模块
WKApp.shared.registerModule(new StickerModule()); // 表情模块
WKApp.shared.registerModule(new VideoModule()); // 视频发送模块
WKApp.shared.registerModule(new FavoriteModule()); // 收藏模块
WKApp.shared.registerModule(new FileModule()); // 文件模块

WKApp.shared.startup() // app启动

// Initialize Electron notification bridge if running in Electron


ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
reportWebVitals();

