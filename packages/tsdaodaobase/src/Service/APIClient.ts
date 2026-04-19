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

export class APIClientConfig {
    private _apiURL: string =""
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
            return config;
        });

        axios.interceptors.response.use(function (response) {
            return response;
        }, function (error) {
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