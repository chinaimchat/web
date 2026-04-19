import { WKApp, WKLayout, Provider } from "@tsdaodao/base";
import React, { Component } from "react";
import "./index.css"
import MainVM from "./vm";
import { TabNormalScreen } from "./tab_normal_screen";

/** 捕获路由页面渲染错误，避免整页闪退 */
class RouteErrorBoundary extends Component<{ path: string; children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  state = { hasError: false as boolean, error: undefined as Error | undefined };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    console.error("[RouteErrorBoundary]", this.props.path, error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: "center", color: "#999", fontSize: 14 }}>
          页面加载异常，请刷新后重试
        </div>
      );
    }
    return this.props.children;
  }
}

export interface MainContentLeftProps {
    vm: MainVM
}

export interface MainContentLeftState {
}
export class MainContentLeft extends Component<MainContentLeftProps, MainContentLeftState>{
    constructor(props: any) {
        super(props)
        this.state = {
        }
    }

    componentDidMount() {
        WKApp.route.onPushCallback = (path: string) => {
            if (path === "/sticker") this.props.vm.pushRoutePath("/sticker");
        };
        WKApp.route.onCloseCallback = () => {
            this.props.vm.popRoutePath();
            const last = this.props.vm.currentMenus?.routePath || "/";
            try {
                const sid = new URL(window.location.href).searchParams.get("sid");
                const next = sid ? `${last}?sid=${sid}` : last;
                window.history.replaceState({}, "", next);
            } catch {
                window.history.replaceState({}, "", last);
            }
        };
    }

    componentWillUnmount() {
        WKApp.route.onPushCallback = undefined;
        WKApp.route.onCloseCallback = undefined;
    }

    render() {
        const { vm } = this.props

        return <>
            {
                vm.historyRoutePaths.map((routePath, i) => {
                    const Cpt = WKApp.route.get(routePath)
                    let content: React.ReactNode = null
                    if (React.isValidElement(Cpt)) {
                        content = Cpt
                    } else if (typeof Cpt === "function") {
                        content = React.createElement(Cpt as React.ComponentType)
                    }
                    return (
                        <div key={routePath} style={{ display: routePath === vm.currentMenus?.routePath ? "block" : "none", width: "100%", height: "100%", minHeight: 0, overflow: "hidden" }}>
                            {React.createElement(RouteErrorBoundary, { path: routePath, children: content })}
                        </div>
                    );
                })
            }
        </>
    }
}

export class MainPage extends Component {

    render() {
        return <Provider create={() => {
            return new MainVM()
        }} render={(vm: MainVM) => {
            return <WKLayout onRenderTab={(size) => {
                // if (size === ScreenSize.small) {
                //     return <TabLowScreen vm={vm}></TabLowScreen>
                // }
                return <TabNormalScreen vm={vm} />
            }} contentLeft={<MainContentLeft vm={vm} />} onRightContext={(context) => {
                WKApp.routeRight.setPush = (view) => {
                    context.push(view)
                }
                WKApp.routeRight.setReplaceToRoot = (view) => {
                    context.replaceToRoot(view)
                }
                WKApp.routeRight.setPop = () => {
                    context.pop()
                }
                WKApp.routeRight.setPopToRoot = () => {
                    context.popToRoot()
                }
            }} onLeftContext={(context) => {
                WKApp.routeLeft.setPush = (view) => {
                    context.push(view)
                }
                WKApp.routeLeft.setReplaceToRoot = (view) => {
                    context.replaceToRoot(view)
                }
                WKApp.routeLeft.setPop = () => {
                    context.pop()
                }
                WKApp.routeLeft.setPopToRoot = () => {
                    context.popToRoot()
                }
            }} contentRight={<div className="wk-chat-empty">
                <img src={require("./assets/start_chat.svg").default} alt=""></img>
            </div>} />
        }}>

        </Provider>
    }
}