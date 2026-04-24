import { Message, MessageContent } from "wukongimjssdk";
import WKApp from "../App";
import { MessageContentTypeConst } from "../Service/Const";
import { ImageContent } from "../Messages/Image";
import { VideoContent } from "../Messages/Video";

const MEDIA_CLIPBOARD_PREFIX = "__WK_MEDIA__:";

function authHeaders(): Record<string, string> {
  const token = WKApp.loginInfo.token;
  return token ? { token } : {};
}

export function ensureAbsolutePublicUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) return url;
  if (typeof window !== "undefined" && window.location?.origin && url.startsWith("/")) {
    return `${window.location.origin}${url}`;
  }
  return url;
}

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

function asPublicShareUrl(s: string | null | undefined): string | null {
  if (s == null || s === "") return null;
  const v = String(s);
  if (v.startsWith("data:")) return v;
  return ensureAbsolutePublicUrl(v);
}

function encodeClipboardMarker(payload: Record<string, any>): string {
  return `${MEDIA_CLIPBOARD_PREFIX}${JSON.stringify(payload)}`;
}

function parseClipboardMarker(text: string): any | null {
  const t = (text || "").trim();
  if (!t.startsWith(MEDIA_CLIPBOARD_PREFIX)) {
    return null;
  }
  try {
    return JSON.parse(t.slice(MEDIA_CLIPBOARD_PREFIX.length));
  } catch {
    return null;
  }
}

export function getMessageMediaAbsoluteUrl(message: Message): string | null {
  const ct = message.contentType;
  const c = message.content as any;
  switch (ct) {
    case MessageContentTypeConst.image:
    case MessageContentTypeConst.gif:
      if (c.imgData && String(c.imgData).startsWith("data:")) return asPublicShareUrl(c.imgData);
      if (!c.url) return null;
      return asPublicShareUrl(
        WKApp.dataSource.commonDataSource.getImageURL(c.url || "", {
          width: c.width || 0,
          height: c.height || 0,
        })
      );
    case MessageContentTypeConst.smallVideo:
      if (!c.url) return null;
      return asPublicShareUrl(WKApp.dataSource.commonDataSource.getFileURL(c.url || ""));
    default:
      return null;
  }
}

