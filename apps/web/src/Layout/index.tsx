import React, { Component } from "react";
import { WKApp, WKBase, Provider, getSid } from "@tsdaodao/base"
import { MainPage } from "../Pages/Main";

// 历史上这里使用 @tauri-apps/* 做过自动更新，Tauri 路线已下线；
// PC 端更新逻辑现在完全由 Electron 主进程 src-election/main/update.ts 负责。

export default class AppLayout extends Component {
    onLogin!: () => void
    componentDidMount() {
        this.onLogin = () => {
            console.log("[AuthDebug] onLogin", {
                isLogined: WKApp.shared.isLogined(),
                token: WKApp.loginInfo.token,
                uid: WKApp.loginInfo.uid,
                pathname: window.location.pathname,
            })
            const sid = getSid()
            // 登录后补齐 sid 参数，但不做整页刷新（刷新会导致 IM 连接断开）
            try {
                const url = new URL(window.location.href)
                if (sid && !url.searchParams.get("sid")) {
                    url.searchParams.set("sid", sid)
                }
                if (url.pathname === "/login") {
                    url.pathname = "/"
                }
                window.history.replaceState({}, "", url.toString())
            } catch {
                // ignore
            }

            try {
                WKApp.loginInfo.save()
            } catch {
                // ignore
            }

            // 部分移动端 / 内置浏览器无 Notification 或非安全上下文会抛错；
            // 若抛错会中断 loginSuccess 里的 callOnLogin，导致误报「登录失败」且不刷新主界面。
            try {
                if (typeof Notification !== "undefined" && Notification.requestPermission) {
                    void Notification.requestPermission()
                }
            } catch {
                // ignore
            }
        }
        WKApp.endpoints.addOnLogin(this.onLogin)
    }

    componentWillUnmount() {
        WKApp.endpoints.removeOnLogin(this.onLogin)
    }

    render() {
        return <Provider create={() => {
            return WKApp.shared
        }} render={(vm: WKApp): any => {
            if (!WKApp.shared.isLogined()) {
                const loginComponent = WKApp.route.get("/login")
                if (!loginComponent) {
                    return <div>没有登录模块！</div>
                }
                return loginComponent
            }
            return <WKBase onContext={(ctx) => {
                WKApp.shared.baseContext = ctx
            }}>
                <MainPage />
            </WKBase>
        }} />

    }
}
