import { Message, MessageContent } from "wukongimjssdk";
import WKApp from "../App";
import { MessageContentTypeConst } from "../Service/Const";
import { ImageContent } from "../Messages/Image";
import { VideoContent } from "../Messages/Video";

function authHeaders(): Record<string, string> {
  const token = WKApp.loginInfo.token;
  return token ? { token } : {};
}

/**
 * 将同源相对路径（如 /api/v1/file/preview/...）补全为浏览器可打开的绝对 URL，便于复制到外部或 fetch。
 */
export function ensureAbsolutePublicUrl(url: string): string {
  if (!url) {
    return url;
  }
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (typeof window !== "undefined" && window.location?.origin && url.startsWith("/")) {
    return `${window.location.origin}${url}`;
  }
  return url;
}

/** 纯文本写入剪贴板（兼容无 Clipboard API） */
export function copyPlainText(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const s = text;
    document.oncopy = function (e: ClipboardEvent) {
      e.clipboardData?.setData("text/plain", s);
      e.preventDefault();
      document.oncopy = null;
    };
    try {
      document.execCommand("Copy");
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

/** 拼接与文件气泡下载一致的带 filename 的 URL */
function fileMessageDownloadUrl(message: Message): string {
  const c = message.content as { url?: string; name?: string };
  const name = c.name || "";
  let downloadURL = WKApp.dataSource.commonDataSource.getImageURL(c.url || "");
  if (downloadURL.indexOf("?") !== -1) {
    downloadURL += "&filename=" + encodeURIComponent(name);
  } else {
    downloadURL += "?filename=" + encodeURIComponent(name);
  }
  return downloadURL;
}

function asPublicShareUrl(s: string | null | undefined): string | null {
  if (s == null || s === "") {
    return null;
  }
  const v = String(s);
  if (v.startsWith("data:")) {
    return v;
  }
  return ensureAbsolutePublicUrl(v);
}

/**
 * 可分享的媒体直链（图片为预览地址；视频/语音为文件地址；文件为带 filename 的下载地址）
 */
export function getMessageMediaAbsoluteUrl(message: Message): string | null {
  const ct = message.contentType;
  const c = message.content as any;
  switch (ct) {
    case MessageContentTypeConst.image:
      if (c.imgData && String(c.imgData).startsWith("data:")) {
        return asPublicShareUrl(c.imgData);
      }
      if (!c.url) {
        return null;
      }
      return asPublicShareUrl(
        WKApp.dataSource.commonDataSource.getImageURL(c.url || "", {
          width: c.width || 0,
          height: c.height || 0,
        })
      );
    case MessageContentTypeConst.gif:
      if (!c.url) {
        return null;
      }
      return asPublicShareUrl(
        WKApp.dataSource.commonDataSource.getImageURL(c.url || "", {
          width: c.width || 0,
          height: c.height || 0,
        })
      );
    case MessageContentTypeConst.smallVideo:
      if (!c.url) {
        return null;
      }
      return asPublicShareUrl(WKApp.dataSource.commonDataSource.getFileURL(c.url || ""));
    case MessageContentTypeConst.file:
      if (!c.url && !c.remoteUrl) {
        return null;
      }
      return asPublicShareUrl(fileMessageDownloadUrl(message));
    case MessageContentTypeConst.voice:
      if (!c.url && !c.remoteUrl) {
        return null;
      }
      return asPublicShareUrl(WKApp.dataSource.commonDataSource.getFileURL(c.url || c.remoteUrl || ""));
    default:
      return null;
  }
}

/** 用于复制到剪贴板的图片请求地址（尽量原图） */
function getImageCopySourceUrl(message: Message): string | null {
  const ct = message.contentType;
  const c = message.content as any;
  if (ct === MessageContentTypeConst.image || ct === MessageContentTypeConst.gif) {
    if (c.imgData && String(c.imgData).startsWith("data:image")) {
      return String(c.imgData);
    }
    if (!c.url) {
      return null;
    }
    return WKApp.dataSource.commonDataSource.getImageURL(c.url || "", {
      width: c.width || 0,
      height: c.height || 0,
    });
  }
  return null;
}

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(),
    mode: "cors",
    credentials: "omit",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.blob();
}

/** 避免把 HTML/JSON 错误页当图片解码或发送 */
function assertBlobLooksLikeImage(blob: Blob): void {
  const t = blob.type || "";
  if (!t) {
    return;
  }
  if (t.startsWith("text/") || t.includes("json") || t === "application/xml") {
    throw new Error("预览地址返回的不是图片");
  }
}

/**
 * 将图片二进制写入剪贴板（需 HTTPS 或 localhost；失败时回退为复制链接文本）
 */
export async function copyMessageImageToClipboard(message: Message): Promise<void> {
  const raw = getImageCopySourceUrl(message);
  if (!raw) {
    throw new Error("非图片类消息");
  }
  const url = raw.startsWith("data:") ? raw : ensureAbsolutePublicUrl(raw);
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    await copyPlainText(url);
    return;
  }
  let blob: Blob;
  try {
    if (url.startsWith("data:")) {
      const r = await fetch(url);
      blob = await r.blob();
    } else {
      blob = await fetchBlob(url);
    }
  } catch {
    await copyPlainText(url);
    return;
  }
  try {
    assertBlobLooksLikeImage(blob);
  } catch {
    await copyPlainText(url);
    return;
  }
  const mime = blob.type && blob.type.startsWith("image/") ? blob.type : "image/png";
  try {
    if (mime === "image/png" || mime === "image/jpeg" || mime === "image/gif" || mime === "image/webp") {
      await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })]);
      return;
    }
  } catch {
    // 继续尝试 canvas 转 png
  }
  try {
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      await copyPlainText(url);
      return;
    }
    ctx.drawImage(bmp, 0, 0);
    const pngBlob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png")
    );
    if (pngBlob) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      return;
    }
  } catch {
    // fallthrough
  }
  await copyPlainText(url);
}

