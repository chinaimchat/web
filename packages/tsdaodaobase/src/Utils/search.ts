import StorageService from "../Service/StorageService";

const WEB_TAB_SID_KEY = "wk_web_tab_sid";

export function getQueryParam(key: string) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key); // 不存在返回 null
}

/** 与 Web 入口 `ensureStableSessionSidInUrl` 使用同一存储键，避免每次随机 sid */
export function getSid() {
  let sid = getQueryParam("sid");
  if (!sid || sid === "") {
    sid = StorageService.shared.getItem(WEB_TAB_SID_KEY) || "";
    if (!sid) {
      sid = Math.random().toString(36).slice(-8);
      StorageService.shared.setItem(WEB_TAB_SID_KEY, sid);
    }
  }
  return sid;
}
