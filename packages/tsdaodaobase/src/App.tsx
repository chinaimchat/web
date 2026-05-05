import mitt from "mitt";
import { EndpointCommon } from "./EndpointCommon";
import APIClient from "./Service/APIClient";
import MenusManager from "./Service/Menus";
import { EndpointManager, IModule, ModuleManager } from "./Service/Module";
import { ProviderListener } from "./Service/Provider";
import RouteManager, { ContextRouteManager } from "./Service/Route";
import {
  Channel,
  ChannelTypeGroup,
  ChannelTypePerson,
  WKSDK,
  Message,
  MessageContentType,
} from "wukongimjssdk";
import { IConversationProvider } from "./Service/DataSource/DataProvider";
import MessageManager from "./Service/MessageManager";
import { DefaultEmojiService, EmojiService } from "./Service/EmojiService";
import SectionManager, { Row, Section } from "./Service/Section";
import { EndpointCategory } from "./Service/Const";
import { DataSource } from "./Service/DataSource/DataSource";
import { ConnectAddrCallback } from "wukongimjssdk";

import "animate.css";
import "./App.css";
import RouteContext from "./Service/Context";
import { ConnectStatus } from "wukongimjssdk";
import { WKBaseContext } from "./Components/WKBase";
import StorageService from "./Service/StorageService";
import { ProhibitwordsService } from "./Service/ProhibitwordsService";

export enum ThemeMode {
  light,
  dark,
}
export class WKConfig {
  appName: string = "AI抖商学院";
  appVersion: string = "0.0.0"; // app版本
  themeColor: string = "#E46342"; // 主题颜色
  secondColor: string = "rgba(232, 234, 237)";
  pageSize: number = 15; // 数据页大小
  pageSizeOfMessage: number = 30; // 每次请求消息数量
  fileHelperUID: string = "fileHelper"; // 文件助手UID
  systemUID: string = "u_10000"; // 系统uid

  private _themeMode: ThemeMode = ThemeMode.light; // 主题模式

  set themeMode(v: ThemeMode) {
    this._themeMode = v;
    const body = document.body;
    if (v === ThemeMode.dark) {
      if (body.hasAttribute("theme-mode")) {
        body.removeAttribute("theme-mode");
        body.setAttribute("theme-mode", "dark");
      } else {
        body.setAttribute("theme-mode", "dark");
      }
    } else {
      body.removeAttribute("theme-mode");
    }
    StorageService.shared.setItem("theme-mode", `${v}`);
    WKApp.shared.notifyListener();
  }

  get themeMode() {
    return this._themeMode;
  }
}

export class WKRemoteConfig {
  revokeSecond: number = 2 * 60; // 撤回时间
  inviteCodeSystemOn: number = 0; // 邀请码系统总开关（1: 开启；控制注册是否必须填邀请码）
  showLastOfflineOn: number = 1; // 是否显示对方上次在线时间
  /** 是否展示对方分端在线（Web/手机/PC）；0 时客户端不应渲染分端文案，服务端已对非本人 device_flag 脱敏 */
  showDeviceOnlineOn: number = 1;
  requestSuccess: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 5; // 最大重试次数

  async startRequestConfig() {
    await this.requestConfig();

    if (!this.requestSuccess && this.retryCount < this.maxRetries) {
      this.retryCount++;
      // 指数退避: 3s, 6s, 12s, 24s, 48s
      const delay = 3000 * Math.pow(2, this.retryCount - 1);
      setTimeout(() => {
        this.startRequestConfig();
      }, delay);
    }
  }

  requestConfig() {
    return WKApp.apiClient.get("common/appconfig").then((result) => {
      this.requestSuccess = true;
      this.revokeSecond = result["revoke_second"];
      this.inviteCodeSystemOn = Number(result["invite_code_system_on"] || 0);
      this.showLastOfflineOn = Number(result["show_last_offline_on"] ?? 1);
      this.showDeviceOnlineOn = Number(result["show_device_online_on"] ?? 1);
    });
  }
}

export type MessageDeleteListener = (
  message: Message,
  preMessage?: Message
) => void;

export class LoginInfo {
  appID!: string;
  shortNo!: string; // 短号
  token?: string;
  uid?: string;
  name: string | undefined;
  role!: string;
  category?: string;
  isWork!: boolean;
  sex!: number;

