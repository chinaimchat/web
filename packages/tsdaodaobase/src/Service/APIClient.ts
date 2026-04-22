import axios, { AxiosResponse } from "axios";

function normalizeApiPath(url?: string): string {
    const raw = (url || "").split("?")[0].trim()
    if (!raw) return ""
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            const p = new URL(raw).pathname.replace(/^\/+/, "").toLowerCase()
            return p.replace(/^api\/v1\//, "").replace(/^v1\//, "")
        } catch {
            return ""
        }
    }
    return raw.replace(/^\/+/, "").toLowerCase().replace(/^api\/v1\//, "").replace(/^v1\//, "")
}

/** 登录/注册等接口不应携带旧 token，否则部分网关或鉴权层会对无效 token 返回 401，移动端首登表现为「请稍后重试」需刷新。 */
function isPublicApiRequest(config: { url?: string; method?: string }): boolean {
    const path = normalizeApiPath(config.url)
    if (!path) return false
    if (path === "ping") return true
    if (path === "common/appconfig" || path === "common/countries") return true
    if (path === "user/login" || path === "user/register") return true
    if (path === "user/usernamelogin" || path === "user/usernameregister") return true
    if (path === "user/loginuuid" || path === "user/loginstatus") return true
    if (path.startsWith("user/login_authcode")) return true
    if (path.startsWith("user/login/")) return true
    if (path.startsWith("user/sms/")) return true
    if (path === "user/pwdforget" || path === "user/pwdforget_web3") return true
    if (path === "user/web3verifytext" || path === "user/web3verifysign") return true
    if (path.startsWith("user/github") || path.startsWith("user/gitee")) return true
    if (path.startsWith("user/oauth/") || path.startsWith("user/thirdlogin/")) return true
    return false
}

const PREFERRED_API_URL_KEY = "tsdaodao_web_preferred_api_url"
const PREFERRED_API_URL_TTL_MS = 10 * 60 * 1000

function normalizeAPIURLs(urls?: string[]): string[] {
    if (!urls || !Array.isArray(urls)) return []
    const seen = new Set<string>()
    const out: string[] = []
    for (const raw of urls) {
        const u = (raw || "").trim()
        if (!u) continue
        if (seen.has(u)) continue
        seen.add(u)
        out.push(u)
    }
    return out
}

function readPreferredAPIURL(): string | null {
    try {
        if (typeof localStorage === "undefined") return null
        const raw = localStorage.getItem(PREFERRED_API_URL_KEY)
        if (!raw) return null
        const obj = JSON.parse(raw)
        if (!obj || typeof obj.url !== "string" || typeof obj.ts !== "number") return null
        if (Date.now() - obj.ts > PREFERRED_API_URL_TTL_MS) return null
        return obj.url
    } catch {
        return null
    }
}

function savePreferredAPIURL(url: string): void {
    try {
        if (!url || typeof localStorage === "undefined") return
        localStorage.setItem(PREFERRED_API_URL_KEY, JSON.stringify({ url, ts: Date.now() }))
    } catch {
        // ignore
    }
}

function shouldRetryWithNextHost(error: any): boolean {
    if (!error) return false
    if (error.code === "ECONNABORTED") return true
    if (!error.response) return true
    const status = error.response?.status
    return typeof status === "number" && status >= 500 && status < 600
}

export class APIClientConfig {
    private _apiURL: string =""
    private _apiURLs: string[] = []
    private _token:string = ""
    tokenCallback?:()=>string|undefined
    // private _apiURL: string = "/api/v1/" // 正式打包用此地址
    

    set apiURL(apiURL:string) {
        this._apiURL = apiURL;
        axios.defaults.baseURL = apiURL;
    }
    get apiURL():string {
        return this._apiURL
    }

    /** 多域名候选池：按顺序试错，首登成功后会写入 localStorage 作为下次首选。 */
    set apiURLs(apiURLs: string[]) {
        this._apiURLs = normalizeAPIURLs(apiURLs)
    }
    get apiURLs(): string[] {
        return this._apiURLs
    }
}

