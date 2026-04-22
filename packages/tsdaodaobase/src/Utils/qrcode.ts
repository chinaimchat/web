export function normalizeQRCodeURL(rawURL: string, apiURL?: string): string {
  if (!rawURL || typeof rawURL !== "string") {
    return rawURL;
  }
  // Electron 使用 file:// 加载时，优先保留服务端返回的扫码地址，避免重写成不可访问地址。
  if (
    typeof window !== "undefined" &&
    ((window as any).__POWERED_ELECTRON__ || window.location.protocol === "file:")
  ) {
    return rawURL;
  }

  let parsedRawURL: URL;
  try {
    parsedRawURL = new URL(rawURL);
  } catch {
    return rawURL;
  }

  // Web 页面走 HTTPS 时，优先把二维码链接升级到 HTTPS，避免扫码后被浏览器拦截或降级失败。
  if (
    typeof window !== "undefined" &&
    window.location?.protocol === "https:" &&
    parsedRawURL.protocol === "http:"
  ) {
    parsedRawURL.protocol = "https:";
    return parsedRawURL.toString();
  }

  const normalizedAPIURL = (apiURL || "").trim();
  if (/^https?:\/\//i.test(normalizedAPIURL)) {
    try {
      const parsedAPIURL = new URL(normalizedAPIURL);
      const host = (parsedRawURL.hostname || "").toLowerCase();
      const shouldRewriteHost =
        host === "127.0.0.1" || host === "localhost" || host === "0.0.0.0";
      if (shouldRewriteHost) {
        parsedRawURL.protocol = parsedAPIURL.protocol;
        parsedRawURL.host = parsedAPIURL.host;
        return parsedRawURL.toString();
      }
      return rawURL;
    } catch {
      return rawURL;
    }
  }

  if (
    normalizedAPIURL.startsWith("/api/") &&
    parsedRawURL.pathname.startsWith("/v1/")
  ) {
    const origin =
      typeof window !== "undefined" && window.location
        ? window.location.origin
        : "";
    if (origin) {
      return `${origin}/api${parsedRawURL.pathname}${parsedRawURL.search}${parsedRawURL.hash}`;
    }
  }

  return rawURL;
}
