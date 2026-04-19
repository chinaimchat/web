import React from "react";
import WKApp from "../App";
import { EndpointCategory, EndpointID } from "./Const";
import { EndpointManager } from "./Module";
import { getSid } from "../Utils/search";


export default class RouteManager {
  private constructor() {
    console.log("RouteManager init")
    window.onpopstate = function (e:any) {
      console.log("onpopstate---->",e)
      RouteManager.shared.push(window.location.pathname)

    };
    window.onpageshow = function () {
      console.log("onpageshow---->",window.location.pathname)
      RouteManager.shared.push(window.location.pathname)
    };
    this.currentPath = "/"
  }
  public static shared = new RouteManager()

  currentPath?: string // 当前路由path
  /** 应用层可设置：push 时回调，用于同步左侧 VM 的 history（如 /sticker 无菜单时） */
  onPushCallback?: (path: string) => void;
  /** 应用层可设置：从无菜单的页面（如 /sticker）点击返回时回调，用于弹出左侧历史栈 */
  onCloseCallback?: () => void;

  register(path: string, handler: (param: any) => JSX.Element| React.ElementType) {
    EndpointManager.shared.setMethod(`${EndpointID.routePrefix}${path}`, (param) => {
      return handler(param);
    }, { category: EndpointCategory.routes });
  }

  get(path: string, param?: any): JSX.Element| React.ElementType {
    const component = EndpointManager.shared.invoke(`${EndpointID.routePrefix}${path}`, param)
    return component
  }

  push(path: string, param?: any) {
    this.currentPath = path
    const component = EndpointManager.shared.invoke(`${EndpointID.routePrefix}${path}`, param)
    if (component) {
      let sid = getSid()
      window.history.pushState({}, "title", `${path}?sid=${sid}`)
      WKApp.shared.restContent(component)
      this.onPushCallback?.(path)
    }
  }
}

export class ContextRouteManager {
  setPush!:(view:JSX.Element)=>void
  setReplaceToRoot!:(view:JSX.Element)=>void
  setPop!:()=>void
  setPopToRoot!:()=>void


  push(view:JSX.Element) {
    this.setPush(view)
  }

  replaceToRoot(view: JSX.Element): void {
    this.setReplaceToRoot(view)
  }

  pop() {
    this.setPop()
  }

  popToRoot() {
    this.setPopToRoot()
  }
}