  /**
   * save 保存登录信息
   */
  public save() {
    this.setStorageItemForSID("app_id", this.appID ?? "");
    this.setStorageItemForSID("short_no", this.shortNo ?? "");
    this.setStorageItemForSID("uid", this.uid ?? "");
    this.setStorageItemForSID("token", this.token ?? "");
    this.setStorageItemForSID("name", this.name ?? "");
    this.setStorageItemForSID("role", this.role ?? "");
    this.setStorageItemForSID("category", this.category ?? "");
    this.setStorageItemForSID("is_work", this.isWork ? "1" : "0");
    this.setStorageItemForSID("sex", this.sex == 1 ? "1" : "0");
  }

  // 获取查询参数
  public getQueryVariable(variable: string) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split("=");
      if (pair[0] === variable) {
        return pair[1];
      }
    }
    return false;
  }

  public setStorageItemForSID(key: string, value: string) {
    let sid = this.getSID();

    this.setStorageItem(key + sid, value);
  }

  public getStorageItemForSID(key: string): string | null {
    let sid = this.getSID();
    return this.getStorageItem(key + sid);
  }

  public removeStorageItemForSID(key: string) {
    let sid = this.getSID();
    this.removeStorageItem(key + sid);
  }

  public getSID(): string {
    let sid = this.getQueryVariable("sid") || "";
    return sid;
  }

  public setStorageItem(key: string, value: string) {
    StorageService.shared.setItem(key, value);
  }
  public getStorageItem(key: string): string | null {
    return StorageService.shared.getItem(key);
  }
  public removeStorageItem(key: string) {
    StorageService.shared.removeItem(key);
  }

  /**
   * load 加载登录信息
   */
  public load() {
    this.uid = this.getStorageItemForSID("uid") || "";
    this.shortNo = this.getStorageItemForSID("short_no") || "";
    this.token = this.getStorageItemForSID("token") || "";
    this.name = this.getStorageItemForSID("name") || "";
    this.appID = this.getStorageItemForSID("app_id") || "";
    this.role = this.getStorageItemForSID("role") || "";
    this.category = this.getStorageItemForSID("category") || "";
    const isWorkStr = this.getStorageItemForSID("is_work");
    if (isWorkStr === "1") {
      this.isWork = true;
    } else {
      this.isWork = false;
    }

    const sexStr = this.getStorageItemForSID("sex");
    if (sexStr === "1") {
      this.sex = 1;
    } else {
      this.sex = 0;
    }
  }
  // 是否登录
  isLogined() {
    if (!this.token || this.token === "") {
      return false;
    }
    return true;
  }
  logout() {
    this.token = undefined;
    this.appID = "";
    this.role = "";
    this.category = "";
    this.removeStorageItemForSID("token");
    this.removeStorageItemForSID("app_id");
    this.removeStorageItemForSID("role");
    this.removeStorageItemForSID("category");
    this.removeStorageItemForSID("is_work");
  }
}

export default class WKApp extends ProviderListener {
  private constructor() {
    super();
  }
  public static shared = new WKApp();
  static route = RouteManager.shared; // 路由管理
  static routeLeft = new ContextRouteManager(); // 左边页面路由
  static routeRight = new ContextRouteManager(); // 右边（main）页面路由
  static menus = MenusManager.shared; // 菜单
  static apiClient = APIClient.shared; // api客户端
  static config: WKConfig = new WKConfig(); // app配置
  static remoteConfig: WKRemoteConfig = new WKRemoteConfig(); // 远程配置
  static loginInfo: LoginInfo = new LoginInfo(); // 登录信息
  static endpoints: EndpointCommon = new EndpointCommon(); // 常用端点
  static conversationProvider: IConversationProvider; // 最近会话相关数据源
  static messageManager: MessageManager = new MessageManager(); // 消息管理
  static emojiService: EmojiService = DefaultEmojiService.shared; // emoji
  static sectionManager: SectionManager = new SectionManager(); // section管理
  static dataSource: DataSource = new DataSource(); // 数据源
  static endpointManager: EndpointManager = EndpointManager.shared; // 端点管理
  static mittBus = mitt();
  private messageDeleteListeners: MessageDeleteListener[] =
    new Array<MessageDeleteListener>(); // 消息删除监听