/** 将消息关联的可访问直链写入剪贴板（当前用于小视频「复制媒体」） */
export async function copyMessageMediaLink(message: Message): Promise<void> {
  const link = getMessageMediaAbsoluteUrl(message);
  if (!link) {
    throw new Error("该消息类型不支持复制链接");
  }
  await copyPlainText(link);
}

/**
 * 若输入框整段为「聊天图片预览」类 URL（相对或绝对），返回可 fetch 的绝对地址，否则 null。
 * 用于粘贴预览地址后按回车走发图逻辑（与「复制媒体」视频链路的粘贴入口一致）。
 */
export function parsePastedInternalImagePreviewText(text: string): string | null {
  const t = (text || "").trim();
  if (!t || /[\r\n]/.test(t)) {
    return null;
  }
  const lower = t.toLowerCase();
  if (!lower.includes("/file/preview/")) {
    return null;
  }
  if (!/\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(t)) {
    return null;
  }
  return ensureAbsolutePublicUrl(t);
}

/**
 * 粘贴预览地址后发图片：优先与视频一致走「服务端已有对象键」引用（不下载整图）；`data:image/...` 或解析失败时再 fetch 上传。
 * 不匹配时返回 false；fetch 失败时抛错，由上层 Toast。
 */
export async function trySendImageFromPastedPreviewUrl(
  sendMessage: (content: MessageContent) => Promise<Message>,
  text: string
): Promise<boolean> {
  const trimmed = (text || "").trim();
  const key = extractFilePreviewStorageKeyFromUrl(trimmed);
  const baseKey = key ? key.split("?")[0] : "";
  if (baseKey && /\.(jpe?g|png|gif|webp)$/i.test(baseKey)) {
    const ic = new ImageContent();
    ic.decodeJSON({ url: baseKey, width: 0, height: 0 });
    await sendMessage(ic);
    return true;
  }
  if (trimmed.startsWith("data:image/")) {
    const blob = await fetch(trimmed).then((r) => r.blob());
    assertBlobLooksLikeImage(blob);
    const mime = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
    let ext = "jpg";
    if (mime.includes("png")) {
      ext = "png";
    } else if (mime.includes("gif")) {
      ext = "gif";
    } else if (mime.includes("webp")) {
      ext = "webp";
    }
    const file = new File([blob], `image.${ext}`, { type: mime });
    let width = 0;
    let height = 0;
    try {
      const bmp = await createImageBitmap(blob);
      width = bmp.width;
      height = bmp.height;
      (bmp as any).close?.();
    } catch {
      // ignore
    }
    const previewUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("读取图片失败"));
      reader.readAsDataURL(file);
    });
    await sendMessage(new ImageContent(file, previewUrl, width, height));
    return true;
  }
  const abs = parsePastedInternalImagePreviewText(trimmed);
  if (!abs) {
    return false;
  }
  const blob = await fetchBlob(abs);
  assertBlobLooksLikeImage(blob);
  const mime = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  let ext = "jpg";
  if (mime.includes("png")) {
    ext = "png";
  } else if (mime.includes("gif")) {
    ext = "gif";
  } else if (mime.includes("webp")) {
    ext = "webp";
  }
  const file = new File([blob], `image.${ext}`, { type: mime });
  let width = 0;
  let height = 0;
  try {
    const bmp = await createImageBitmap(blob);
    width = bmp.width;
    height = bmp.height;
    (bmp as any).close?.();
  } catch {
    // 尺寸未知也可发送
  }
  const previewUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
  await sendMessage(new ImageContent(file, previewUrl, width, height));
  return true;
}

/**
 * 从浏览器地址栏 / 粘贴的预览 URL 中解析出服务端对象键（与上传返回的 path 一致，形如 file/preview/chat/...）。
 */
