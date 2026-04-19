import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  nativeImage as NativeImage,
  systemPreferences,
  Menu,
  Tray,
  dialog,
  session,
  shell,
} from "electron";
import fs from "fs";
import tmp from "tmp";
import Screenshots from "electron-screenshots";
import { join } from "path";

import logo, {
  buildWindowsTrayImageWithUnreadBadge,
  getNoMessageTrayIcon,
} from "./logo";
import TSDD_FONFIG from "./confing";
import checkUpdate from "./update";
import { electronNotificationManager } from "./notification";
import { getRandomSid } from "./utils/search";
import {
  cleanOrphanPartitions,
  createProfile,
  deleteProfile,
  getOrCreateDefaultProfile,
  getProfileById,
  listProfiles,
  renameProfile,
  touchProfile,
  Profile,
} from "./profileStore";
import {
  APP_ORIGIN,
  ensureAppProtocolForSession,
  registerAppProtocolHandler,
  registerAppSchemeAsPrivileged,
} from "./appProtocol";

// ============================================================================
// 全局状态
// ============================================================================

let forceQuit = false;
let mainWindow: BrowserWindow | null = null;
let isMainWindowFocusedWhenStartScreenshot = false;
let screenshots: any;
/** ipcMain 监听器只挂一次，避免 macOS activate 等路径重复 createMainWindow 时重复注册 */
let ipcMainHandlersRegistered = false;
let tray: any;
let trayIcon: any;
let settings: any = {};
let screenShotWindowId = 0;
let isFullScreen = false;

const isOsx = process.platform === "darwin";
const isWin = !isOsx;
const isDevelopment = process.env.NODE_ENV !== "production";

/** 每扇窗口绑定的 profileId（按 webContents.id 索引） */
const profileIdByWebContentsId = new Map<number, string>();
/** 各渲染进程上报的会话未读（按 webContents.id 索引） */
const trayUnreadByWebContentsId = new Map<number, number>();

// ============================================================================
// 入口解析：app:// 离线优先；remoteWebEntryUrl 非空则走远端
// ============================================================================

type WebEntry =
  | { kind: "url"; href: string }
  | { kind: "app"; href: string };

function resolveProductionWebEntry(sid: string): WebEntry {
  const raw = String(TSDD_FONFIG.remoteWebEntryUrl || "").trim();
  if (raw) {
    try {
      const u = new URL(raw);
      u.searchParams.set("sid", sid);
      return { kind: "url", href: u.toString() };
    } catch (e) {
      console.error("[Electron] remoteWebEntryUrl 非法，回退 app:// 离线包:", e);
    }
  }
  // 用自定义 app:// 协议取代 file://，行为更稳定
  const href = `${APP_ORIGIN}/index.html?sid=${encodeURIComponent(sid)}`;
  return { kind: "app", href };
}

// ============================================================================
// 窗口辅助函数
// ============================================================================

function getTargetBrowserWindow(): BrowserWindow | null {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  const wins = BrowserWindow.getAllWindows();
  for (let i = wins.length - 1; i >= 0; i--) {
    if (!wins[i].isDestroyed()) return wins[i];
  }
  return null;
}

function getFocusedProfileId(): string | null {
  const win = BrowserWindow.getFocusedWindow();
  if (!win || win.isDestroyed()) return null;
  return profileIdByWebContentsId.get(win.webContents.id) || null;
}

function wireWindowForNotifications(win: BrowserWindow): void {
  win.on("focus", () => {
    electronNotificationManager.setMainWindow(win);
  });
}

function makeWindowTitle(profile: Profile): string {
  return `${TSDD_FONFIG.name} - ${profile.name}`;
}

// ============================================================================
// 窗口构造
// ============================================================================

