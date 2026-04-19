import { contextBridge, ipcRenderer } from "electron";

/** 渲染进程 → 主进程 send，仅放行白名单（防 XSS 后任意 IPC） */
const IPC_SEND_ALLOW = new Set([
  "screenshots-start",
  "update-app",
  "install-update",
  "conversation-anager-unread-count",  // 历史拼写，保留兼容
  "conversation-manager-unread-count", // 正确拼写（新）
  "check-update",
  "set-window-title",
  "set-profile-name",
  "open-window-same-account",
  "open-window-new-account",
  "restart-app",
]);

/** invoke 白名单 */
const IPC_INVOKE_ALLOW = new Set([
  "show-native-notification",
  "close-native-notification",
  "close-all-native-notifications",
  "test-notification-icon",
  "get-profile-info",
]);

/** 主进程 → 渲染进程 on/once 订阅白名单 */
const IPC_ON_ALLOW = new Set([
  "update-error",
  "update-available",
  "update-not-available",
  "download-progress",
  "update-downloaded",
  "notification-clicked",
  "notification-action-clicked",
  "show-conversations",
  "deep-link",
  "screenshots-ok",
]);

contextBridge.exposeInMainWorld("__POWERED_ELECTRON__", true);

contextBridge.exposeInMainWorld("ipc", {
  send: (channel: string, ...args: any[]) => {
    if (!IPC_SEND_ALLOW.has(channel)) {
      console.warn("[preload] blocked ipc.send:", channel);
      return;
    }
    ipcRenderer.send(channel, ...args);
  },
  invoke: (channel: string, ...args: any[]): Promise<any> => {
    if (!IPC_INVOKE_ALLOW.has(channel)) {
      console.warn("[preload] blocked ipc.invoke:", channel);
      return Promise.reject(new Error(`IPC invoke not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (
    channel: string,
    listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void
  ) => {
    if (!IPC_ON_ALLOW.has(channel)) {
      console.warn("[preload] blocked ipc.on:", channel);
      return;
    }
    ipcRenderer.on(channel, listener);
  },
  once: (
    channel: string,
    listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void
  ) => {
    if (!IPC_ON_ALLOW.has(channel)) {
      console.warn("[preload] blocked ipc.once:", channel);
      return;
    }
    ipcRenderer.once(channel, listener);
  },
});

// Expose native notification API
contextBridge.exposeInMainWorld("electronNotification", {
  show: (options: any) => ipcRenderer.invoke('show-native-notification', options),
  close: (tag: string) => ipcRenderer.invoke('close-native-notification', tag),
  closeAll: () => ipcRenderer.invoke('close-all-native-notifications'),
  onClicked: (callback: (data: any) => void) => {
    console.log("onClicked");
    ipcRenderer.on('notification-clicked', (event, data) => callback(data));
  },
  onActionClicked: (callback: (data: any) => void) => {
    ipcRenderer.on('notification-action-clicked', (event, data) => callback(data));
  },
  // Test notification icon
  testNotificationIcon: () => ipcRenderer.invoke('test-notification-icon'),
});
