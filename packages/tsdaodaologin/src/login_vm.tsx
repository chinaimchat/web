import { WKApp, ProviderListener } from "@tsdaodao/base";
import { Toast } from "@douyinfe/semi-ui";

const DEFAULT_ZONE_CODE: string = "0086"
const DEFAULT_REGISTER_CODE: string = "123456"

function normalizeQrcodeURL(rawURL: string): string {
    if (!rawURL || typeof rawURL !== "string") {
        return rawURL
    }
    // Electron 使用 file:// 加载前端，二维码地址必须尽量保持后端原始值，
    // 否则容易把可扫码链接改坏（例如被改成不可访问域名或错误协议）。
    if ((window as any).__POWERED_ELECTRON__) {
        return rawURL
    }
    let parsedRawURL: URL
    try {
        parsedRawURL = new URL(rawURL)
    } catch {
        return rawURL
    }
    const apiURL = WKApp.apiClient.config.apiURL || ""
    if (/^https?:\/\//i.test(apiURL)) {
        try {
            const parsedAPIURL = new URL(apiURL)
            // 仅在目标地址是本地/内网占位地址时才做替换，避免覆盖后端返回的正确公网地址。
            const host = (parsedRawURL.hostname || "").toLowerCase()
            const shouldRewriteHost = host === "127.0.0.1" || host === "localhost" || host === "0.0.0.0"
            if (shouldRewriteHost) {
                parsedRawURL.protocol = parsedAPIURL.protocol
                parsedRawURL.host = parsedAPIURL.host
                return parsedRawURL.toString()
            }
            return rawURL
        } catch {
            return rawURL
        }
    }
    if (apiURL.startsWith("/api/") && parsedRawURL.pathname.startsWith("/v1/")) {
        return `${window.location.origin}/api${parsedRawURL.pathname}${parsedRawURL.search}${parsedRawURL.hash}`
    }
    return rawURL
}


export class LoginStatus {
    static getUUID: string = "getUUID"
    static waitScan: string = "waitScan"
    static authed: string = "authed"
    static scanned: string = "scanned"
    static expired: string = "expired"
}

export enum LoginType {
    qrcode, // 二维码登录
    phone, // 手机号登录
    register, // 手机号注册
}

/** 与后端 config.DeviceFlag 一致：0=APP，1=Web，2=PC（Electron/Tauri 桌面为 PC，浏览器为 Web）。 */
function loginDeviceFlag(): number {
    return WKApp.shared.isPC ? 2 : 1
}

export class LoginVM extends ProviderListener {
    loginStatus: string = LoginStatus.getUUID // 登录状态
    qrcodeLoading: boolean = false // 二维码加载中
    uuid?: string
    qrcode?: string
    expireMaxTryCount: number = 5 // 过期最多次数（超过指定次数则永远显示过期，需要用户手动刷新）
    private _expireTryCount: number = 0 // 过期尝试次数

    uid?: string // 当前扫描的用户uid
    private _loginType: LoginType = LoginType.phone

    private _pullMaxErrCount: number = 10 //  pull登录状态请求最大错误次数，超过指定次数将不再请求
    private _pullErrCount: number = 0 // 当前pull发生错误请求次数

    private _autoRefresh: boolean = true // 是否自动刷新二维码
     loginLoading: boolean = false // 登录中

    // ---------- 手机登录方式 ----------
    username?:string
    password?:string

    // ---------- 注册方式 ----------
    regZone: string = DEFAULT_ZONE_CODE
    regPhone?: string // 兼容旧字段：当前作为“账号输入”
    regCode?: string
    regName?: string
    regPassword?: string
    regInviteCode?: string
    registerLoading: boolean = false

    set autoRefresh(v: boolean) {
        this._autoRefresh = v
        this.notifyListener()

        if (v) {
            this.reStartAdvance()
        }
    }

    get autoRefresh() {
        return this._autoRefresh
    }

    didMount(): void {
        this.advance()
    }