const getWindowConfig = (sessionPartition: string) => {
  return {
    width: 1200,
    height: 800,
    // 完全放开窗口最小尺寸：用户可以把窗口拖到 360x480（典型手机宽度），
    // 此时前端 CSS 会自动切到「单栏移动端模式」（@media max-width: 640px），
    // 只显示会话列表 / 聊天面板其中一栏，便于把窗口靠在屏幕一边当通知栏用。
    // 与浏览器 Web 端的窄屏行为完全对齐。
    minWidth: 360,
    minHeight: 480,
    show: false,
    // 显式声明：窗口必须是带系统边框、可缩放、可最大/最小化、可全屏化的常规窗口。
    // 之前 `hasShadow: false` 在 Windows + DWM 下会让系统边框的 1~2px 缩放热区
    // 失去阴影提示，部分用户反馈"拖不动边角"，去掉这个标志后系统帧表现回到默认。
    frame: true,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    fullscreenable: true,
    movable: true,
    // Windows: 允许用户按 Alt 键显示/隐藏菜单栏
    autoHideMenuBar: isWin,
    icon: logo,
    webPreferences: {
      preload: join(__dirname, "..", "preload/index"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: sessionPartition,
    },
  };
};

interface OpenWindowOptions {
  /** 指定现有 profile；缺省则用最近使用的那一个 */
  profileId?: string;
  /** true = 强制新建一个 profile（"登录另一个账号"） */
  newProfile?: boolean;
  /** 新 profile 名字，仅在 newProfile=true 时有效 */
  newProfileName?: string;
}

function pickProfile(opts: OpenWindowOptions): Profile {
  if (opts.newProfile) {
    const baseName = (opts.newProfileName || "").trim() || nextProfileName();
    return createProfile(baseName);
  }
  if (opts.profileId) {
    const p = getProfileById(opts.profileId);
    if (p) return p;
  }
  return getOrCreateDefaultProfile();
}

function nextProfileName(): string {
  const existing = listProfiles();
  // 找一个不重名的 "账号 N"
  for (let i = 1; i <= 999; i++) {
    const candidate = `账号 ${i}`;
    if (!existing.some((p) => p.name === candidate)) return candidate;
  }
  return `账号 ${Date.now()}`;
}

function loadEntryInto(win: BrowserWindow): void {
  const NODE_ENV = process.env.NODE_ENV;
  const sid = getRandomSid();
  if (NODE_ENV === "development") {
    win.loadURL("http://localhost:3000?sid=" + sid);
    return;
  }
  const entry = resolveProductionWebEntry(sid);
  // 生产包：app:// 与远端 url 都用 loadURL；file:// 分支已移除
  win.loadURL(entry.href);
}

function spawnWindow(opts: OpenWindowOptions = {}): BrowserWindow {
  const profile = pickProfile(opts);
  touchProfile(profile.id);

  // ⚠ 关键：窗口用 partition session，必须先把 app:// handler 挂到这个 session 上，
  //       否则 loadURL('app://local/...') 会被当"未知协议"吐给 OS shell。
  ensureAppProtocolForSession(session.fromPartition(profile.partition));

  const win = new BrowserWindow(getWindowConfig(profile.partition));
  const wcId = win.webContents.id;
  profileIdByWebContentsId.set(wcId, profile.id);
  win.setTitle(makeWindowTitle(profile));

  wireWindowForNotifications(win);
  attachTrayUnreadCleanup(win);

  win.center();
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });

  // 通用链接（target=_blank / window.open）用系统浏览器打开，避免 XSS 跳进 Electron 壳
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      if (u.protocol === "http:" || u.protocol === "https:") {
        shell.openExternal(url);
      }
    } catch (_) {
      /* ignore */
    }
    return { action: "deny" };
  });

  loadEntryInto(win);

  // 非 macOS 给新窗口也挂一份菜单（Windows 下窗口菜单条需要）
  if (!isOsx) {
    const menu = Menu.buildFromTemplate(buildMainMenuTemplate());
    win.setMenu(menu);
  }

  win.on("closed", () => {
    profileIdByWebContentsId.delete(wcId);
  });

  return win;
}

// ============================================================================
// 主菜单
// ============================================================================

