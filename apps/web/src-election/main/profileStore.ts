import { app } from "electron";
import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * 账号档案（profile）：每一个档案对应一份"稳定"的 session.partition 目录，
 * 这样"多开多账号"重启后也能自动恢复登录态；"同账号多窗"可以共用同一个 partition。
 *
 * profiles.json 路径：<userData>/profiles.json
 */
export interface Profile {
  id: string;
  name: string;
  partition: string;
  lastUsedAt: number;
}

interface ProfileFile {
  version: 1;
  profiles: Profile[];
}

const FILE_VERSION = 1;
const PARTITION_PREFIX = "tsdd-profile-";

function randomId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch (_) {
    return (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    );
  }
}

function getProfilesJsonPath(): string {
  return path.join(app.getPath("userData"), "profiles.json");
}

function readRaw(): ProfileFile {
  const p = getProfilesJsonPath();
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const obj = JSON.parse(raw);
    if (
      obj &&
      obj.version === FILE_VERSION &&
      Array.isArray(obj.profiles)
    ) {
      return obj;
    }
  } catch (_) {
    /* first launch / corrupted file */
  }
  return { version: FILE_VERSION, profiles: [] };
}

function writeRaw(data: ProfileFile) {
  const p = getProfilesJsonPath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("[profileStore] write failed:", e);
  }
}

export function listProfiles(): Profile[] {
  return readRaw().profiles.slice().sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

export function getProfileById(id: string): Profile | undefined {
  return readRaw().profiles.find((p) => p.id === id);
}

/** 返回一个默认 profile：如果没有任何档案就新建一个 */
export function getOrCreateDefaultProfile(): Profile {
  const list = listProfiles();
  if (list.length > 0) return list[0];
  return createProfile("账号 1");
}

export function createProfile(name = "新账号"): Profile {
  const data = readRaw();
  const id = randomId();
  const profile: Profile = {
    id,
    name,
    partition: `persist:${PARTITION_PREFIX}${id}`,
    lastUsedAt: Date.now(),
  };
  data.profiles.push(profile);
  writeRaw(data);
  return profile;
}

export function touchProfile(id: string) {
  const data = readRaw();
  const p = data.profiles.find((x) => x.id === id);
  if (!p) return;
  p.lastUsedAt = Date.now();
  writeRaw(data);
}

export function renameProfile(id: string, name: string) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const data = readRaw();
  const p = data.profiles.find((x) => x.id === id);
  if (!p) return;
  p.name = trimmed.slice(0, 32);
  writeRaw(data);
}

export function deleteProfile(id: string): boolean {
  const data = readRaw();
  const idx = data.profiles.findIndex((x) => x.id === id);
  if (idx < 0) return false;
  const [removed] = data.profiles.splice(idx, 1);
  writeRaw(data);
  try {
    const dir = partitionDir(removed.partition);
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn("[profileStore] delete partition dir failed:", e);
  }
  return true;
}

/** Chromium 把 persist: 分区落盘到 <userData>/Partitions/<name 小写> 下 */
function partitionDir(partition: string): string | null {
  if (!partition.startsWith("persist:")) return null;
  const name = partition.slice("persist:".length);
  return path.join(app.getPath("userData"), "Partitions", name.toLowerCase());
}

/**
 * 清理由历史 bug（每次启动随机 partition）遗留在磁盘上的孤儿分区目录。
 * 只清理我们自己带前缀的分区，绝不碰其它（比如 electron-screenshots）
 */
export function cleanOrphanPartitions(): void {
  const partitionsDir = path.join(app.getPath("userData"), "Partitions");
  try {
    if (!fs.existsSync(partitionsDir)) return;
    const active = new Set(
      listProfiles()
        .map((p) => {
          const d = partitionDir(p.partition);
          return d ? path.basename(d) : "";
        })
        .filter(Boolean)
    );
    for (const entry of fs.readdirSync(partitionsDir)) {
      const lower = entry.toLowerCase();
      const legacyPrefix = "tsdd-"; // 旧版 makeSessionPartition 前缀
      if (!lower.startsWith(PARTITION_PREFIX) && !lower.startsWith(legacyPrefix)) {
        continue;
      }
      if (active.has(entry)) continue;
      try {
        fs.rmSync(path.join(partitionsDir, entry), {
          recursive: true,
          force: true,
        });
        console.log("[profileStore] cleaned orphan partition:", entry);
      } catch (_) {
        /* ignore */
      }
    }
  } catch (e) {
    console.warn("[profileStore] cleanOrphanPartitions failed:", e);
  }
}