  supportFavorites = [MessageContentType.text, MessageContentType.image]; // 注册收藏的消息
  supportEdit = [MessageContentType.text]; // 注册编辑的消息
  notSupportForward: number[] = []; // 不支持转发的消息

  openChannel?: Channel; // 当前打开的会话频道
  content?: JSX.Element;

  baseContext!: WKBaseContext; // 抖商学院 基础上下文

  private _notificationIsClose: boolean = false; // 通知是否关闭

  private wsaddrs = new Array<string>(); // ws的连接地址
  private addrUsed = false; // 地址是否被使用
  private lastImConnectUid = ""; // 最近一次 IM 连接的 uid
  private lastImConnectToken = ""; // 最近一次 IM 连接的 token
  /** 避免重复注册 visibility / online 监听 */
  private imResumeHandlersBound = false;
  /** IM 鉴权失败（reasonCode=2）后是否已做过一次「刷新 userIM + 重连」；成功连上后清零 */
  private imAuthRecoveryAttempted = false;
  /** 最近一次收到心跳 PONG（ConnectDelayListener，delay≠9999）的时间；用于发现「状态 Connected 但链路已死」 */
  private imLastPongAt = 0;
  /** 假活软重连节流，避免与 SDK 内部重连叠加 */
  private imLastStaleRecoverAt = 0;
  private imStaleProbeTimer: ReturnType<typeof setInterval> | null = null;
  private imDelayListenerBound = false;

  isPC = false; // 是否是PC端
  deviceId: string = ""; // 设备ID
  deviceName: string = ""; // 设备名称
  deviceModel: string = ""; // 设备型号

  set notificationIsClose(v: boolean) {
    this._notificationIsClose = v;
    StorageService.shared.setItem("NotificationIsClose", v ? "1" : "");
  }

  get notificationIsClose() {
    return this._notificationIsClose;
  }

  // app启动
  startup() {
    WKApp.loginInfo.load(); // 加载登录信息

    // 是否是PC端（Tauri 路线已下线，只认 Electron preload 注入的 __POWERED_ELECTRON__）
    if ((window as any)?.__POWERED_ELECTRON__) {
      this.isPC = true;
      WKSDK.shared().config.deviceFlag = 2;
      console.log("PC端")
    } else {
      WKSDK.shared().config.deviceFlag = 1;
    }
    this.deviceId = this.getWindowScopedDeviceId();
    this.deviceName = this.getOSAndVersion();
    this.deviceModel = this.getBrandsFromUserAgent();

    console.log("设备信息--->", this.deviceId, this.deviceName, this.deviceModel);

    const themeMode = StorageService.shared.getItem("theme-mode");
    if (themeMode === "1") {
      WKApp.config.themeMode = ThemeMode.dark;
    }

    WKSDK.shared().config.provider.connectAddrCallback = async (
      callback: ConnectAddrCallback
    ) => {
      // 每次建连前都走 users/{uid}/im：服务端 userIM 会把当前会话 token 同步到悟空。
      // 若重连时复用旧 wsaddrs、跳过该请求，IM 重启或 token 已轮换后易出现 not found / verify fail，
      // 表现为频繁掉线、消息发不出，只能退出重登。
      try {
        this.wsaddrs = await WKApp.dataSource.commonDataSource.imConnectAddrs();
      } catch (e) {
        console.error("[im] imConnectAddrs 请求失败", e);
        this.wsaddrs = [];
      }
      if (this.wsaddrs.length > 0) {
        this.addrUsed = true;
        callback(this.wsaddrs[0]);
      } else {
        console.error(
          "[im] 无可用 WebSocket 地址，请检查接口 users/{uid}/im 与网关配置"
        );
      }
    };

    this.bindImHeartbeatStaleProbe();

    WKApp.endpoints.addOnLogin(() => {
      this.startMain();
    });

    if (WKApp.loginInfo.isLogined()) {
      this.startMain();
    }

    WKSDK.shared().connectManager.addConnectStatusListener(
      (status: ConnectStatus, reasonCode?: number) => {
        if (status === ConnectStatus.Connected) {
          this.imAuthRecoveryAttempted = false;
          this.imLastPongAt = Date.now();
          this.scheduleImStaleProbe();
        }
        if (
          status === ConnectStatus.Disconnect ||
          status === ConnectStatus.ConnectFail
        ) {
          this.stopImStaleProbe();
        }
        if (status === ConnectStatus.ConnectKick) {
          console.log("被踢--->", reasonCode);
          WKApp.shared.logout();
        } else if (reasonCode === 2) {
          // 认证失败：先强制再走 userIM 同步 token 并重连一次，避免轻微漂移就只能重登
          console.warn("[im] CONNACK 认证失败，尝试刷新 IM 凭证后重连");
          if (!this.imAuthRecoveryAttempted) {
            this.imAuthRecoveryAttempted = true;
            this.refreshImConnectionSoft();
          } else {
            this.imAuthRecoveryAttempted = false;
            WKApp.shared.logout();
          }
        } else if (status === ConnectStatus.Disconnect) {
          if (this.addrUsed && this.wsaddrs.length > 1) {
            const oldwsAddr = this.wsaddrs[0];
            this.wsaddrs.splice(0, 1);
            this.wsaddrs.push(oldwsAddr);
            this.addrUsed = false;
            console.log("连接失败！切换地址->", this.wsaddrs);
          }
        }
      }
    );

    this.bindImResumeReconnectHandlers();

    // 通知设置
    const notificationIsClose = StorageService.shared.getItem(
      "NotificationIsClose"
    );
    if (notificationIsClose === "1") {
      this._notificationIsClose = true;
    } else {
      this._notificationIsClose = false;
    }

    WKApp.remoteConfig.startRequestConfig();


  }