    set loginType(v: LoginType) {
        this._loginType = v
        if (v === LoginType.qrcode) {
            this.reStartAdvance()
        }
        this.notifyListener()
    }
    get loginType(): LoginType {
        return this._loginType
    }

    reStartAdvance() {
        this.restCount()
        this.loginStatus = LoginStatus.getUUID
        this._autoRefresh = true
        this.notifyListener()
        this.advance()
    }


    advance(data?: any) {
        if (this.loginType !== LoginType.qrcode) {
            return
        }
        switch (this.loginStatus) {
            case LoginStatus.getUUID:
                this.requestUUID()
                break
            case LoginStatus.waitScan:
                this.pullLoginStatus(this.uuid)
                break
            case LoginStatus.scanned:
                this.uid = data.uid
                this.notifyListener()
                this.pullLoginStatus(this.uuid)
                break
            case LoginStatus.authed:
                this.restCount()
                this.requestLogin(data.auth_code)
                break
            case LoginStatus.expired:
                this._expireTryCount++
                if (this._expireTryCount > this.expireMaxTryCount) {
                    this.autoRefresh = false
                } else {
                    this.loginStatus = LoginStatus.getUUID
                    this.advance()
                }

        }
    }

    restCount() {
        this._expireTryCount = 0
        this._pullErrCount = 0
    }

    async requestLogin(authCode: string) {
        if (this.loginLoading) {
            return
        }
        this.loginLoading = true
        const flag = loginDeviceFlag()
        const resp = await WKApp.apiClient.post(
            `user/login_authcode/${encodeURIComponent(authCode)}?flag=${flag}`
        )
        if (resp) {
            this.loginSuccess(resp)
        }
        this.loginLoading = false
    }

    async requestLoginWithUsernameAndPwd(username: string, password: string) {
        this.loginLoading = true
        this.notifyListener()
        const device = this.getDevice()
        const deviceFlag = loginDeviceFlag()
        return WKApp.apiClient.post(`user/login`, { "username": username, "password": password, "flag": deviceFlag,"device":device }).then((result)=>{
            if (!this.hasLoginPayload(result)) {
                return Promise.reject({ msg: "登录失败：服务端未返回有效登录信息" })
            }
            this.loginSuccess(result)
        }).catch((loginError: any) => {
            const backendMsg: string = loginError?.msg || loginError?.error?.response?.data?.msg || "登录失败，请稍后重试"
            return Promise.reject({
                ...loginError,
                msg: backendMsg,
            })
        }).finally(()=>{
            this.loginLoading = false
            this.notifyListener()
        })
    }

    private normalizePhoneLoginUsername(input: string): string {
        const raw = (input || "").trim()
        if (!raw) return raw
        if (/^1\d{10}$/.test(raw)) {
            return `${DEFAULT_ZONE_CODE}${raw}`
        }
        if (raw.startsWith("+")) {
            return `00${raw.substring(1)}`
        }
        if (raw.startsWith("00")) {
            return raw
        }
        if (/^\d+$/.test(raw)) {
            return `${DEFAULT_ZONE_CODE}${raw}`
        }
        return raw
    }

    async requestLoginAuto(account: string, password: string) {
        const acc = (account || "").trim()
        const loginUsername = this.normalizePhoneLoginUsername(acc)
        return this.requestLoginWithUsernameAndPwd(loginUsername, password)
    }

    async requestRegister(zone: string, phone: string, code: string, name: string, password: string, inviteCode?: string) {
        this.registerLoading = true
        this.notifyListener()
        const device = this.getDevice()
        const deviceFlag = loginDeviceFlag()
        const payload: any = {
            "zone": DEFAULT_ZONE_CODE,
            "phone": phone,
            "code": DEFAULT_REGISTER_CODE,
            "name": name || phone,
            "password": password,
            "flag": deviceFlag,
            "device": device,
        }
        if (inviteCode && inviteCode.trim() !== "") {
            payload["invite_code"] = inviteCode.trim()
        }
        return WKApp.apiClient.post(`user/register`, payload).then(async (result: any) => {
            if (this.hasLoginPayload(result)) {
                this.loginSuccess(result)
                return
            }
            const loginUsername = this.normalizePhoneLoginUsername(phone || "")
            try {
                await this.requestLoginWithUsernameAndPwd(loginUsername, password)
            } catch (loginError: any) {
                const backendMsg: string = loginError?.msg || loginError?.error?.response?.data?.msg || "自动登录失败"
                return Promise.reject({
                    ...loginError,
                    msg: `注册成功，但自动登录失败：${backendMsg}`,
                })
            }
        }).finally(() => {
            this.registerLoading = false
            this.notifyListener()
        })
    }

