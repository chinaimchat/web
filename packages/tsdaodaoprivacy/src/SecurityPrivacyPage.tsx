import React, { Component } from "react";
import {
  WKApp,
  Row,
  Section,
  ListItem,
  ListItemSwitch,
  ListItemIcon,
  Sections,
  RoutePage,
} from "@tsdaodao/base";
import { Toast } from "@douyinfe/semi-ui";

/** 黑名单项（服务端返回） */
interface BlacklistItem {
  uid: string;
  name?: string;
  usename?: string;
}

/** 设备项（服务端返回） */
interface DeviceItem {
  device_id: string;
  device_name?: string;
  device_flag?: number;
  last_login?: number;
}

interface SecurityPrivacyPageState {
  blacklists: BlacklistItem[];
  devices: DeviceItem[];
  loading: boolean;
  /** 隐私/我的设置（与 PUT /user/my/setting 字段一致） */
  search_by_phone: number;
  search_by_short: number;
  new_msg_notice: number;
  msg_show_detail: number;
  offline_protection: number;
  voice_on: number;
  shock_on: number;
  mute_of_app: number;
  device_lock: number;
}

const DEFAULT_SETTINGS = {
  search_by_phone: 0,
  search_by_short: 0,
  new_msg_notice: 1,
  msg_show_detail: 1,
  offline_protection: 0,
  voice_on: 1,
  shock_on: 1,
  mute_of_app: 0,
  device_lock: 0,
};

export default class SecurityPrivacyPage extends Component<{}, SecurityPrivacyPageState> {
  state: SecurityPrivacyPageState = {
    blacklists: [],
    devices: [],
    loading: false,
    ...DEFAULT_SETTINGS,
  };

  private _isMounted = false;
  componentDidMount() {
    this._isMounted = true;
    this.loadBlacklists();
    this.loadDevices();
    this.loadMySettings();
  }
  componentWillUnmount() {
    this._isMounted = false;
  }

  /** GET /user/blacklists 返回数组 */
  loadBlacklists = () => {
    WKApp.apiClient.get("user/blacklists").then((res: BlacklistItem[] | { list?: BlacklistItem[] }) => {
      if (!this._isMounted) return;
      const list = Array.isArray(res) ? res : (res?.list || []);
      this.setState({ blacklists: list });
    }).catch(() => {});
  };

  /** GET /user/devices 返回 { list: DeviceItem[] } 或数组 */
  loadDevices = () => {
    WKApp.apiClient.get("user/devices").then((res: DeviceItem[] | { list?: DeviceItem[] }) => {
      if (!this._isMounted) return;
      const list = Array.isArray(res) ? res : (res?.list || []);
      this.setState({ devices: list });
    }).catch(() => {});
  };

  /** 从 GET /users/:uid 解析设置（若返回 orgData.setting 或顶层） */
  loadMySettings = () => {
    const uid = WKApp.loginInfo.uid;
    if (!uid) return;
    WKApp.apiClient.get(`users/${uid}`).then((data: Record<string, unknown>) => {
      if (!this._isMounted) return;
      const orgData = data?.orgData as Record<string, unknown> | undefined;
      const setting = ((data?.setting ?? orgData?.setting) || {}) as Record<string, number>;
      this.setState({
        search_by_phone: setting.search_by_phone ?? DEFAULT_SETTINGS.search_by_phone,
        search_by_short: setting.search_by_short ?? DEFAULT_SETTINGS.search_by_short,
        new_msg_notice: setting.new_msg_notice ?? DEFAULT_SETTINGS.new_msg_notice,
        msg_show_detail: setting.msg_show_detail ?? DEFAULT_SETTINGS.msg_show_detail,
        offline_protection: setting.offline_protection ?? DEFAULT_SETTINGS.offline_protection,
        voice_on: setting.voice_on ?? DEFAULT_SETTINGS.voice_on,
        shock_on: setting.shock_on ?? DEFAULT_SETTINGS.shock_on,
        mute_of_app: setting.mute_of_app ?? DEFAULT_SETTINGS.mute_of_app,
        device_lock: setting.device_lock ?? DEFAULT_SETTINGS.device_lock,
      });
    }).catch(() => {});
  };

  /** PUT /user/my/setting */
  updateMySetting = (key: string, value: number) => {
    return WKApp.apiClient.put("user/my/setting", { [key]: value });
  };

  /** DELETE /user/blacklist/:uid */
  removeBlacklist = (uid: string) => {
    WKApp.apiClient.delete(`user/blacklist/${uid}`).then(() => {
      Toast.success("已移出黑名单");
      this.loadBlacklists();
    }).catch((err: { msg?: string }) => Toast.error(err?.msg || "操作失败"));
  };

  /** DELETE /user/devices/:device_id */
  deleteDevice = (deviceId: string) => {
    WKApp.apiClient.delete(`user/devices/${deviceId}`).then(() => {
      Toast.success("已移除设备");
      this.loadDevices();
    }).catch((err: { msg?: string }) => Toast.error(err?.msg || "操作失败"));
  };