  getDeviceIdFromStorage() {
    let deviceId = StorageService.shared.getItem("deviceId");
    if (!deviceId || deviceId === "") {
      deviceId = this.generateUUID();
      StorageService.shared.setItem("deviceId", deviceId);
    }
    return deviceId;
  }

  /**
   * 设备标识拆成两层：
   * - baseDeviceId: 机器级（持久化在 local storage）
   * - windowId: 窗口级（sessionStorage，每个窗口独立）
   * 最终组合上报，避免同账号多窗口被判定为同设备互挤。
   */
  getWindowScopedDeviceId() {
    const baseDeviceId = this.getDeviceIdFromStorage();
    if (typeof window === "undefined") {
      return baseDeviceId;
    }
    const windowIdKey = "wk-window-id";
    let windowId = window.sessionStorage.getItem(windowIdKey);
    if (!windowId || windowId === "") {
      windowId = this.generateUUID();
      window.sessionStorage.setItem(windowIdKey, windowId);
    }
    return `${baseDeviceId}:${windowId}`;
  }

  generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (
      c
    ) {
      var r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  getOSAndVersion() {
    const userAgent: string = navigator.userAgent;
    if (/Windows NT (\d+\.\d+)/i.test(userAgent)) {
      const version = userAgent.match(/Windows NT (\d+\.\d+)/i)?.[1];
      return `Windows ${version}`;
    } else if (/Mac OS X (\d+_\d+(_\d+)?)/i.test(userAgent)) {
      const version = userAgent.match(/Mac OS X (\d+_\d+(_\d+)?)/i)?.[1]?.replace(/_/g, ".");
      return `MacOS ${version}`;
    } else if (/Android (\d+(\.\d+)?)/i.test(userAgent)) {
      const version = userAgent.match(/Android (\d+(\.\d+)?)/i)?.[1];
      return `Android ${version}`;
    } else if (/CPU (iPhone )?OS (\d+_\d+(_\d+)?)/i.test(userAgent)) {
      const version = userAgent.match(/CPU (iPhone )?OS (\d+_\d+(_\d+)?)/i)?.[2]?.replace(/_/g, ".");
      return `iOS ${version}`;
    } else if (/Linux/i.test(userAgent)) {
      return "Linux (version not available)";
    } else {
      return "Unknown OS and version";
    }
  }

  getBrandsFromUserAgent(): string {
    const userAgent: string = navigator.userAgent;

    if (/Chrome\/(\d+)/i.test(userAgent)) {
      const version = userAgent.match(/Chrome\/(\d+)/i)?.[1];
      return `Chrome ${version}`;
    } else if (/Firefox\/(\d+)/i.test(userAgent)) {
      const version = userAgent.match(/Firefox\/(\d+)/i)?.[1];
      return `Firefox ${version}`;
    } else if (/Safari\/(\d+)/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
      const version = userAgent.match(/Version\/(\d+)/i)?.[1];
      return `Safari ${version}`;
    } else if (/Edge\/(\d+)/i.test(userAgent)) {
      const version = userAgent.match(/Edge\/(\d+)/i)?.[1];
      return `Edge ${version}`;
    } else {
      return "Unknown browser";
    }
  }

  /**
   * 浏览器后台标签、休眠或断网后 WebSocket 常已失效，但 SDK 可能仍处于断连或长时间重连中。
   * 在页面重新可见或网络恢复时主动 connectIM（内部会跳过已连接/连接中的同会话重复连接）。
   */
  private bindImResumeReconnectHandlers() {
    if (this.imResumeHandlersBound || typeof window === "undefined") {
      return;
    }
    this.imResumeHandlersBound = true;

    const tryReconnect = () => {
      if (!WKApp.loginInfo.isLogined()) {
        return;
      }
      const st = WKSDK.shared().connectManager.status;
      if (st !== ConnectStatus.Connected && st !== ConnectStatus.Connecting) {
        console.log("[im] resume: reconnect after visibility/network restore, status=", st);
        this.connectIM();
      }
    };

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        tryReconnect();
      }
    });
    window.addEventListener("online", tryReconnect);
    window.addEventListener("pageshow", (e: PageTransitionEvent) => {
      if (e.persisted) {
        tryReconnect();
      }
    });
    // Electron：系统休眠/唤醒不会触发浏览器 visibility 的完整链路，由主进程 powerMonitor 转发
    const ipc = (window as { ipc?: { on: (ch: string, fn: () => void) => void } })
      .ipc;
    if ((window as { __POWERED_ELECTRON__?: boolean }).__POWERED_ELECTRON__ && ipc?.on) {
      ipc.on("system-resume", () => {
        tryReconnect();
      });
    }
  }

  /**
   * 监听 SDK 心跳 RTT；9999 为 ping 超时内部值，不计入「收到 PONG」。
   */
  private bindImHeartbeatStaleProbe() {
    if (this.imDelayListenerBound || typeof window === "undefined") {
      return;
    }
    this.imDelayListenerBound = true;
    WKSDK.shared().connectManager.addConnectDelayListener((delay: number) => {
      if (delay !== 9999) {
        this.imLastPongAt = Date.now();
      }
    });
  }

  private stopImStaleProbe() {
    if (this.imStaleProbeTimer != null) {
      clearInterval(this.imStaleProbeTimer);
      this.imStaleProbeTimer = null;
    }
  }

  /**
   * Connected 后周期性检查：若长时间没有新的 PONG，认为 TCP 假活（常见表现：发消息一直失败）。
   * 走与 token 恢复相同的软重连（清空 wsaddrs → disconnect → connectIM，强制 userIM）。
   */
  private scheduleImStaleProbe() {
    this.stopImStaleProbe();
    if (!WKApp.loginInfo.isLogined()) {
      return;
    }
    const sdk = WKSDK.shared();
    const hb = sdk.config.heartbeatInterval || 60000;
    const intervalMs = Math.min(
      45000,
      Math.max(20000, Math.floor(hb * 0.75))
    );
    this.imStaleProbeTimer = setInterval(() => {
      if (!WKApp.loginInfo.isLogined()) {
        this.stopImStaleProbe();
        return;
      }
      if (!sdk.connectManager.connected()) {
        return;
      }
      if (this.imLastPongAt <= 0) {
        return;
      }
      const threshold = Math.max(Math.floor(hb * 2.5), 120000);
      if (Date.now() - this.imLastPongAt <= threshold) {
        return;
      }
      const now = Date.now();
      if (now - this.imLastStaleRecoverAt < 60000) {
        return;
      }
      this.imLastStaleRecoverAt = now;
      console.warn(
        "[im] stale probe: 超过阈值仍无 PONG，尝试刷新 userIM 并重连",
        { thresholdMs: threshold, heartbeatMs: hb }
      );
      this.refreshImConnectionSoft();
    }, intervalMs);
  }

  /** 强制重新拉 userIM 并建连（不切登录态） */
  private refreshImConnectionSoft() {
    this.wsaddrs = [];
    this.addrUsed = false;
    try {
      WKSDK.shared().disconnect();
    } catch {
      // ignore
    }
    setTimeout(() => {
      WKApp.shared.connectIM();
    }, 300);
  }

  startMain() {
    this.connectIM();
    WKApp.dataSource.contactsSync(); // 同步通讯录
    // ProhibitwordsService.shared.sync(); // 同步敏感词

    WKApp.apiClient.get(`/user/devices/${WKApp.shared.deviceId}`).then((res) => {
      if (res.id) {
        WKSDK.shared().config.clientMsgDeviceId = res.id;
      }
    })
  }

  connectIM() {
    const uid = WKApp.loginInfo.uid || "";
    const token = WKApp.loginInfo.token || "";
    if (!uid || !token) {
      return;
    }

    const sdk = WKSDK.shared();
    const status = sdk.connectManager.status;
    const active = status === ConnectStatus.Connected || status === ConnectStatus.Connecting;
    const sameSession = uid === this.lastImConnectUid && token === this.lastImConnectToken;

    if (sameSession && active) {
      // 已连接时也保持假活探测（避免只连一次、从不进入 Connected 监听补 schedule）
      this.scheduleImStaleProbe();
      console.log("[im] skip duplicate connect", uid, status);
      return;
    }

    if (!sameSession) {
      if (this.lastImConnectUid || active) {
        try {
          sdk.disconnect();
        } catch {
          // ignore
        }
      }
      this.wsaddrs = [];
      this.addrUsed = false;
      this.lastImConnectUid = uid;
      this.lastImConnectToken = token;
    }

    sdk.config.uid = uid;
    sdk.config.token = token;
    sdk.connect();
    // 建连过程中先起定时器；真正 Connected 时 connect 监听会再次 schedule 并刷新 imLastPongAt
    this.scheduleImStaleProbe();
  }

  registerModule(module: IModule) {
    ModuleManager.shared.register(module);
  }

  restContent(content: JSX.Element) {
    this.content = content;
    this.notifyListener();
  }



  // 是否登录
  isLogined() {
    return WKApp.loginInfo.isLogined();
  }
  // 登出
  logout() {
    try {
      WKSDK.shared().disconnect();
    } catch {
      // ignore
    }
    this.imAuthRecoveryAttempted = false;
    this.stopImStaleProbe();
    this.imLastPongAt = 0;
    this.imLastStaleRecoverAt = 0;
    this.wsaddrs = [];
    this.addrUsed = false;
    this.lastImConnectUid = "";
    this.lastImConnectToken = "";
    WKApp.loginInfo.logout();
    this.openChannel = undefined;
    try {
      const url = new URL(window.location.href);
      url.pathname = "/login";
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
    WKApp.shared.notifyListener();
  }

  avatarChannel(channel: Channel) {
    if (!channel) {
      return "";
    }
    let avatarTag = this.getChannelAvatarTag(channel);
    const channelInfo = WKSDK.shared().channelManager.getChannelInfo(channel);
    if (channelInfo && channelInfo.logo && channelInfo.logo !== "") {
      let logo = channelInfo.logo;
      if (logo.indexOf("?") != -1) {
        logo += "&v=" + avatarTag;
      } else {
        logo += "?v=" + avatarTag;
      }
      return WKApp.dataSource.commonDataSource.getImageURL(logo);
    }
    const baseURl = WKApp.apiClient.config.apiURL;
    if (channel.channelType === ChannelTypePerson) {
      return `${baseURl}users/${channel.channelID}/avatar?v=${avatarTag}`;
    } else if (channel.channelType == ChannelTypeGroup) {
      return `${baseURl}groups/${channel.channelID}/avatar?v=${avatarTag}`;
    }
    return "";
  }

  avatarUser(uid: string) {
    const c = new Channel(uid, ChannelTypePerson);
    return this.avatarChannel(c);
  }

  avatarOrg(orgID: string) {
    const baseURl = WKApp.apiClient.config.apiURL;
    return `${baseURl}organizations/${orgID}/logo`;
  }

  // 我的用户头像发送改变
  myUserAvatarChange() {
    this.changeChannelAvatarTag(new Channel(WKApp.loginInfo.uid || "", ChannelTypePerson));
  }

  changeChannelAvatarTag(channel: Channel) {
    let myAvatarTag = "channelAvatarTag";
    if (channel) {
      myAvatarTag = `channelAvatarTag:${channel.channelType}${channel.channelID}`;
    }
    const t = new Date().getTime();
    WKApp.loginInfo.setStorageItem(myAvatarTag, `${t}`);
  }
  getChannelAvatarTag(channel?: Channel) {
    let myAvatarTag = "channelAvatarTag";
    if (channel) {
      myAvatarTag = `channelAvatarTag:${channel.channelType}${channel.channelID}`;
    }
    const tag = WKApp.loginInfo.getStorageItem(myAvatarTag);
    if (!tag) {
      return "";
    }
    return tag;
  }

  avatarGroup(groupNo: string) {
    const channel = new Channel(groupNo, ChannelTypeGroup);
    return this.avatarChannel(channel);
  }

  // 注册频道设置
  channelSettingRegister(
    sectionID: string,
    sectionFnc: (context: RouteContext<any>) => Section | undefined,
    sort?: number
  ) {
    WKApp.sectionManager.register(
      EndpointCategory.channelSetting,
      sectionID,
      sectionFnc,
      sort
    );
  }

  // 获取频道设置
  channelSettings(context: RouteContext<any>): Section[] {
    return WKApp.sectionManager.sections(
      EndpointCategory.channelSetting,
      context
    );
  }

  // 注册管理设置
  channelManageRegister(
    sectionID: string,
    sectionFnc: (context: RouteContext<any>) => Section | undefined
  ) {
    WKApp.sectionManager.register(
      EndpointCategory.channelManage,
      sectionID,
      sectionFnc
    );
  }

  // 获取频道管理
  channelManages(context: RouteContext<any>): Section[] {
    return WKApp.sectionManager.sections(
      EndpointCategory.channelManage,
      context
    );
  }

  chatMenusRegister(sid: string, f: (param: any) => ChatMenus, sort?: number) {
    WKApp.endpointManager.setMethod(
      sid,
      (param) => {
        return f(param);
      },
      {
        category: EndpointCategory.chatMenusPopover,
        sort: sort,
      }
    );
  }
  chatMenus(param?: any): ChatMenus[] {
    return WKApp.endpointManager.invokes<ChatMenus>(
      EndpointCategory.chatMenusPopover,
      param
    );
  }

  sectionAddRow(sectionID: string, row: Row, context: RouteContext<any>) {
    const section = WKApp.sectionManager.section(sectionID, context);
    if (section) {
      if (!section.rows) {
        section.rows = [];
      }
      section.rows.push(row);
    }
  }

  // 注册用户信息
  userInfoRegister(
    sectionID: string,
    sectionFnc: (context: RouteContext<any>) => Section | undefined,
    sort?: number
  ) {
    WKApp.sectionManager.register(
      EndpointCategory.userInfo,
      sectionID,
      sectionFnc
    );
  }

  // 获取用户信息
  userInfos(context: RouteContext<any>): Section[] {
    return WKApp.sectionManager.sections(EndpointCategory.userInfo, context);
  }

  private getFriendApplysKey() {
    return `${WKApp.loginInfo.uid}friendApplys`;
  }

  public getFriendApplys(): Array<FriendApply> {
    var friendApplys = new Array<FriendApply>();
    const value = WKApp.loginInfo.getStorageItem(this.getFriendApplysKey());
    if (!value || value === "") {
      return friendApplys;
    }
    const friendApplyObjs = JSON.parse(value);

    if (friendApplyObjs && friendApplyObjs.length > 0) {
      for (const friendApplyObj of friendApplyObjs) {
        const f = new FriendApply();
        f.uid = friendApplyObj.uid;
        f.to_name = friendApplyObj.to_name;
        f.remark = friendApplyObj.remark;
        f.status = friendApplyObj.status;
        f.token = friendApplyObj.token;
        f.unread = friendApplyObj.unread;
        f.createdAt = friendApplyObj.createdAt;
        friendApplys.push(f);
      }
    }
    friendApplys.sort((a, b) => {
      return b.createdAt - a.createdAt;
    });
    return friendApplys;
  }

  public setFriendApplysUnreadCount() {
    if (WKApp.loginInfo.isLogined()) {
      WKApp.apiClient.get(`/user/reddot/friendApply`).then(res => {
        WKApp.mittBus.emit('friend-applys-unread-count', res.count)
        WKApp.loginInfo.setStorageItem(`${WKApp.loginInfo.uid}-friend-applys-unread-count`, res.count);
        WKApp.menus.refresh();
      })
    }
  }

  public getFriendApplysUnreadCount() {
    // const friendApplys = this.getFriendApplys();
    let unreadCount = 0;
    // if (friendApplys && friendApplys.length > 0) {
    //   for (const friendApply of friendApplys) {
    //     if (friendApply.unread) {
    //       unreadCount++;
    //     }
    //   }
    // }
    if (WKApp.loginInfo.isLogined()) {
      const num = WKApp.loginInfo.getStorageItem(`${WKApp.loginInfo.uid}-friend-applys-unread-count`)
      unreadCount = Number(num);
    }
    return unreadCount;
  }

  public async friendApplyMarkAllReaded(): Promise<void> {
    // let friendApplys = this.getFriendApplys();
    // if (!friendApplys) {
    //   friendApplys = new Array<FriendApply>();
    // }
    // var change = false;
    // for (const friendApply of friendApplys) {
    //   if (friendApply.unread) {
    //     friendApply.unread = false;
    //     change = true;
    //   }
    // }
    // if (change) {
    //   WKApp.loginInfo.setStorageItem(
    //     this.getFriendApplysKey(),
    //     JSON.stringify(friendApplys)
    //   );
    //   WKApp.endpointManager.invokes(EndpointCategory.friendApplyDataChange);
    // }
    if (WKApp.loginInfo.isLogined()) {
      WKApp.loginInfo.setStorageItem(`${WKApp.loginInfo.uid}-friend-applys-unread-count`, '0')
    }
    await WKApp.apiClient.delete(`/user/reddot/friendApply`);
  }

  public addFriendApply(friendApply: FriendApply) {
    let friendApplys = this.getFriendApplys();
    if (!friendApplys) {
      friendApplys = new Array<FriendApply>();
    }

    var exist = false;
    for (let index = 0; index < friendApplys.length; index++) {
      const friendAy = friendApplys[index];
      if (friendAy.uid === friendApply.uid) {
        friendApplys[index] = friendApply;
        exist = true;
        break;
      }
    }
    if (!exist) {
      friendApplys.push(friendApply);
    }
    WKApp.loginInfo.setStorageItem(
      this.getFriendApplysKey(),
      JSON.stringify(friendApplys)
    );
    WKApp.endpointManager.invokes(EndpointCategory.friendApplyDataChange);
  }

  public updateFriendApply(friendApply: FriendApply) {
    let friendApplys = this.getFriendApplys();
    if (!friendApplys) {
      friendApplys = new Array<FriendApply>();
    }
    var exist = false;
    for (let index = 0; index < friendApplys.length; index++) {
      const friendAy = friendApplys[index];
      if (friendAy.uid === friendApply.uid) {
        friendApplys[index] = friendApply;
        exist = true;
        break;
      }
    }
    if (exist) {
      WKApp.loginInfo.setStorageItem(
        this.getFriendApplysKey(),
        JSON.stringify(friendApplys)
      );
    }
  }

  public addMessageDeleteListener(listener: MessageDeleteListener) {
    this.messageDeleteListeners.push(listener);
  }
  public removeMessageDeleteListener(listener: MessageDeleteListener) {
    const len = this.messageDeleteListeners.length;
    for (let i = 0; i < len; i++) {
      if (listener === this.messageDeleteListeners[i]) {
        this.messageDeleteListeners.splice(i, 1);
        return;
      }
    }
  }
  public notifyMessageDeleteListener(message: Message, preMessage?: Message) {
    const len = this.messageDeleteListeners.length;
    for (let i = 0; i < len; i++) {
      this.messageDeleteListeners[i](message, preMessage);
    }
  }
}

export enum FriendApplyState {
  apply,
  accepted,
}
// 好友申请
export class FriendApply {
  uid!: string;
  to_uid!: string;
  to_name!: string;
  remark?: string;
  token?: string;
  status!: FriendApplyState;
  unread: boolean = false; // 是否未读
  createdAt!: number; // 创建时间
}

export class ChatMenus {
  icon!: string;
  title!: string;
  sort?: number = 0;
  onClick?: () => void;
}
