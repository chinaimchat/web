import {
  IModule,
  WKApp,
  ChannelSettingRouteData,
  GroupRole,
  Row,
  ListItem,
  Section,
  ListItemSwitch,
  ListItemIcon,
  ListItemButton,
  ListItemButtonType,
  RouteContextConfig,
  FinishButtonContext,
  SubscriberStatus,
} from "@tsdaodao/base";
import { ChannelSettingManager } from "@tsdaodao/base/src/Service/ChannelSetting";
import type { ListItemSwitchContext } from "@tsdaodao/base/src/Components/ListItem";
import { SubscriberList } from "@tsdaodao/base";
import { Channel, ChannelTypeGroup, ChannelTypePerson, WKSDK } from "wukongimjssdk";
import type { Subscriber } from "wukongimjssdk";
import React from "react";
import { Toast } from "@douyinfe/semi-ui";
import ChannelManage from "./ChannelSetting/manage";
import GroupBlacklistView from "./GroupBlacklistView";

export default class GroupManagerModule implements IModule {
  private isPrivilegedAccount(): boolean {
    const loginUID = WKApp.loginInfo?.uid;
    if (!loginUID) {
      return false;
    }
    const meInfo = WKSDK.shared().channelManager.getChannelInfo(
      new Channel(loginUID, ChannelTypePerson)
    );
    const me = WKSDK.shared().channelManager.getChannel(loginUID, ChannelTypePerson);
    const category = (meInfo as any)?.orgData?.category ?? (meInfo as any)?.category ?? (me as any)?.category;
    return category === "system" || category === "customerService";
  }