function getImageCopySourceUrl(message: Message): string | null {
  const ct = message.contentType;
  const c = message.content as any;
  const obj = c?.contentObj ?? c;
  if (ct === MessageContentTypeConst.image || ct === MessageContentTypeConst.gif) {
    if (obj?.imgData && String(obj.imgData).startsWith("data:image")) return String(obj.imgData);
    if (!(obj?.url || c?.remoteUrl)) return null;
    return WKApp.dataSource.commonDataSource.getImageURL((obj?.url || c?.remoteUrl || ""), {
      width: obj?.width || c?.width || 0,
      height: obj?.height || c?.height || 0,
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
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

function assertBlobLooksLikeImage(blob: Blob): void {
  const t = blob.type || "";
  if (!t) return;
  if (t.startsWith("text/") || t.includes("json") || t === "application/xml") {
    throw new Error("预览地址返回的不是图片");
  }
}

export async function copyMessageImageToClipboard(message: Message): Promise<void> {
  const raw = getImageCopySourceUrl(message);
  if (!raw) throw new Error("非图片类消息");
  const url = raw.startsWith("data:") ? raw : ensureAbsolutePublicUrl(raw);
  const content = message.content as any;
  const obj = content?.contentObj ?? content;
  const width = Number(obj?.width || content?.width || 0);
  const height = Number(obj?.height || content?.height || 0);
  const storageKey =
    obj?.url ||
    content?.url ||
    content?.remoteUrl ||
    extractFilePreviewStorageKeyFromUrl(url) ||
    "";
  const marker = encodeClipboardMarker({
    kind: "image",
    storageKey,
    absoluteUrl: url,
    width,
    height,
  });
  await copyPlainText(marker);
}

export async function copyMessageMediaLink(message: Message): Promise<void> {
  const c = message.content as any;
  const link = getMessageMediaAbsoluteUrl(message);
  if (!c?.url && !link) throw new Error("该消息类型不支持复制链接");
  await copyPlainText(encodeClipboardMarker({
    kind: "video",
    storageKey: c?.url || "",
    coverStorageKey: c?.cover || "",
    absoluteUrl: link || "",
  }));
}

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
  }
  if (rest.startsWith("file/preview/")) {
    return rest;
  }
  if (rest.startsWith("file/")) {
    return rest;
  }
  return `file/preview/${rest}`;
}

export function parsePastedInternalImagePreviewText(text: string): string | null {
  const t = (text || "").trim();
  if (!t || /[\r\n]/.test(t)) return null;
  if (!t.toLowerCase().includes("/file/preview/")) return null;
  return ensureAbsolutePublicUrl(t);
}

export async function trySendImageFromPastedPreviewUrl(
  sendMessage: (content: MessageContent) => Promise<Message>,
  text: string
): Promise<boolean> {
  const trimmed = (text || "").trim();
  const key = extractFilePreviewStorageKeyFromUrl(trimmed);
  if (key) {
    const ic = new ImageContent();
    ic.decodeJSON({ url: key.split("?")[0], width: 0, height: 0 });
    await sendMessage(ic);
    return true;
  }
  if (!trimmed.startsWith("data:image/")) {
    return false;
  }
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

export interface PastedImagePreviewRef {
  storageKey: string;
  absoluteUrl: string;
  width?: number;
  height?: number;
}

export function parseClipboardImagePreview(text: string): PastedImagePreviewRef | null {
  const marker = parseClipboardMarker(text);
  if (marker?.kind === "image" && marker.storageKey) {
    const baseKey = String(marker.storageKey).split("?")[0];
    return {
      storageKey: baseKey,
      absoluteUrl: marker.absoluteUrl || ensureAbsolutePublicUrl(baseKey),
      width: Number(marker.width || 0),
      height: Number(marker.height || 0),
    };
  }
  const abs = parsePastedInternalImagePreviewText(text);
  if (!abs) return null;
  const key = extractFilePreviewStorageKeyFromUrl(text || "");
  if (!key) return null;
  return { storageKey: key.split("?")[0], absoluteUrl: abs };
}

export function parsePastedInternalVideoPreviewText(text: string): string | null {
  const t = (text || "").trim();
  if (!t || /[\r\n]/.test(t)) return null;
  if (!t.toLowerCase().includes("/file/preview/")) return null;
  if (!/\.(mp4|webm|mov|mpeg)(\?|#|$)/i.test(t)) return null;
  return ensureAbsolutePublicUrl(t);
}

export interface PastedVideoPreviewRef {
  storageKey: string;
  coverStorageKey: string;
  absoluteUrl: string;
  ext: string;
}

export function parseClipboardVideoPreview(text: string): PastedVideoPreviewRef | null {
  const marker = parseClipboardMarker(text);
  if (marker?.kind === "video" && marker.storageKey) {
    const baseKey = String(marker.storageKey).split("?")[0];
    const m = baseKey.match(/\.(mp4|webm|mov|mpeg)$/i);
    if (!m) {
      return null;
    }
    return {
      storageKey: baseKey,
      coverStorageKey: marker.coverStorageKey || baseKey.replace(/\.(mp4|webm|mov|mpeg)$/i, "_cover.jpg"),
      absoluteUrl: marker.absoluteUrl || ensureAbsolutePublicUrl(baseKey),
      ext: m[1].toLowerCase(),
    };
  }
  const abs = parsePastedInternalVideoPreviewText(text);
  if (!abs) return null;
  const key = extractFilePreviewStorageKeyFromUrl(text || "");
  if (!key) return null;
  const baseKey = key.split("?")[0];
  const m = baseKey.match(/\.(mp4|webm|mov|mpeg)$/i);
  if (!m) return null;
  const coverKey = baseKey.replace(/\.(mp4|webm|mov|mpeg)$/i, "_cover.jpg");
  return { storageKey: baseKey, coverStorageKey: coverKey, absoluteUrl: abs, ext: m[1].toLowerCase() };
}

export async function trySendVideoFromPastedPreviewPath(
  sendMessage: (content: MessageContent) => Promise<Message>,
  text: string
): Promise<boolean> {
  if (!parsePastedInternalVideoPreviewText(text)) return false;
  const key = extractFilePreviewStorageKeyFromUrl(text);
  if (!key || !/\.(mp4|webm|mov|mpeg)(\?|#)?$/i.test(key)) return false;
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