function buildMainMenuTemplate(): Electron.MenuItemConstructorOptions[] {
  return [
    {
      label: TSDD_FONFIG.name,
      submenu: [
        { label: `关于 ${TSDD_FONFIG.name}`, role: "about" },
        { label: "服务", role: "services" },
        { type: "separator" },
        {
          label: "退出",
          accelerator: "Command+Q",
          click() {
            forceQuit = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "pasteAndMatchStyle", label: "粘贴并匹配样式" },
        { role: "delete", label: "删除" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "显示",
      submenu: [
        {
          label: isFullScreen ? "全屏" : "退出全屏",
          accelerator: "Shift+Cmd+F",
          click() {
            isFullScreen = !isFullScreen;
            const w = getTargetBrowserWindow();
            if (!w) return;
            w.show();
            w.setFullScreen(isFullScreen);
          },
        },
        {
          label: "切换会话",
          accelerator: "Shift+Cmd+M",
          click() {
            const w = getTargetBrowserWindow();
            if (!w) return;
            w.show();
            w.webContents.send("show-conversations");
          },
        },
        { type: "separator" },
        { role: "toggleDevTools", label: "切换开发者工具" },
        { role: "togglefullscreen", label: "切换全屏" },
      ],
    },
    {
      label: "窗口",
      role: "window",
      submenu: [
        {
          label: "新建窗口（同账号）",
          accelerator: "Command+N",
          click() {
            const pid = getFocusedProfileId();
            spawnWindow(pid ? { profileId: pid } : {});
          },
        },
        {
          label: "新建窗口（另一个账号）…",
          accelerator: "Shift+Command+N",
          click() {
            spawnWindow({ newProfile: true });
          },
        },
        { type: "separator" },
        buildAccountsSubmenu(),
        { type: "separator" },
        { label: "最小化", role: "minimize" },
        { label: "关闭窗口", role: "close" },
      ],
    },
    {
      label: "帮助",
      role: "help",
      submenu: [
        { role: "reload", label: "刷新" },
        { role: "forceReload", label: "强制刷新" },
      ],
    },
  ];
}

function buildAccountsSubmenu(): Electron.MenuItemConstructorOptions {
  const items: Electron.MenuItemConstructorOptions[] = listProfiles().map(
    (p) => ({
      label: `${p.name}`,
      click: () => {
        spawnWindow({ profileId: p.id });
      },
    })
  );
  if (items.length === 0) {
    items.push({ label: "（暂无账号）", enabled: false });
  }
  items.push({ type: "separator" });
  items.push({
    label: "重命名当前账号…",
    click: async () => {
      await promptRenameCurrentProfile();
    },
  });
  items.push({
    label: "删除账号…",
    click: async () => {
      await promptDeleteProfile();
    },
  });
  return { label: "账号管理", submenu: items };
}

async function promptRenameCurrentProfile(): Promise<void> {
  const pid = getFocusedProfileId();
  if (!pid) return;
  const p = getProfileById(pid);
  if (!p) return;
  const res = await dialog.showMessageBox({
    type: "question",
    title: "重命名账号",
    message: `请在下一次登录后，通过 "设置 - 账号名称" 修改。当前账号：${p.name}`,
    detail:
      "提示：原生对话框不支持输入框。请在聊天主界面里让 Web 端调用 set-profile-name，或在此处快速追加一个序号。",
    buttons: ["取消", "追加当前时间作为后缀"],
    defaultId: 0,
    cancelId: 0,
  });
  if (res.response === 1) {
    const ts = new Date();
    const suffix = `#${ts.getHours()}${String(ts.getMinutes()).padStart(2, "0")}`;
    renameProfile(pid, `${p.name}${suffix}`);
    applyProfileToAllWindows(pid);
    rebuildMenusAndTray();
  }
}

async function promptDeleteProfile(): Promise<void> {
  const profiles = listProfiles();
  if (profiles.length === 0) return;
  const res = await dialog.showMessageBox({
    type: "warning",
    title: "删除账号",
    message: "选择要删除的账号（会连同该账号的本地数据一并清除）",
    buttons: ["取消", ...profiles.map((p) => p.name)],
    defaultId: 0,
    cancelId: 0,
  });
  if (res.response <= 0) return;
  const target = profiles[res.response - 1];
  // 先关闭该账号下所有窗口（否则分区在用，删不干净）
  BrowserWindow.getAllWindows().forEach((w) => {
    if (w.isDestroyed()) return;
    const pid = profileIdByWebContentsId.get(w.webContents.id);
    if (pid === target.id) {
      try {
        w.destroy();
      } catch (_) {
        /* ignore */
      }
    }
  });
  deleteProfile(target.id);
  rebuildMenusAndTray();
}

function applyProfileToAllWindows(profileId: string): void {
  const p = getProfileById(profileId);
  if (!p) return;
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    if (profileIdByWebContentsId.get(win.webContents.id) === profileId) {
      win.setTitle(makeWindowTitle(p));
    }
  }
}

function rebuildMenusAndTray(): void {
  createMenu();
  updateTray(false);
}

// ============================================================================
// 托盘
// ============================================================================

function shortTrayLabel(s: string, max = 26): string {
  const t = (s || "").trim() || "无标题";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

interface TrayRow {
  id: number;
  title: string;
  profileName: string;
  count: number;
  win: BrowserWindow;
}

function summarizeTrayUnread(): { total: number; rows: TrayRow[] } {
  const rows: TrayRow[] = [];
  const alive = new Set<number>();
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    const id = win.webContents.id;
    alive.add(id);
    const count = trayUnreadByWebContentsId.get(id) ?? 0;
    const pid = profileIdByWebContentsId.get(id);
    const profile = pid ? getProfileById(pid) : undefined;
    rows.push({
      id,
      title: win.getTitle(),
      profileName: profile?.name || "默认",
      count,
      win,
    });
  }
  // 回收死掉的计数
  Array.from(trayUnreadByWebContentsId.keys()).forEach((id) => {
    if (!alive.has(id)) trayUnreadByWebContentsId.delete(id);
  });
  const total = rows.reduce((s, r) => s + r.count, 0);
  return { total, rows };
}

function buildTrayContextMenu(): Menu {
  const { total, rows } = summarizeTrayUnread();
  const trayMenuTop: Electron.MenuItemConstructorOptions[] = [
    {
      label: "显示/隐藏全部窗口",
      click() {
        const wins = BrowserWindow.getAllWindows().filter(
          (w) => !w.isDestroyed()
        );
        if (wins.length === 0) return;
        const anyVisible = wins.some((w) => w.isVisible());
        wins.forEach((w) => (anyVisible ? w.hide() : w.show()));
        if (!anyVisible && wins.length) {
          wins[wins.length - 1].focus();
        }
      },
    },
    {
      label: "新建窗口（同账号）",
      click() {
        const pid = getFocusedProfileId();
        spawnWindow(pid ? { profileId: pid } : {});
      },
    },
    {
      label: "新建窗口（另一个账号）",
      click() {
        spawnWindow({ newProfile: true });
      },
    },
    { type: "separator" },
  ];

  const unreadBlock: Electron.MenuItemConstructorOptions[] = [
    { label: `未读合计：${total}`, enabled: false },
    ...rows.map((r) => ({
      label: `  ${shortTrayLabel(r.profileName)} · ${r.count}`,
      click: () => {
        if (!r.win.isDestroyed()) {
          r.win.show();
          r.win.focus();
        }
      },
    })),
  ];

  const trayMenuBottom: Electron.MenuItemConstructorOptions[] = [
    { type: "separator" },
    {
      label: "退出",
      accelerator: "Command+Q",
      click() {
        forceQuit = true;
        app.quit();
      },
    },
  ];

  return Menu.buildFromTemplate([
    ...trayMenuTop,
    ...unreadBlock,
    ...trayMenuBottom,
  ]);
}

function attachTrayUnreadCleanup(win: BrowserWindow): void {
  const wcId = win.webContents.id;
  win.on("closed", () => {
    trayUnreadByWebContentsId.delete(wcId);
    updateTray(false);
  });
}

/**
 * 托盘：按窗口汇总未读、刷新菜单/气泡提示；任务栏闪烁
 */
function updateTray(isFlash = false): void {
  settings.showOnTray = true;
  if (process.platform === "linux") {
    return;
  }

  const { total, rows } = summarizeTrayUnread();
  const isWin32 = process.platform === "win32";
  const winTrayNormalImage = isWin32
    ? buildWindowsTrayImageWithUnreadBadge(total)
    : null;

  if (!trayIcon) {
    trayIcon = getNoMessageTrayIcon();
  }

  setTimeout(() => {
    if (!tray) {
      tray = new Tray(isWin32 ? winTrayNormalImage! : trayIcon);
      if (process.platform === "linux") {
        tray.setContextMenu(buildTrayContextMenu());
      }

      tray.on("right-click", () => {
        tray.popUpContextMenu(buildTrayContextMenu());
      });

      tray.on("click", () => {
        const wins = BrowserWindow.getAllWindows().filter(
          (w) => !w.isDestroyed()
        );
        wins.forEach((w) => w.show());
        if (wins.length) wins[wins.length - 1].focus();
      });
    }

    const menu = buildTrayContextMenu();
    if (process.platform === "linux") {
      tray.setContextMenu(menu);
    }

    if (isOsx) {
      tray.setTitle(total > 0 ? ` ${total}` : "");
    } else if (tray && !isOsx) {
      const tipLines = [
        TSDD_FONFIG.name,
        `未读合计：${total}`,
        ...rows.map((r) => `${shortTrayLabel(r.profileName)}: ${r.count}`),
      ];
      try {
        tray.setToolTip(tipLines.join("\n"));
      } catch (_) {
        /* ignore */
      }
    }

    BrowserWindow.getAllWindows().forEach((w) => {
      try {
        w.flashFrame(isFlash);
      } catch (_) {
        /* ignore */
      }
    });

    // 旧版本对 Windows 托盘做了 empty-image 闪烁，反而经常闪成透明块；
    // 这里改为只刷新静态图标，闪烁交给 flashFrame 完成。
    tray.setImage(
      isWin32 && winTrayNormalImage ? winTrayNormalImage : (trayIcon as string)
    );
  });
}

function createMenu() {
  const menu = Menu.buildFromTemplate(buildMainMenuTemplate());
  Menu.setApplicationMenu(menu);
  if (!isOsx && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setMenu(menu);
  }
}

function regShortcut() {
  globalShortcut.register("CommandOrControl+shift+a", () => {
    const w = getTargetBrowserWindow();
    isMainWindowFocusedWhenStartScreenshot = !!(w && w.isFocused());
    screenshots.startCapture();
  });

  globalShortcut.register("ctrl+shift+i", () => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win: any) => win.openDevTools());
  });
}

