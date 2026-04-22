/**
 * 桌面壳多域名入口池
 *
 * 与 Web / Manager / Android / iOS / Server 保持一致的 11 个候选域名。
 * 任一域名均可作为主入口；首次启动随机挑一个（等价入口分流），
 * 本次加载 `did-fail-load` 时顺序切换到下一个，成功后把 host 记为下次首选。
 *
 * SPA 自身（Axios 拦截器）也有一套独立的多域名重试用于 API 调用；
 * 本模块只解决"Electron 外壳首次加载 HTML 的单点故障"。
 */

import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export const DEFAULT_HOSTS: readonly string[] = Object.freeze([
  "coolapq.com",
  "nykjh.com",
  "lwijf.com",
  "lhqrx.com",
  "lqxybw.cn",
  "vowjyo.cn",
  "pifqtq.cn",
  "xegjzf.cn",
  "hailsv.cn",
  "wvyexex.cn",
  "xwxxkxl.cn",
]);

const PREF_FILE_NAME = "host-pool.json";

let cachedPreferredHost: string | null = null;

function getStorePath(): string {
  const dir = app.getPath("userData");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return join(dir, PREF_FILE_NAME);
}

function readPreferredHost(): string | null {
  try {
    const p = getStorePath();
    if (!existsSync(p)) return null;
    const raw = readFileSync(p, "utf-8");
    const obj = JSON.parse(raw);
    const h = typeof obj?.preferredHost === "string" ? obj.preferredHost : "";
    return DEFAULT_HOSTS.includes(h) ? h : null;
  } catch (_e) {
    return null;
  }
}

function writePreferredHost(host: string): void {
  try {
    if (!DEFAULT_HOSTS.includes(host)) return;
    writeFileSync(getStorePath(), JSON.stringify({ preferredHost: host }), "utf-8");
  } catch (_e) {
    // ignore
  }
}

/** 当前首选 host；无缓存时随机挑一个并写回缓存。 */
export function getPreferredHost(): string {
  if (cachedPreferredHost && DEFAULT_HOSTS.includes(cachedPreferredHost)) {
    return cachedPreferredHost;
  }
  const persisted = readPreferredHost();
  if (persisted) {
    cachedPreferredHost = persisted;
    return persisted;
  }
  const picked = DEFAULT_HOSTS[Math.floor(Math.random() * DEFAULT_HOSTS.length)];
  cachedPreferredHost = picked;
  writePreferredHost(picked);
  return picked;
}

/** 把当前首选写成 host（成功加载后调用），下次直接命中。 */
export function savePreferredHost(host: string): void {
  if (!DEFAULT_HOSTS.includes(host)) return;
  cachedPreferredHost = host;
  writePreferredHost(host);
}

/** 以首选开头的去重顺序；用于 did-fail-load 时顺序尝试。 */
export function orderedHosts(): string[] {
  const preferred = getPreferredHost();
  const rest = DEFAULT_HOSTS.filter((h) => h !== preferred);
  return [preferred, ...rest];
}

/**
 * 给定当前失败的 URL，返回下一个候选 URL（换 host，其他保留）。
 * 耗尽返回 null。
 */
export function nextUrlAfterFailure(currentUrl: string): string | null {
  try {
    const u = new URL(currentUrl);
    const curHost = u.hostname;
    const hosts = orderedHosts();
    const idx = hosts.indexOf(curHost);
    const nextIdx = idx < 0 ? 0 : idx + 1;
    if (nextIdx >= hosts.length) return null;
    u.hostname = hosts[nextIdx];
    return u.toString();
  } catch (_e) {
    return null;
  }
}

/**
 * 根据基础 webUrl（如 https://coolapq.com）换成以首选 host 拼出的同形 URL。
 * 方便首次加载把硬编码的 webUrl 替换为当前首选。
 */
export function withPreferredHost(baseUrl: string): string {
  try {
    const u = new URL(baseUrl);
    // 池内 host 才做替换；如果用户在 env 里填了私有域名/IP，原样保留。
    if (!DEFAULT_HOSTS.includes(u.hostname)) {
      return baseUrl;
    }
    u.hostname = getPreferredHost();
    return u.toString().replace(/\/$/, "");
  } catch (_e) {
    return baseUrl;
  }
}
