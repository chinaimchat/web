import { IModule, WKApp } from "@tsdaodao/base";
import React from "react";
import StickerPage from "./StickerPage";

/** 表情包模块：仅注册 /sticker 路由，不显示侧栏菜单，从表情面板「前往表情包」进入 */
export default class StickerModule implements IModule {
  id(): string {
    return "StickerModule";
  }

  init(): void {
    WKApp.route.register("/sticker", () => {
      return <StickerPage />;
    });
  }
}