// ============================================================================
// 主窗创建 / 二次启动
// ============================================================================

async function createMainWindow(): Promise<void> {
  const win = spawnWindow(); // 用默认（最近）profile
  mainWindow = win;

  win.on("close", (e: any) => {
    if (forceQuit || !tray) {
      mainWindow = null;
    } else {
      e.preventDefault();
      if (win.isFullScreen()) {
        win.setFullScreen(false);
        win.once("leave-full-screen", () => win.hide());
      } else {
        win.hide();
      }
    }
  });

  createMenu();

  electronNotificationManager.setMainWindow(win);
  if (isDevelopment) {
    electronNotificationManager.testIconLoading();
  }
  checkUpdate(win);
}

// ============================================================================
// 重启 / 深链
// ============================================================================

function restartApp() {
  app.relaunch();
  app.exit(0); // relaunch 后这里必须 exit，不走 quit 流程
}

function onDeepLink(url: string) {
  const w = getTargetBrowserWindow();
  if (w) w.webContents.send("deep-link", url);
}

// ============================================================================
// IPC 注册
// ============================================================================

function registerMainProcessIpcOnce() {
  if (ipcMainHandlersRegistered) return;
  ipcMainHandlersRegistered = true;

  ipcMain.on("screenshots-start", (event) => {
    screenShotWindowId = event.sender.id;
    screenshots.startCapture();
  });

  ipcMain.on(
    "get-media-access-status",
    async (_event, mediaType: "camera" | "microphone") => {
      const getMediaAccessStatus =
        systemPreferences.getMediaAccessStatus(mediaType);
      if (getMediaAccessStatus !== "granted") {
        if (mediaType === "camera" || mediaType === "microphone") {
          await systemPreferences.askForMediaAccess(mediaType);
          return systemPreferences.getMediaAccessStatus(mediaType);
        }
      }
      return getMediaAccessStatus;
    }
  );

  // 未读数上报：保留原先的历史拼写 "conversation-anager-unread-count"，
  // 同时新增正确拼写的 "conversation-manager-unread-count" 作为过渡别名
  const onUnread = (wcId: number, num: any) => {
    trayUnreadByWebContentsId.set(wcId, Math.max(0, Number(num) || 0));
    updateTray(false);
  };
  ipcMain.on("conversation-anager-unread-count", (event, num) =>
    onUnread(event.sender.id, num)
  );
  ipcMain.on("conversation-manager-unread-count", (event, num) =>
    onUnread(event.sender.id, num)
  );

  ipcMain.on("restart-app", () => {
    restartApp();
  });

  // 让渲染进程调用一次就能把窗口标题刷成"app 名 · 账号名"
  ipcMain.on("set-window-title", (event, extra?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    const pid = profileIdByWebContentsId.get(win.webContents.id);
    const p = pid ? getProfileById(pid) : undefined;
    const base = p ? makeWindowTitle(p) : TSDD_FONFIG.name;
    win.setTitle(extra ? `${base} · ${extra}` : base);
  });

  // 让登录成功的 Web 端把昵称写回到 profile.name
  ipcMain.on("set-profile-name", (event, name: string) => {
    const pid = profileIdByWebContentsId.get(event.sender.id);
    if (!pid) return;
    renameProfile(pid, name);
    applyProfileToAllWindows(pid);
    rebuildMenusAndTray();
  });

  ipcMain.handle("get-profile-info", (event) => {
    const pid = profileIdByWebContentsId.get(event.sender.id);
    if (!pid) return null;
    const p = getProfileById(pid);
    if (!p) return null;
    return { id: p.id, name: p.name };
  });

  ipcMain.on("open-window-same-account", (event) => {
    const pid = profileIdByWebContentsId.get(event.sender.id);
    spawnWindow(pid ? { profileId: pid } : {});
  });

  ipcMain.on("open-window-new-account", () => {
    spawnWindow({ newProfile: true });
  });

  ipcMain.handle("test-notification-icon", () => {
    electronNotificationManager.testIconLoading();
    electronNotificationManager.showNotification({
      title: "Icon Test",
      body: "Testing notification icon display",
      tag: "icon-test",
      urgency: "normal",
      timeoutType: "default",
    });
    return true;
  });
}