export function extractFilePreviewStorageKeyFromUrl(input: string): string | null {
  const t = input.trim();
  if (!t) {
    return null;
  }
  let pathPart = t;
  try {
    if (t.startsWith("http://") || t.startsWith("https://")) {
      pathPart = new URL(t).pathname;
    }
  } catch {
    return null;
  }
  const lower = pathPart.toLowerCase();
  const marker = "/file/preview/";
  const idx = lower.indexOf(marker);
  if (idx < 0) {
    return null;
  }
  let rest = pathPart.slice(idx + marker.length);
  rest = rest.split("?")[0].split("#")[0].replace(/^\/+/, "");
  if (!rest) {
    return null;
  }
  try {
    rest = decodeURIComponent(rest);
  } catch {
    /* 保留原样，避免畸形 % 序列 */
  }
  if (rest.startsWith("file/preview/")) {
    return rest;
  }
  if (rest.startsWith("file/")) {
    return rest;
  }
  return `file/preview/${rest}`;
}

/**
 * 粘贴图片预览 URL 的结构化描述，用于弹出「发送图片」对话框（引用既有对象键，不重复上传）。
 */
export interface PastedImagePreviewRef {
  storageKey: string;
  absoluteUrl: string;
  ext: string;
}

/**
 * 解析整段文本是否为「聊天图片预览」类 URL；返回引用信息（含对象键与绝对 URL），否则 null。
 * 与 {@link trySendImageFromPastedPreviewUrl} 使用同一套规则，供输入框粘贴时在 UI 层直接打开预览对话框。
 */
export function parseClipboardImagePreview(text: string): PastedImagePreviewRef | null {
  const abs = parsePastedInternalImagePreviewText(text);
  if (!abs) {
    return null;
  }
  const key = extractFilePreviewStorageKeyFromUrl(text || "");
  if (!key) {
    return null;
  }
  const baseKey = key.split("?")[0];
  const m = baseKey.match(/\.(jpe?g|png|gif|webp)$/i);
  if (!m) {
    return null;
  }
  return { storageKey: baseKey, absoluteUrl: abs, ext: m[1].toLowerCase() };
}

/**
 * 粘贴视频预览 URL 的结构化描述，用于弹出「发送视频」对话框（引用既有对象键 + 约定封面，不重复上传）。
 */
export interface PastedVideoPreviewRef {
  storageKey: string;
  coverStorageKey: string;
  absoluteUrl: string;
  ext: string;
}

/**
 * 解析整段文本是否为「聊天视频预览」类 URL；返回引用信息（对象键 + 封面键 + 绝对 URL），否则 null。
 * 封面键按「上传时的约定」复用：`<videoKey>_cover.jpg`。
 */
export function parseClipboardVideoPreview(text: string): PastedVideoPreviewRef | null {
  const abs = parsePastedInternalVideoPreviewText(text);
  if (!abs) {
    return null;
  }
  const key = extractFilePreviewStorageKeyFromUrl(text || "");
  if (!key) {
    return null;
  }
  const baseKey = key.split("?")[0];
  const m = baseKey.match(/\.(mp4|webm|mov|mpeg)$/i);
  if (!m) {
    return null;
  }
  const coverKey = baseKey.replace(/\.(mp4|webm|mov|mpeg)$/i, "_cover.jpg");
  return { storageKey: baseKey, coverStorageKey: coverKey, absoluteUrl: abs, ext: m[1].toLowerCase() };
}

/**
 * 整段文本是否为「聊天视频预览」类 URL（与图片逻辑分离，按扩展名区分）。
 */
export function parsePastedInternalVideoPreviewText(text: string): string | null {
  const t = (text || "").trim();
  if (!t || /[\r\n]/.test(t)) {
    return null;
  }
  if (!t.toLowerCase().includes("/file/preview/")) {
    return null;
  }
  if (!/\.(mp4|webm|mov|mpeg)(\?|#|$)/i.test(t)) {
    return null;
  }
  return ensureAbsolutePublicUrl(t);
}

/**
 * 粘贴视频预览链时，按已有对象键发「小视频」消息（与上传后写入的 url/cover 规则一致，不重复上传）。
 */
export async function trySendVideoFromPastedPreviewPath(
  sendMessage: (content: MessageContent) => Promise<Message>,
  text: string
): Promise<boolean> {
  if (!parsePastedInternalVideoPreviewText(text)) {
    return false;
  }
  const key = extractFilePreviewStorageKeyFromUrl(text);
  if (!key || !/\.(mp4|webm|mov|mpeg)(\?|#)?$/i.test(key)) {
    return false;
  }
  const baseKey = key.split("?")[0];
  const coverKey = baseKey.replace(/\.(mp4|webm|mov|mpeg)$/i, "_cover.jpg");
  const vc = new VideoContent();
  vc.url = baseKey;
  vc.cover = coverKey;
  vc.size = 0;
  vc.width = 0;
  vc.height = 0;
  vc.second = 1;
  await sendMessage(vc);
  return true;
}
