import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import logger from "electron-log";
import path from "path";
import TSDD_FONFIG from "./confing";

const feedUrl = `${TSDD_FONFIG.updataUrl}v1/common/pcupdater/`;

let updateIpcRegistered = false;
let autoUpdaterHooksAttached = false;

const sendUpdateMessage = (opt: { cmd: string; data: any }) => {
  BrowserWindow.getAllWindows().forEach((w) => {
    try {
      if (!w.isDestroyed()) w.webContents.send(opt.cmd, opt.data);
    } catch (_) {
      /* ignore */
    }
  });
};

function registerUpdateIpcOnce() {
  if (updateIpcRegistered) return;
  updateIpcRegistered = true;

  ipcMain.on("check-update", () => {
    logger.info("开始检查更新");
    autoUpdater.checkForUpdates();
  });

  ipcMain.on("update-app", () => {
    autoUpdater.downloadUpdate();
  });

  ipcMain.on("install-update", () => {
    autoUpdater.quitAndInstall();
  });
}

function checkUpdate(_win: BrowserWindow) {
  autoUpdater.logger = logger;
  autoUpdater.disableWebInstaller = false;
  if (!app.isPackaged) {
    Object.defineProperty(app, "isPackaged", {
      get: () => true,
    });
    autoUpdater.updateConfigPath = path.join(
      app.getAppPath(),
      "./resources/app-update.yml"
    );
  }

  autoUpdater.autoDownload = false;
  autoUpdater.setFeedURL(feedUrl);

  if (!autoUpdaterHooksAttached) {
    autoUpdaterHooksAttached = true;

    autoUpdater.on("error", (error) => {
      logger.info(error);
      sendUpdateMessage({
        cmd: "update-error",
        data: error,
      });
    });

    autoUpdater.on("update-available", (message) => {
      logger.info("检查到有更新");
      logger.info(message);
      sendUpdateMessage({
        cmd: "update-available",
        data: message,
      });
    });

    autoUpdater.on("update-not-available", (message) => {
      sendUpdateMessage({
        cmd: "update-not-available",
        data: message,
      });
    });

    autoUpdater.on("download-progress", (progress) => {
      logger.info(progress);
      const downloadPercent = parseInt(`${progress.percent}`, 10);
      sendUpdateMessage({
        cmd: "download-progress",
        data: downloadPercent,
      });
    });

    autoUpdater.on("update-downloaded", (releaseObj) => {
      logger.info("下载完毕！提示安装更新");
      sendUpdateMessage({
        cmd: "update-downloaded",
        data: releaseObj,
      });
    });
  }

  registerUpdateIpcOnce();
}

export default checkUpdate;
