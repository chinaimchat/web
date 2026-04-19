import { ChannelSettingRouteData, ChannelTypeCustomerService, GroupRole, IModule, WKApp, ListItem, ListItemSwitch, ListItemSwitchContext, Row, Section } from "@tsdaodao/base"
import { ChannelSettingManager } from "@tsdaodao/base/src/Service/ChannelSetting";
import { RouteContextConfig } from "@tsdaodao/base/src/Service/Context";
import {  ChannelTypeGroup } from "wukongimjssdk";
import React from "react";


export default class AdvancedModule implements IModule {

    id(): string {
        return "AdvancedModule"
    }
    init(): void {
        console.log("【AdvancedModule】初始化")

        // 消息回执
        WKApp.shared.channelSettingRegister("channel.setting.receipt", (context) => {
            const data = context.routeData() as ChannelSettingRouteData
            const channelInfo = data.channelInfo
            const channel = data.channel
            const rows = new Array<Row>()

            if (channel.channelType == ChannelTypeCustomerService) {
                return
            }
            rows.push(new Row({
                cell: ListItemSwitch,
                properties: {
                    title: "消息回执",
                    checked: channelInfo?.orgData.receipt === 1,
                    onCheck: (v: boolean, ctx: ListItemSwitchContext) => {
                        ctx.loading = true
                        ChannelSettingManager.shared.receipt(v, channel).then(() => {
                            ctx.loading = false
                            data.refresh()
                        }).catch(() => {
                            ctx.loading = false
                        })
                    }

                },
            }))
            return new Section({
                rows: rows,
            })


        },3100)

    }
}