    getDevice() {
        return {
            "device_id": WKApp.shared.deviceId,
            "device_name": WKApp.shared.deviceName,
            "device_model": WKApp.shared.deviceModel,
        }
    }

    loginSuccess(data:any) {
        // 兼容不同接口返回结构（例如 {data:{...}}）以及字段命名差异
        const payload = (data && typeof data === "object" && "data" in data) ? (data as any).data : data
        const loginInfo = WKApp.loginInfo
        loginInfo.appID = payload?.app_id ?? payload?.appID ?? loginInfo.appID
        loginInfo.uid = payload?.uid ?? payload?.user_uid ?? payload?.userUID ?? loginInfo.uid
        loginInfo.shortNo = payload?.short_no ?? payload?.shortNo ?? loginInfo.shortNo
        loginInfo.token = payload?.token ?? payload?.auth_token ?? payload?.authToken ?? loginInfo.token
        loginInfo.name = payload?.name ?? payload?.nickname ?? loginInfo.name
        loginInfo.sex = payload?.sex ?? loginInfo.sex
        loginInfo.save()

        if (window.location.pathname === "/login") {
            const url = new URL(window.location.href)
            url.pathname = "/"
            window.history.replaceState({}, "", url.toString())
        }
        try {
            WKApp.endpoints.callOnLogin()
        } catch (e) {
            console.error("[login] callOnLogin listener threw", e)
        }
        WKApp.shared.notifyListener()
    }
    private hasLoginPayload(data: any): boolean {
        const payload = (data && typeof data === "object" && "data" in data) ? (data as any).data : data
        const token = payload?.token ?? payload?.auth_token ?? payload?.authToken
        const uid = payload?.uid ?? payload?.user_uid ?? payload?.userUID
        return !!token && !!uid
    }

    requestUUID() {
        if (this.qrcodeLoading) {
            return
        }
        this.qrcodeLoading = true
        this.notifyListener()
        const device = this.getDevice()
        WKApp.apiClient.get('user/loginuuid',{
            param: device,
        }).then((result) => {
            this.uuid = result.uuid
            this.qrcodeLoading = false
            this.qrcode = normalizeQrcodeURL(result.qrcode)
            this.loginStatus = LoginStatus.waitScan
            this.notifyListener()
            this.advance()
        }).catch((err: any) => {
            this.qrcodeLoading = false
            this.notifyListener()
            const msg = err?.msg || err?.error?.response?.data?.msg || "获取二维码失败，请检查服务器地址或网络"
            Toast.error(msg)
        })
    }

    // 轮训登录状态
    pullLoginStatus(uuid?: string) {
        if (this.loginType !== LoginType.qrcode) {
            return
        }
        if (!uuid) {
            return
        }
        if (uuid !== this.uuid) return;
        if (this._pullErrCount >= this._pullMaxErrCount) {
            this._pullErrCount = 0
            this.loginStatus = LoginStatus.getUUID
            this.advance()
            return
        }

        WKApp.apiClient.get(`user/loginstatus?uuid=${uuid}`).then((result: any) => {
            this._pullErrCount = 0
            const loginStatus = result.status;
            this.loginStatus = loginStatus
            this.advance(result)
        }).catch(() => {
            this._pullErrCount++
            this.pullLoginStatus(uuid)
        })
    }
    showAvatar() {
        return this.loginStatus === LoginStatus.scanned && this.uid
    }
}