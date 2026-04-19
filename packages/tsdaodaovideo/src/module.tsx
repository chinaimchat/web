import { IModule, WKApp } from "@tsdaodao/base";
import React from "react";
import VideoToolbar from "./VideoToolbar";

const videoIconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23 7l-7 5 7 5V7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="1" y="5" width="15" height="14" rx="2" stroke="currentColor" stroke-width="2"/></svg>`;
const videoIconDataUrl = "data:image/svg+xml," + encodeURIComponent(videoIconSvg);

export default class VideoModule implements IModule {
  id(): string {
    return "VideoModule";
  }

  init(): void {
    WKApp.endpoints.registerChatToolbar("chattoolbar.video", (ctx) => {
      return <VideoToolbar conversationContext={ctx} icon={videoIconDataUrl} />;
    });
  }
}