export default class APIClient {
    private constructor() {
        this.initAxios()
    }
    public static shared = new APIClient()
    public config = new APIClientConfig()
    public logoutCallback?:()=>void

    initAxios() {
        const self = this
        axios.interceptors.request.use(function (config) {
            let token:string | undefined
            if(self.config.tokenCallback) {
                token = self.config.tokenCallback()
            }
            if (token && token !== "" && !isPublicApiRequest(config)) {
                config.headers!["token"] = token;
            }
            // 多域名试错重试：按顺序把候选 baseURL 注入本次请求。
            const pool = self.config.apiURLs || []
            if (pool.length > 0) {
                const preferred = readPreferredAPIURL()
                const ordered = preferred && pool.includes(preferred)
                    ? [preferred, ...pool.filter(u => u !== preferred)]
                    : [...pool]
                ;(config as any).__apiCandidates = ordered
                ;(config as any).__apiCandidateIndex = typeof (config as any).__apiCandidateIndex === "number"
                    ? (config as any).__apiCandidateIndex
                    : 0
                config.baseURL = ordered[(config as any).__apiCandidateIndex]
            }
            return config;
        });

        axios.interceptors.response.use(function (response) {
            // 成功落地的 baseURL 写入首选，下次同端优先使用。
            const url = response?.config?.baseURL
            if (url) savePreferredAPIURL(String(url))
            return response;
        }, async function (error) {
            // 多域名试错重试：网络错误 / 5xx 自动切到下一个 host 重发。
            const cfg: any = error?.config
            const candidates: string[] = cfg?.__apiCandidates || []
            let index: number = typeof cfg?.__apiCandidateIndex === "number" ? cfg.__apiCandidateIndex : 0
            if (cfg && candidates.length > 0 && index < candidates.length - 1 && shouldRetryWithNextHost(error)) {
                cfg.__apiCandidateIndex = index + 1
                cfg.baseURL = candidates[index + 1]
                return axios.request(cfg)
            }
            var msg = "";
            const status = error.response && error.response.status
            const dataMsg = error.response?.data && (error.response.data as any).msg
            switch (status) {
                case 400:
                    msg = dataMsg || "请求参数错误"
                    break;
                case 404:
                    msg = "请求地址没有找到（404）"
                    break;
                case 401:
                    msg = dataMsg || "请先登录"
                    if (self.logoutCallback && error.config && !isPublicApiRequest(error.config)) {
                        self.logoutCallback()
                    }
                    break;
                default:
                    msg = dataMsg || "未知错误"
                    break;
            }
            return Promise.reject({ error: error, msg: msg, status: error?.response?.status });
        });
    }

     get<T>(path: string, config?: RequestConfig) {
       return this.wrapResult<T>(axios.get(path, {
        params: config?.param
    }), config)
    }
    post(path: string, data?: any, config?: RequestConfig) {
        return this.wrapResult(axios.post(path, data, {}), config)
    }

    put(path: string, data?: any, config?: RequestConfig) {
        return this.wrapResult(axios.put(path, data, {
            params: config?.param,
        }), config)
    }

    delete(path: string, config?: RequestConfig) {
        return this.wrapResult(axios.delete(path, {
            params: config?.param,
            data: config?.data,
        }), config)
    }

    private async wrapResult<T = APIResp>(result: Promise<AxiosResponse>, config?: RequestConfig): Promise<T|any> {
        if (!result) {
            return Promise.reject()
        }
        
        return  result.then((value) => {
          
            if (!config || !config.resp) {
                
                return Promise.resolve(value.data)
            }
            if (value.data) {
                const results = new Array<T>()
                if (value.data instanceof Array) {
                    for (const data of value.data) {
                        var resp = config.resp()
                        resp.fill(data)
                        results.push(resp as unknown as T)
                    }
                    return results
                } else {
                    var sresp = config.resp()
                    sresp.fill(value.data)
                    return Promise.resolve(sresp)
                }
            }
            return Promise.resolve()
        })
    }
}

export class RequestConfig {
    param?: any
    data?:any
    resp?: () => APIResp
}

export interface APIResp {

    fill(data: any): void;
}