  render() {
    const {
      blacklists,
      devices,
      search_by_phone,
      search_by_short,
      new_msg_notice,
      msg_show_detail,
      offline_protection,
      voice_on,
      shock_on,
      mute_of_app,
      device_lock,
    } = this.state;

    const sections: Section[] = [
      new Section({
        title: "账号安全",
        rows: [
          new Row({
            cell: ListItem,
            properties: {
              title: "修改密码",
              subTitle: "修改登录密码",
              onClick: () => {
                const oldPwd = window.prompt("请输入当前密码");
                if (oldPwd == null) return;
                const newPwd = window.prompt("请输入新密码");
                if (newPwd == null) return;
                if (!newPwd.trim()) {
                  Toast.error("新密码不能为空");
                  return;
                }
                WKApp.apiClient.put("user/updatepassword", {
                  password: oldPwd,
                  new_password: newPwd,
                }).then(() => {
                  Toast.success("密码已修改");
                }).catch((err: { msg?: string }) => Toast.error(err?.msg || "修改失败"));
              },
            },
          }),
          new Row({
            cell: ListItem,
            properties: {
              title: "注销账号",
              subTitle: "注销后数据无法恢复",
              onClick: () => {
                if (!window.confirm("确定要注销账号吗？注销后无法恢复。")) return;
                WKApp.apiClient.post("user/sms/destroy", {}).then(() => {
                  const code = window.prompt("请输入短信验证码");
                  if (!code) return;
                  WKApp.apiClient.delete(`user/destroy/${code}`).then(() => {
                    Toast.success("账号已注销");
                    WKApp.shared.logout();
                  }).catch((err: { msg?: string }) => Toast.error(err?.msg || "注销失败"));
                }).catch((err: { msg?: string }) => Toast.error(err?.msg || "获取验证码失败"));
              },
            },
          }),
        ],
      }),
      new Section({
        title: "黑名单",
        rows: blacklists.length === 0
          ? [new Row({
              cell: ListItem,
              properties: {
                title: "暂无黑名单",
                subTitle: "拉黑后对方无法给你发消息",
                onClick: () => {},
              },
            })]
          : blacklists.map((b) =>
              new Row({
                cell: ListItemIcon,
                properties: {
                  title: b.name || b.uid,
                  icon: (
                    <img
                      style={{ width: 24, height: 24, borderRadius: "50%" }}
                      src={WKApp.shared.avatarUser(b.uid)}
                      alt=""
                    />
                  ),
                  onClick: () => {
                    if (window.confirm(`确定将 ${b.name || b.uid} 移出黑名单？`)) {
                      this.removeBlacklist(b.uid);
                    }
                  },
                },
              })
            ),
      }),
      new Section({
        title: "设备管理",
        rows: devices.length === 0
          ? [new Row({
              cell: ListItem,
              properties: { title: "暂无其他设备", subTitle: "当前登录设备会显示在这里", onClick: () => {} },
            })]
          : devices.map((d) =>
              new Row({
                cell: ListItemIcon,
                properties: {
                  title: d.device_name || d.device_id || "未知设备",
                  icon: <span style={{ fontSize: 12 }}>{d.device_id.slice(0, 8)}…</span>,
                  onClick: () => {
                    if (window.confirm("确定移除此设备登录？")) this.deleteDevice(d.device_id);
                  },
                },
              })
            ),
      }),
      new Section({
        title: "隐私设置",
        rows: [
          new Row({
            cell: ListItemSwitch,
            properties: {
              title: "通过手机号搜索我",
              checked: search_by_phone === 1,
              onCheck: (v: boolean, ctx) => {
                ctx.loading = true;
                this.updateMySetting("search_by_phone", v ? 1 : 0).then(() => {
                  this.setState({ search_by_phone: v ? 1 : 0 });
                  ctx.loading = false;
                }).catch(() => { ctx.loading = false; });
              },
            },
          }),
          new Row({
            cell: ListItemSwitch,
            properties: {
              title: "通过短号搜索我",
              checked: search_by_short === 1,
              onCheck: (v: boolean, ctx) => {
                ctx.loading = true;
                this.updateMySetting("search_by_short", v ? 1 : 0).then(() => {
                  this.setState({ search_by_short: v ? 1 : 0 });
                  ctx.loading = false;
                }).catch(() => { ctx.loading = false; });
              },
            },
          }),
          new Row({
            cell: ListItemSwitch,
            properties: {
              title: "新消息通知",
              checked: new_msg_notice === 1,
              onCheck: (v: boolean, ctx) => {
                ctx.loading = true;
                this.updateMySetting("new_msg_notice", v ? 1 : 0).then(() => {
                  this.setState({ new_msg_notice: v ? 1 : 0 });
                  ctx.loading = false;
                }).catch(() => { ctx.loading = false; });
              },
            },
          }),
          new Row({
            cell: ListItemSwitch,
            properties: {
              title: "显示消息详情",
              checked: msg_show_detail === 1,
              onCheck: (v: boolean, ctx) => {
                ctx.loading = true;
                this.updateMySetting("msg_show_detail", v ? 1 : 0).then(() => {
                  this.setState({ msg_show_detail: v ? 1 : 0 });
                  ctx.loading = false;
                }).catch(() => { ctx.loading = false; });
              },
            },
          }),
          new Row({
            cell: ListItemSwitch,
            properties: {
              title: "离线保护",
              checked: offline_protection === 1,
              onCheck: (v: boolean, ctx) => {
                ctx.loading = true;
                this.updateMySetting("offline_protection", v ? 1 : 0).then(() => {
                  this.setState({ offline_protection: v ? 1 : 0 });
                  ctx.loading = false;
                }).catch(() => { ctx.loading = false; });
              },
            },
          }),
          new Row({
            cell: ListItemSwitch,
            properties: {
              title: "声音",
              checked: voice_on === 1,
              onCheck: (v: boolean, ctx) => {
                ctx.loading = true;
                this.updateMySetting("voice_on", v ? 1 : 0).then(() => {
                  this.setState({ voice_on: v ? 1 : 0 });
                  ctx.loading = false;
                }).catch(() => { ctx.loading = false; });
              },
            },
          }),
          new Row({
            cell: ListItemSwitch,
            properties: {
              title: "震动",
              checked: shock_on === 1,
              onCheck: (v: boolean, ctx) => {
                ctx.loading = true;
                this.updateMySetting("shock_on", v ? 1 : 0).then(() => {
                  this.setState({ shock_on: v ? 1 : 0 });
                  ctx.loading = false;
                }).catch(() => { ctx.loading = false; });
              },
            },
          }),
          new Row({
            cell: ListItemSwitch,
            properties: {
              title: "应用静音",
              checked: mute_of_app === 1,
              onCheck: (v: boolean, ctx) => {
                ctx.loading = true;
                this.updateMySetting("mute_of_app", v ? 1 : 0).then(() => {
                  this.setState({ mute_of_app: v ? 1 : 0 });
                  ctx.loading = false;
                }).catch(() => { ctx.loading = false; });
              },
            },
          }),
          new Row({
            cell: ListItemSwitch,
            properties: {
              title: "设备锁",
              checked: device_lock === 1,
              onCheck: (v: boolean, ctx) => {
                ctx.loading = true;
                this.updateMySetting("device_lock", v ? 1 : 0).then(() => {
                  this.setState({ device_lock: v ? 1 : 0 });
                  ctx.loading = false;
                }).catch((err: { msg?: string }) => {
                  ctx.loading = false;
                  Toast.error(err?.msg || "设置失败");
                });
              },
            },
          }),
        ],
      }),
      new Section({
        title: "锁屏与密码",
        rows: [
          new Row({
            cell: ListItem,
            properties: {
              title: "聊天密码",
              subTitle: "设置后进入聊天需输入密码",
              onClick: () => {
                const pwd = window.prompt("设置聊天密码（留空则不设置）");
                if (pwd == null) return;
                WKApp.apiClient.post("user/chatpwd", { password: pwd }).then(() => {
                  Toast.success("已设置");
                }).catch((err: { msg?: string }) => Toast.error(err?.msg || "设置失败"));
              },
            },
          }),
          new Row({
            cell: ListItem,
            properties: {
              title: "锁屏密码",
              subTitle: "设置锁屏后再次打开需输入密码",
              onClick: () => {
                const pwd = window.prompt("设置锁屏密码（留空则关闭）");
                if (pwd == null) return;
                if (pwd === "") {
                  WKApp.apiClient.delete("user/lockscreenpwd").then(() => Toast.success("已关闭锁屏密码")).catch((e: { msg?: string }) => Toast.error(e?.msg));
                  return;
                }
                WKApp.apiClient.post("user/lockscreenpwd", { password: pwd }).then(() => {
                  Toast.success("已设置");
                }).catch((err: { msg?: string }) => Toast.error(err?.msg || "设置失败"));
              },
            },
          }),
          new Row({
            cell: ListItem,
            properties: {
              title: "锁屏时间",
              subTitle: "设置多少分钟后自动锁屏",
              onClick: () => {
                const min = window.prompt("多少分钟后锁屏？", "5");
                if (min == null) return;
                const n = parseInt(min, 10);
                if (isNaN(n) || n < 0) {
                  Toast.error("请输入有效数字");
                  return;
                }
                WKApp.apiClient.put("user/lock_after_minute", { lock_after_minute: n }).then(() => {
                  Toast.success("已设置");
                }).catch((err: { msg?: string }) => Toast.error(err?.msg || "设置失败"));
              },
            },
          }),
        ],
      }),
    ];

    return (
      <RoutePage
        title="安全与隐私"
        render={() => (
          <div className="wk-sections">
            <Sections sections={sections} />
          </div>
        )}
      />
    );
  }
}
