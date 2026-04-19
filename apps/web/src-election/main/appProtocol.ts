import { app, protocol, net, Session, session as electronSession } from "electron";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

/**
 * 自定义 app:// 协议：在离线包里取代 file://。
 *
 * 为什么不直接 loadFile？
 *   1) file:// 在新版 Chromium 下限制越来越多（fetch 跨源、Service Worker、
 *      history.pushState 的 base 表现不稳定），未来升级 Electron 容易踩坑；
 *   2) app:// 是我们自己的 scheme，CORS / fetch / CSP 行为可预测；
 *   3) 所有窗口共享同一个 scheme，便于统一做缓存策略与 devtools 调试。
 *
 * 安全权衡：
 *   - 不标记 secure=true，避免把 Chromium 的"安全上下文"限制带进来
 *     （主要是避免把 http:// 的后端 API 判成混合内容而被阻断）。
 *   - 通过 commandLine 将 `app://local` 标成可信来源，让
 *     navigator.clipboard / crypto.subtle 等能力仍然可用（与 file:// 打平）。
 *
 * 入口 URL：app://local/index.html?sid=xxx
 *
 * ⚠ 关键：每一个 session（包括每个 persist:tsdd-profile-* 分区）**都要单独挂 handler**。
 *       Electron 全局 protocol 对象只代理 defaultSession；自定义 partition 上没人挂的话，
 *       Chromium 会把 app:// 当"未知协议"吐回操作系统，在 Windows 上表现为
 *       "获取打开此 'app' 链接的应用 → 去 Microsoft Store 找"这类系统弹窗。
 */

export const APP_SCHEME = "app";
export const APP_HOST = "local";
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/**
 * 必须在 app.ready 之前调用。
 *
 * privileges 说明：
 *   - standard:        走标准 URL 解析（path/query/anchor），否则 React Router 会乱
 *   - supportFetchAPI: 让页面内 fetch('/api/xx') 相对地址可解析
 *   - stream:          允许流式响应（大文件、媒体）
 *   - corsEnabled:     允许 XHR/fetch 走 CORS 流程
 *   - bypassCSP:       初期为稳定性放开，正式灰度后可关掉
 */
export function registerAppSchemeAsPrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
        bypassCSP: true,
      },
    },
  ]);

  // 让 app://local 成为"可信来源"，保住 clipboard / crypto.subtle 等能力
  // 同时又不把整个 scheme 标成 secure（避免 http API 被当混合内容阻断）。
  try {
    app.commandLine.appendSwitch(
      "unsafely-treat-insecure-origin-as-secure",
      APP_ORIGIN
    );
  } catch (e) {
    console.warn("[appProtocol] mark origin trustworthy failed:", e);
  }
}

/**
 * 解析出打包后的 build/ 绝对路径。
 *
 * electron-builder.js 里 files: ["build/**\u002f*", "out-election/**\u002f*"]，
 * 所以在 asar 里二者并列，build 与 out-election/main/index.js 的相对关系是：
 *   out-election/main/index.js  ->  ../../build/
 */
function resolveBuildDir(): string {
  return path.resolve(__dirname, "../../build");
}

/**
 * 根据请求 URL 返回响应。抽出来让不同 session 共享。
 */
function makeHandler(buildDir: string, indexFile: string) {
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      // 只认我们自己的 host，其它一律 404，防止被用作路径穿越的跳板
      if (url.host !== APP_HOST) {
        return new Response("Bad host", { status: 400 });
      }

      let relPath = decodeURIComponent(url.pathname || "/");
      if (relPath === "" || relPath === "/") relPath = "/index.html";

      // 归一化并防穿越：只允许停留在 buildDir 内
      const resolved = path.normalize(path.join(buildDir, relPath));
      if (!resolved.startsWith(buildDir)) {
        return new Response("Forbidden", { status: 403 });
      }

      let target = resolved;
      try {
        const st = await fs.promises.stat(target);
        if (!st.isFile()) target = indexFile;
      } catch (_) {
        // SPA 回退：没有扩展名的路径视为前端路由，回落到 index.html；
        // 有扩展名的（.js/.css/.png 等）就如实返回 404，方便排查。
        if (!path.extname(relPath)) {
          target = indexFile;
        } else {
          return new Response("Not Found", { status: 404 });
        }
      }

      return net.fetch(pathToFileURL(target).toString());
    } catch (err) {
      console.error("[appProtocol] handler error:", err);
      return new Response("Internal Error", { status: 500 });
    }
  };
}

/** 避免对同一个 session 重复 handle 报错 */
const registeredSessions = new WeakSet<Session>();

/**
 * 给指定 session 挂上 app:// 协议的 handler。
 * 每个 BrowserWindow 用的 partition session 都必须调一次；
 * 全局 defaultSession 建议也挂一次（兜底给 Electron 内部组件）。
 */
export function ensureAppProtocolForSession(ses: Session): void {
  if (registeredSessions.has(ses)) return;
  const buildDir = resolveBuildDir();
  const indexFile = path.join(buildDir, "index.html");
  try {
    ses.protocol.handle(APP_SCHEME, makeHandler(buildDir, indexFile));
    registeredSessions.add(ses);
    console.log(
      "[appProtocol] session handler registered, buildDir =",
      buildDir
    );
  } catch (e) {
    // 已挂过时 Electron 会抛"already registered"，记日志但不当错
    console.warn("[appProtocol] register on session failed:", e);
  }
}

/**
 * 必须在 app.on('ready') 之后调用，且整个 app 生命周期只挂一次 defaultSession。
 * 历史保留的入口；真正起作用的是 ensureAppProtocolForSession()。
 */
export function registerAppProtocolHandler(): void {
  ensureAppProtocolForSession(electronSession.defaultSession);
}