// ============================================================================
// 生命周期
// ============================================================================

app.setName(TSDD_FONFIG.name);

// 必须在 ready 之前注册自定义 scheme
registerAppSchemeAsPrivileged();

app.on("open-url", (_event, url) => {
  onDeepLink(url);
});

// 单例：第二个进程直接退出，由首个进程 second-instance 新开窗口
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // 默认策略：二次启动用最近使用的那个 profile（不是每次新建，避免产生脏分区）
    spawnWindow();
  });
}

app.on("ready", () => {
  // app.on('ready') 之后才能 protocol.handle
  registerAppProtocolHandler();

  // 启动时顺手清理一次孤儿分区（旧版 makeSessionPartition 每次随机产生的垃圾）
  try {
    cleanOrphanPartitions();
  } catch (e) {
    console.warn("cleanOrphanPartitions failed:", e);
  }

  regShortcut();

  if (isWin) {
    // Windows 任务栏分组 ID：允许按环境变量切出"多身份"的 AUMID，
    // 不配置时所有窗口仍然共用一个图标分组（原行为）
    const aumid = process.env.TSDD_AUMID || TSDD_FONFIG.name;
    app.setAppUserModelId(aumid);
  }

  // 渲染进程请求媒体权限（屏幕录制等）时直接授权，避免 app:// 场景下弹不出原生对话框
  try {
    session.defaultSession.setPermissionRequestHandler(
      (_wc, permission, callback) => {
        const allow = new Set([
          "media",
          "clipboard-read",
          "clipboard-sanitized-write",
          "notifications",
          "pointerLock",
          "fullscreen",
        ]);
        callback(allow.has(permission));
      }
    );
  } catch (_) {
    /* ignore */
  }

  screenshots = new Screenshots({ singleWindow: true });

  const onScreenShotEnd = (result?: any) => {
    if (isMainWindowFocusedWhenStartScreenshot) {
      const w = getTargetBrowserWindow();
      if (result && w) {
        w.webContents.send("screenshots-ok", result);
      }
      if (w) w.show();
      isMainWindowFocusedWhenStartScreenshot = false;
    } else if (screenShotWindowId) {
      const windows = BrowserWindow.getAllWindows();
      const tms = windows.filter((w) => w.webContents.id === screenShotWindowId);
      if (tms.length > 0) {
        if (result) tms[0].webContents.send("screenshots-ok", result);
        tms[0].show();
      }
      screenShotWindowId = 0;
    }
  };

  // 截图 esc 快捷键
  screenshots.on("windowCreated", ($win: any) => {
    $win.on("focus", () => {
      globalShortcut.register("esc", () => {
        if ($win?.isFocused()) screenshots.endCapture();
      });
    });
    $win.on("blur", () => {
      globalShortcut.unregister("esc");
    });
  });

  screenshots.on("ok", (_e: any, buffer: any) => {
    const filename = tmp.tmpNameSync() + ".png";
    const image = NativeImage.createFromBuffer(buffer);
    fs.writeFileSync(filename, image.toPNG());
    onScreenShotEnd({ filePath: filename });
  });
  screenshots.on("cancel", () => onScreenShotEnd());
  screenshots.on("save", () => onScreenShotEnd());

  registerMainProcessIpcOnce();
  createMainWindow();

  try {
    updateTray();
  } catch (e) {
    console.log("==updateTray==", e);
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
    return;
  }
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.show();
  });
});

app.on("before-quit", () => {
  forceQuit = true;
  if (!tray) return;
  try {
    tray.destroy();
  } catch (_) {
    /* ignore */
  }
  tray = null;
  globalShortcut.unregisterAll();
});

// 除了 macOS 外，当所有窗口都被关闭的时候退出程序。
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
