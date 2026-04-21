import { Channel, ChannelInfo, ChannelTypePerson, Subscriber, WKSDK } from "wukongimjssdk";
import { GroupRole } from "../../Service/Const";
import WKApp from "../../App";
import RouteContext, { RouteContextConfig } from "../../Service/Context";
import ConversationContext from "../Conversation/context";


export class ChannelSettingRouteData {
     channel!:Channel
     channelInfo?:ChannelInfo
     subscribers!:Subscriber[] // 成员列表（所有状态为正常状态的成员）
     subscriberOfMe?:Subscriber
     subscriberAll!:Subscriber[] //成员列表，所有状态的成员，比如：黑名单内的成员
     refresh!:()=>void // 刷新
     conversationContext?:ConversationContext

     // 我是否是管理者或创建者
     get isManagerOrCreatorOfMe() {
        if (this.subscriberOfMe?.role === GroupRole.manager || this.subscriberOfMe?.role === GroupRole.owner) {
            return true
        }
        const loginUID = WKApp.loginInfo?.uid
        if (!loginUID) {
            return false
        }
        const meInfo = WKSDK.shared().channelManager.getChannelInfo(new Channel(loginUID, ChannelTypePerson))
        const me = WKSDK.shared().channelManager.getChannel(loginUID, ChannelTypePerson)
        const category = meInfo?.orgData?.category ?? (meInfo as any)?.category ?? (me as any)?.category
        return category === "system" || category === "customerService"
     }

}

// export interface ChannelSettingContext extends RouteContext{
//      channel(): Channel
//      channelInfo(): ChannelInfo 
//      subscribers(): Subscriber[] // 订阅者列表
//      subscriberOfMe(): Subscriber | undefined // 当前用户订阅者信息
    
// }