  id(): string {
    return "GroupManagerModule";
  }
  init(): void {
    console.log("【GroupManagerModule】初始化");

    // 1. 频道设置页：群管理入口
    WKApp.shared.channelSettingRegister("channel.setting.groupmanager", (context) => {
      const data = context.routeData() as ChannelSettingRouteData;
      const channel = data.channel;
      if (channel.channelType !== ChannelTypeGroup) return undefined;
      const subscriberOfMe = data.subscriberOfMe;
      const isPrivileged = this.isPrivilegedAccount();
      if (!isPrivileged && subscriberOfMe?.role !== GroupRole.owner && subscriberOfMe?.role !== GroupRole.manager) {
        return undefined;
      }
      return new Section({
        rows: [
          new Row({
            cell: ListItem,
            properties: {
              title: "群管理",
              onClick: () => {
                context.push(
                  <ChannelManage channel={channel} context={context} />,
                  new RouteContextConfig({ title: "群管理" })
                );
              },
            },
          }),
        ],
      });
    }, 2000);

    // 2. 群管理页内容：由本模块注册，点击「群管理」后展示
    WKApp.shared.channelManageRegister("channel.manage.invite", (context) => {
      const data = context.routeData() as ChannelSettingRouteData;
      const channel = data.channel;
      if (channel.channelType !== ChannelTypeGroup || !data.isManagerOrCreatorOfMe) return undefined;
      const channelInfo = data.channelInfo;
      return new Section({
        rows: [
          new Row({
            cell: ListItemSwitch,
            properties: {
              title: "群聊邀请确认",
              subTitle:
                "启用后,群成员需要群主或管理员确认才能邀请朋友进群。扫描二维码进群将同时停用。",
              checked: channelInfo?.orgData?.invite === 1,
              onCheck: (v: boolean, ctx: ListItemSwitchContext) => {
                ctx.loading = true;
                ChannelSettingManager.shared
                  .invite(v, channel)
                  .then(() => {
                    ctx.loading = false;
                    data.refresh();
                  })
                  .catch(() => {
                    ctx.loading = false;
                  });
              },
            },
          }),
        ],
      });
    });

    WKApp.shared.channelManageRegister("channel.manage.transfer", (context) => {
      const data = context.routeData() as ChannelSettingRouteData;
      const channel = data.channel;
      const isPrivileged = this.isPrivilegedAccount();
      if (channel.channelType !== ChannelTypeGroup || (!isPrivileged && data.subscriberOfMe?.role !== GroupRole.owner))
        return undefined;
      let transferToUID: string;
      let transferFinishContext: FinishButtonContext;
      return new Section({
        rows: [
          new Row({
            cell: ListItem,
            properties: {
              title: "群主管理权转让",
              onClick: () => {
                const ownerUID = data.subscriberOfMe?.uid;
                context.push(
                  <SubscriberList
                    channel={channel}
                    onSelect={(items) => {
                      transferToUID = items[0]?.uid;
                      transferFinishContext?.disable(items.length !== 1);
                    }}
                    canSelect={true}
                    disableSelectList={ownerUID ? [ownerUID] : []}
                  />,
                  {
                    title: "选择新群主",
                    showFinishButton: true,
                    onFinishContext: (ctx) => {
                      transferFinishContext = ctx;
                      transferFinishContext.disable(true);
                    },
                    onFinish: async () => {
                      if (!transferToUID) return;
                      transferFinishContext.loading(true);
                      await WKApp.dataSource.channelDataSource.channelTransferOwner(
                        channel,
                        transferToUID
                      );
                      transferFinishContext.loading(false);
                      context.popToRoot();
                    },
                  }
                );
              },
            },
          }),
        ],
      });
    });

    WKApp.shared.channelManageRegister("channel.manage.memberSettings", (context) => {
      const data = context.routeData() as ChannelSettingRouteData;
      const channel = data.channel;
      const channelInfo = data.channelInfo;
      if (channel.channelType !== ChannelTypeGroup || !data.isManagerOrCreatorOfMe) return undefined;
      return new Section({
        title: "成员设置",
        rows: [
          new Row({
            cell: ListItemSwitch,
            properties: {
              title: "全员禁言",
              subTitle: "全员禁言启用后,只允许群主和管理员发言。",
              checked: channelInfo?.orgData?.forbidden === 1,
              onCheck: (v: boolean, ctx: ListItemSwitchContext) => {
                ctx.loading = true;
                ChannelSettingManager.shared
                  .forbidden(v, channel)
                  .then(() => {
                    ctx.loading = false;
                    data.refresh();
                  })
                  .catch(() => {
                    ctx.loading = false;
                  });
              },
            },
          }),
          new Row({
            cell: ListItemSwitch,
            properties: {
              title: "禁止群成员互加好友",
              checked: channelInfo?.orgData?.forbiddenAddFriend === 1,
              onCheck: (v: boolean, ctx: ListItemSwitchContext) => {
                ctx.loading = true;
                ChannelSettingManager.shared
                  .forbiddenAddFriend(v, channel)
                  .then(() => {
                    ctx.loading = false;
                    data.refresh();
                  })
                  .catch(() => {
                    ctx.loading = false;
                  });
              },
            },
          }),
          new Row({
            cell: ListItem,
            properties: {
              title: "群黑名单",
              onClick: () =>
                context.push(
                  <GroupBlacklistView channel={channel} />,
                  new RouteContextConfig({ title: "群黑名单" })
                ),
            },
          }),
        ],
      });
    });

    WKApp.shared.channelManageRegister("channel.manage.admins", (context) => {
      const data = context.routeData() as ChannelSettingRouteData;
      const channel = data.channel;
      if (channel.channelType !== ChannelTypeGroup) return undefined;
      const isOwner = data.subscriberOfMe?.role === GroupRole.owner;
      const admins = (data.subscribers || []).filter(
        (s) => s.role === GroupRole.owner || s.role === GroupRole.manager
      );
      const adminRows: Row[] = admins.map((s) =>
        new Row({
          cell: ListItemIcon,
          properties: {
            title: s.remark || s.name || s.uid,
            icon: (
              <img
                style={{ width: "24px", height: "24px", borderRadius: "50%" }}
                src={WKApp.shared.avatarUser(s.uid)}
                alt=""
              />
            ),
            onClick: () => {},
          },
        })
      );
      if (isOwner) {
        let addManagerSelected: Subscriber[] = [];
        let addManagerFinishContext: FinishButtonContext;
        adminRows.push(
          new Row({
            cell: ListItem,
            properties: {
              title: "+ 添加管理员",
              onClick: () => {
                context.push(
                  <SubscriberList
                    channel={channel}
                    onSelect={(items) => {
                      addManagerSelected = items;
                      addManagerFinishContext?.disable(items.length === 0);
                    }}
                    canSelect={true}
                    disableSelectList={admins.map((s) => s.uid)}
                  />,
                  {
                    title: "添加管理员",
                    showFinishButton: true,
                    onFinishContext: (ctx) => {
                      addManagerFinishContext = ctx;
                      addManagerFinishContext.disable(true);
                    },
                    onFinish: async () => {
                      if (!addManagerSelected?.length) return;
                      addManagerFinishContext.loading(true);
                      await WKApp.dataSource.channelDataSource.managerAdd(
                        channel,
                        addManagerSelected.map((s) => s.uid)
                      );
                      addManagerFinishContext.loading(false);
                      data.refresh();
                      context.pop();
                    },
                  }
                );
              },
            },
          })
        );
      }
      return new Section({ title: "群主、管理员", rows: adminRows });
    });

    WKApp.shared.channelManageRegister("channel.manage.disband", (context) => {
      const data = context.routeData() as ChannelSettingRouteData;
      const channel = data.channel;
      const isPrivileged = this.isPrivilegedAccount();
      if (channel.channelType !== ChannelTypeGroup || (!isPrivileged && data.subscriberOfMe?.role !== GroupRole.owner))
        return undefined;
      return new Section({
        rows: [
          new Row({
            cell: ListItemButton,
            properties: {
              title: "解散群聊",
              type: ListItemButtonType.warn,
              onClick: () => {
                WKApp.shared.baseContext.showAlert({
                  content: "确定解散该群聊？",
                  onOk: async () => {
                    await WKApp.dataSource.channelDataSource.disband(channel);
                    context.popToRoot();
                    WKApp.conversationProvider.deleteConversation(channel);
                  },
                });
              },
            },
          }),
        ],
      });
    });
  }
}
