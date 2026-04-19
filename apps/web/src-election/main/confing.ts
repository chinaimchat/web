const TSDD_FONFIG = {
  appId: "com.tsdaodao.im",
  name: "AI抖商学院",
  updataUrl: 'http://web.imfira.com/',
  /**
   * 生产环境 PC 入口开关 —— 全仓库唯一切换处。
   *
   * - 空字符串（默认，推荐）：走"离线 app://"形态。主进程注册 app://local 自定义协议，
   *   加载包内 build/index.html。API 根由 apps/web/src/index.tsx 的 ELECTRON_FILE_API_ROOT 决定。
   * - 非空（"封装远端 URL"形态）：必须带协议，如 `http://www.你的域名/`。
   *   此时页面与远端同源，API 走同源 /api/v1/（需要远端站点已反代到 chinaim-server）。
   *
   * 任何其它加载方式（loadFile / Tauri / ...）都已下线，不要再加回来。详见 apps/web/PACKAGING.md。
   */
  remoteWebEntryUrl: '' as string,
};

export default TSDD_FONFIG;
