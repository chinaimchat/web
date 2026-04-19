import { Channel, ChannelInfo, ChannelTypePerson, WKSDK } from "wukongimjssdk";
import React from "react";
import { Component } from "react";
import { ChannelInfoListener, SubscriberChangeListener } from "wukongimjssdk";
import RouteContext from "@tsdaodao/base/src/Service/Context";
import { ChannelSettingRouteData, WKApp } from "@tsdaodao/base";
import Sections from "@tsdaodao/base/src/Components/Sections";


export interface ChannelManageProps {
    channel: Channel
    context: RouteContext<ChannelSettingRouteData>
}

export interface ChannelManageState {
}

export default class ChannelManage extends Component<ChannelManageProps, ChannelManageState> {
    channelInfoListener!:ChannelInfoListener
    subscriberChangeListener?: SubscriberChangeListener
    constructor(props:any) {
        super(props)
        this.state = {
            sections: [],
        }
    }

    componentDidMount() {
        const { channel } = this.props
        if(channel.channelType !== ChannelTypePerson) {
            this.subscriberChangeListener = () => {
                this.setState({})
            }
            WKSDK.shared().channelManager.addSubscriberChangeListener(this.subscriberChangeListener)
            // WKSDK.shared().channelManager.syncSubscribes(this.channel)
        }

        this.channelInfoListener = (channelInfo:ChannelInfo) => {
           this.setState({})
        }
        WKSDK.shared().channelManager.addListener(this.channelInfoListener)
    }
    componentWillUnmount() {
        if(this.subscriberChangeListener) {
            WKSDK.shared().channelManager.removeSubscriberChangeListener(this.subscriberChangeListener)
        }
        WKSDK.shared().channelManager.removeListener(this.channelInfoListener)
    }
    render() {
        const { context } = this.props
        context.routeData().refresh = ()=> {
            this.setState({})
        }
        return <div className="wk-channelmanage">
            {
                <Sections sections={WKApp.shared.channelManages(context)}></Sections>
            }
        </div>
    }
}