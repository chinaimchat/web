import axios from "axios";
import React, { Component } from "react";
import { Button, Spin, Toast } from '@douyinfe/semi-ui';
import './login.css'
import QRCode from 'qrcode.react';
import { WKApp, Provider } from "@tsdaodao/base"
import { LoginStatus, LoginType, LoginVM } from "./login_vm";
import classNames from "classnames";

function resolveAppLogo(): string {
    const publicURL = (process.env.PUBLIC_URL || "").trim()
    if (window.location.protocol === "file:") {
        const scripts = Array.from(document.getElementsByTagName("script"))
        const mainScript = scripts
            .map((script) => script.src)
            .find((src) => /\/static\/js\/main\..+\.js$/i.test(src))
        if (mainScript) {
            try {
                // file:///.../build/static/js/main.xxx.js -> file:///.../build/logo.jpg
                return new URL("../../logo.jpg", mainScript).toString()
            } catch {
                // ignore and fallback
            }
        }
    }
    if (publicURL) {
        return `${publicURL}/logo.jpg`
    }
    return "logo.jpg"
}

const APP_LOGO = resolveAppLogo();
const REFRESH_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#8F8F8F" stroke-width="1.8"/>
      <path d="M12 6.5a5.5 5.5 0 1 1-4.2 9" stroke="#8F8F8F" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M6.6 16.6V12.8H10.4" stroke="#8F8F8F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
)}`;

type LoginState = {
    loginStatus: string
    loginUUID: string
    getLoginUUIDLoading: boolean
    scanner?: string  // 扫描者的uid
    qrcode?: string
}

class Login extends Component<any, LoginState> {
    private readonly loginAccountRef = React.createRef<HTMLInputElement>()
    private readonly loginPasswordRef = React.createRef<HTMLInputElement>()
    private readonly registerAccountRef = React.createRef<HTMLInputElement>()
    private readonly registerNameRef = React.createRef<HTMLInputElement>()
    private readonly registerInviteRef = React.createRef<HTMLInputElement>()
    private readonly registerPasswordRef = React.createRef<HTMLInputElement>()


    render() {

        return <Provider create={() => {
            return new LoginVM()
        }} render={(vm: LoginVM) => {
            return <div className="wk-login">
                <div className="wk-login-content">
                    <div className="wk-login-content-phonelogin" style={{ "display": vm.loginType === LoginType.phone ? "block" : "none" }}>
                        <div className="wk-login-content-logo">
                            <img src={APP_LOGO} alt="logo" />
                        </div>
                        <div className="wk-login-content-slogan">
                            更愉快的与朋友交流
                        </div>
                        <div className="wk-login-content-form">
                            <input ref={this.loginAccountRef} type="text" placeholder="请输入账号" autoComplete="username" onChange={(v) => {
                                vm.username = v.target.value
                            }}></input>
                            <input ref={this.loginPasswordRef} type="password" placeholder="密码" autoComplete="current-password" onChange={(v) => {
                                vm.password = v.target.value
                            }}></input>
                            <div className="wk-login-content-form-buttons">
                                <Button loading={vm.loginLoading} className="wk-login-content-form-ok" type='primary' theme='solid' onClick={async () => {
                                    const username = (this.loginAccountRef.current?.value ?? vm.username ?? "").trim()
                                    const password = (this.loginPasswordRef.current?.value ?? vm.password ?? "").trim()
                                    vm.username = username
                                    vm.password = password
                                    if (!username) {
                                        Toast.error("账号不能为空！")
                                        return
                                    }
                                    if (!password) {
                                        Toast.error("密码不能为空！")
                                        return
                                    }
                                    vm.requestLoginAuto(username, password).catch((err) => {
                                        Toast.error(err?.msg || err?.error?.response?.data?.msg || "登录失败")
                                    })
                                }}>登录</Button>
                            </div>
                            <div className="wk-login-content-form-others">
                                <div className="wk-login-content-form-scanlogin" onClick={() => {
                                    vm.loginType = LoginType.qrcode
                                }}>
                                    扫描登录
                                </div>
                                <div className="wk-login-content-form-register" onClick={() => {
                                    vm.loginType = LoginType.register
                                }}>
                                    注册账号
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={classNames("wk-login-content-scanlogin", vm.loginType === LoginType.qrcode ? "wk-login-content-scanlogin-show" : undefined)}>
                        <Spin size="large" spinning={vm.qrcodeLoading}>
                            <div className="wk-login-content-scanlogin-qrcode">
                                {
                                    vm.qrcodeLoading || !vm.qrcode ? undefined : <QRCode value={vm.qrcode} size={280} fgColor={WKApp.config.themeColor}></QRCode>
                                }
                                {
                                    <div className={classNames("wk-login-content-scanlogin-qrcode-avatar", vm.showAvatar() ? "wk-login-content-scanlogin-qrcode-avatar-show" : undefined)}>
                                        {vm.showAvatar() ? <img src={WKApp.shared.avatarUser(vm.uid!)}></img> : undefined}
                                    </div>
                                }
                                {
                                    !vm.autoRefresh ? <div className="wk-login-content-scanlogin-qrcode-expire">
                                        <p>二维码已失效，点击刷新</p>
                                        <img onClick={() => {
                                            vm.reStartAdvance()
                                        }} src={REFRESH_ICON}></img>
                                    </div> : undefined
                                }
                            </div>
                        </Spin>
                        <div className="wk-login-content-scanlogin-qrcode-title">
                            <h3>使用手机{WKApp.config.appName}扫码登录</h3>
                        </div>
                        <div className="wk-login-content-scanlogin-qrcode-desc">
                            <ul>
                                <li>
                                    在手机上打开{WKApp.config.appName}
                                </li>
                                <li>
                                    进入 <b>消息</b> &nbsp; &gt; &nbsp; <b>+</b>  &nbsp; &gt; &nbsp;<b>扫一扫</b>
                                </li>
                                <li>
                                    请勿使用系统相机或微信扫一扫：二维码里是服务端登录接口地址，只有 App 内「扫一扫」会带上账号凭证；用系统扫码往往只会提示或打开一串以 http 开头的链接，无法完成网页登录。
                                </li>
                                <li>
                                    将你的手机摄像头对准上面二维码进行扫描
                                </li>
                                <li>
                                    在手机上确认登录
                                </li>
                            </ul>
                        </div>
                        <div className="wk-login-footer-buttons">
                            <button onClick={() => {
                                vm.loginType = LoginType.phone
                            }}>使用账号登录</button>
                        </div>

                    </div>

                    <div className="wk-login-content-phonelogin" style={{ "display": vm.loginType === LoginType.register ? "block" : "none" }}>
                        <div className="wk-login-content-logo">
                            <img src={APP_LOGO} alt="logo" />
                        </div>
                        <div className="wk-login-content-slogan">
                            注册新账号
                        </div>
                        <div className="wk-login-content-form">
                            <div className="wk-login-content-form-phone-row">
                                <input ref={this.registerAccountRef} type="text" placeholder="请输入账号" autoComplete="username" onChange={(v) => {
                                    vm.regPhone = v.target.value
                                }}></input>
                            </div>
                            <input ref={this.registerNameRef} type="text" placeholder="昵称（选填）" onChange={(v) => {
                                vm.regName = v.target.value
                            }}></input>
                            {
                                (WKApp.remoteConfig as any).inviteCodeSystemOn === 1
                                    ? <input ref={this.registerInviteRef} type="text" placeholder="邀请码" onChange={(v) => {
                                        vm.regInviteCode = v.target.value
                                    }}></input>
                                    : undefined
                            }
                            <input ref={this.registerPasswordRef} type="password" placeholder="密码" autoComplete="new-password" onChange={(v) => {
                                vm.regPassword = v.target.value
                            }}></input>
                            <div className="wk-login-content-form-buttons">
                                <Button loading={vm.registerLoading} className="wk-login-content-form-ok" type='primary' theme='solid' onClick={async () => {
                                    const regPhone = (this.registerAccountRef.current?.value ?? vm.regPhone ?? "").trim()
                                    const regName = (this.registerNameRef.current?.value ?? vm.regName ?? "").trim()
                                    const regInviteCode = (this.registerInviteRef.current?.value ?? vm.regInviteCode ?? "").trim()
                                    const regPassword = (this.registerPasswordRef.current?.value ?? vm.regPassword ?? "").trim()
                                    vm.regPhone = regPhone
                                    vm.regName = regName
                                    vm.regInviteCode = regInviteCode
                                    vm.regPassword = regPassword
                                    if (!regPhone) {
                                        Toast.error("账号不能为空！")
                                        return
                                    }
                                    if (!regPassword) {
                                        Toast.error("密码不能为空！")
                                        return
                                    }
                                    vm.requestRegister(vm.regZone, regPhone, "123456", regName || "", regPassword, regInviteCode).catch((err: any) => {
                                        Toast.error(err.msg || "注册失败")
                                    })
                                }}>注册</Button>
                            </div>
                            <div className="wk-login-content-form-others">
                                <div className="wk-login-content-form-scanlogin" onClick={() => {
                                    vm.loginType = LoginType.phone
                                }}>
                                    已有账号？去登录
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


            </div>
        }}>

        </Provider>
    }
}

export default Login