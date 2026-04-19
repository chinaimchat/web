import fs from "fs";
import path from "path";
import { app, nativeImage, NativeImage, screen } from "electron";

export default path.join(app.getAppPath(), "./resources/logo.png");

export function getNoMessageTrayIcon() {
  if (process.platform === "darwin") {
    return path.join(app.getAppPath(), "./resources/tray/macTrayTemplate.png");
  }
  if (process.platform === "win32") {
    return path.join(app.getAppPath(), "./resources/tray/128x128.png");
  }
  if (screen.getPrimaryDisplay().scaleFactor > 1) {
    return path.join(app.getAppPath(), "./resources/tray/128x128.png");
  }
  return path.join(app.getAppPath(), "./resources/tray/128x128.png");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Windows 托盘：在右下角叠未读角标（SVG 栅格化，无额外原生依赖）。
 * 未读为 0 时返回与磁盘图标一致的 NativeImage。
 */
export function buildWindowsTrayImageWithUnreadBadge(
  totalUnread: number
): NativeImage {
  const iconPath = getNoMessageTrayIcon();
  if (process.platform !== "win32") {
    return nativeImage.createFromPath(iconPath);
  }
  if (totalUnread <= 0) {
    return nativeImage.createFromPath(iconPath);
  }

  let pngB64: string;
  try {
    pngB64 = fs.readFileSync(iconPath).toString("base64");
  } catch {
    return nativeImage.createFromPath(iconPath);
  }

  const label = totalUnread > 99 ? "99+" : String(totalUnread);
  const fontSize = label.length >= 3 ? 9 : label.length === 2 ? 11 : 13;
  const W = 128;
  const H = 128;
  const cx = 100;
  const cy = 28;
  const r = 22;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <image xlink:href="data:image/png;base64,${pngB64}" href="data:image/png;base64,${pngB64}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#E53935" stroke="#ffffff" stroke-width="3"/>
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="700">${escapeXml(
    label
  )}</text>
</svg>`;

  const dataUrl =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  try {
    const img = nativeImage.createFromDataURL(dataUrl);
    if (img.isEmpty()) {
      return nativeImage.createFromPath(iconPath);
    }
    return img;
  } catch {
    return nativeImage.createFromPath(iconPath);
  }
}
