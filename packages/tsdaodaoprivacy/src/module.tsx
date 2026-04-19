import { IModule, Menus, WKApp } from "@tsdaodao/base";
import React from "react";
import SecurityPrivacyPage from "./SecurityPrivacyPage";

const PrivacyIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default class PrivacyModule implements IModule {
  id(): string {
    return "PrivacyModule";
  }

  init(): void {
    WKApp.menus.register("privacy", () => {
      return new Menus("privacy", "/privacy", "安全与隐私", PrivacyIcon, PrivacyIcon);
    }, 3500);

    WKApp.route.register("/privacy", () => {
      return <SecurityPrivacyPage />;
    });
  }
}
