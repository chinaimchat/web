import { IModule, Menus, WKApp } from "@tsdaodao/base";
import React from "react";
import MomentsPage from "./MomentsPage";

/** 朋友圈按钮：光圈/镜头图标（与提供图形一致），颜色由侧栏 CSS 控制 */
const MomentsIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M15.5 12H21M12 15.5V21M8.5 12H3M12 8.5V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M14.47 9.53L18.36 5.64M9.53 14.47L5.64 18.36M9.53 9.53L5.64 5.64M14.47 14.47L18.36 18.36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export default class MomentsModule implements IModule {
  id(): string {
    return "MomentsModule";
  }

  init(): void {
    WKApp.menus.register("moments", () => {
      return new Menus(
        "moments",
        "/moments",
        "朋友圈",
        MomentsIcon,
        MomentsIcon
      );
    }, 3000);

    WKApp.route.register("/moments", () => {
      return <MomentsPage />;
    });
  }
}
