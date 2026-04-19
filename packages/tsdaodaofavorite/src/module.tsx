import { IModule, WKApp, Menus } from "@tsdaodao/base";
import React from "react";
import FavoritePage, { FavoriteMain } from "./Pages";
import { Toast } from "@douyinfe/semi-ui";

const FavoriteIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default class FavoriteModule implements IModule {
  id(): string {
    return "FavoriteModule"
  }
  init(): void {
    WKApp.endpoints.registerMessageContextMenus("contextmenus.favorite", (message) => {
      if (WKApp.shared.supportFavorites.includes(message.contentType)) {
        return {
          title: "收藏",
          onClick: () => {
            WKApp.dataSource.commonDataSource.favorities(message).then(() => {
              Toast.success("收藏成功");
            }).catch((err: { msg?: string }) => {
              Toast.error(err?.msg || "收藏失败");
            });
          }
        };
      }
      return null;
    }, 1010);

    WKApp.menus.register("favorites", () => {
      return new Menus(
        "favorites",
        "/favorites",
        "收藏",
        FavoriteIcon,
        FavoriteIcon,
        () => {
          WKApp.routeRight.replaceToRoot(<FavoriteMain />);
        }
      );
    }, 3000);

    WKApp.route.register("/favorites", () => {
      return <FavoritePage />;
    });
  }
}