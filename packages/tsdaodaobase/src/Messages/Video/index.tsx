import { MessageContent } from "wukongimjssdk";
import React from "react";
import WKApp from "../../App";
import MessageBase from "../Base";
import MessageTrail from "../Base/tail";
import { MessageCell } from "../MessageCell";
import { MessageContentTypeConst } from "../../Service/Const";
import "./index.css"

export class VideoContent extends MessageContent {
    url!: string
    cover!: string
    size: number = 0
    width!: number
    height!: number
    second!: number

    constructor() {
        super()
        this.contentType = MessageContentTypeConst.smallVideo
    }

    decodeJSON(content: any) {
        this.url = content["url"] || ""
        this.cover = content["cover"] || ""
        this.size = content["size"] || 0
        this.width = content["width"] || 0
        this.height = content["height"] || 0
        this.second = content["second"] || 0
    }

    encodeJSON() {
        return { "url": this.url || "", "cover": this.cover || "", "size": this.size || 0,"width":this.width||0,"height":this.height||0,"second":this.second||0 }
    }

    get conversationDigest() {
        return "[小视频]"
    }

}

interface VideoCellState {
    playProgress: number // 播放进度
}

export class VideoCell extends MessageCell<any, VideoCellState> {

    constructor(props: any) {
        super(props)
        this.state = {
            playProgress: 0,
        }

    }
    componentDidMount() {


    }

    componentWillUnmount() {
    }

    secondFormat(second: number): string {

        const minute = parseInt(`${( second / 60)}`)
        const realSecond = parseInt(`${second % 60}`)

        let minuteFormat = ""
        if (minute > 9) {
            minuteFormat = `${minute}`
        } else {
            minuteFormat = `0${minute}`
        }

        let secondFormat = ""
        if (realSecond > 9) {
            secondFormat = `${realSecond}`
        } else {
            secondFormat = `0${realSecond}`
        }

        return `${minuteFormat}:${secondFormat}`
    }

    videoScale(orgWidth: number, orgHeight: number, maxWidth = 380, maxHeight = 380) {
        let actSize = { width: orgWidth, height: orgHeight };
        if (orgWidth > orgHeight) {//横图
            if (orgWidth > maxWidth) { // 横图超过最大宽度
                let rate = maxWidth / orgWidth; // 缩放比例
                actSize.width = maxWidth;
                actSize.height = orgHeight * rate;
            }
        } else if (orgWidth < orgHeight) { //竖图
            if (orgHeight > maxHeight) {
                let rate = maxHeight / orgHeight; // 缩放比例
                actSize.width = orgWidth * rate;
                actSize.height = maxHeight;
            }
        } else if (orgWidth === orgHeight) {
            if (orgWidth > maxWidth) {
                let rate = maxWidth / orgWidth; // 缩放比例
                actSize.width = maxWidth;
                actSize.height = orgHeight * rate;
            }
        }
        return actSize;
    }
    getVideoData(): { url: string; cover: string; width: number; height: number; second: number } {
        const raw = this.props.message.content as any
        const obj = raw?.contentObj ?? raw
        return {
            url: obj?.url ?? raw?.url ?? "",
            cover: obj?.cover ?? raw?.cover ?? "",
            width: obj?.width ?? raw?.width ?? 0,
            height: obj?.height ?? raw?.height ?? 0,
            second: obj?.second ?? raw?.second ?? 0,
        }
    }

    render() {
        const { message, context } = this.props
        const { playProgress } = this.state
        const content = this.getVideoData()
        if (!content.url && !content.cover) return null
        const actSize = this.videoScale(content.width || 360, content.height || 360)
        return <MessageBase message={message} context={context}>

            <div className="wk-message-video" style={{ width: actSize.width, height: '100%', position: 'relative' }}>
                <div className="wk-message-video-content">
                    <span className="wk-message-video-content-time">{this.secondFormat(content.second - playProgress)}</span>
                    <div className="wk-message-video-content-video">
                        <video poster={WKApp.dataSource.commonDataSource.getImageURL(content.cover)} width={actSize.width} height={actSize.height} controls onTimeUpdate={(evet) => {
                            const video = evet.target as HTMLVideoElement
                            this.setState({
                                playProgress: video.currentTime,
                            })
                        }} onEnded={() => {
                            this.setState({
                                playProgress: 0,
                            })
                        }}>
                            <source src={WKApp.dataSource.commonDataSource.getFileURL(content.url)} type="video/mp4" />
                        </video>
                    </div>
                </div>
                <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.45)', borderRadius: 8, padding: '1px 6px', lineHeight: '18px' }}>
                    <MessageTrail message={message} timeStyle={{ color: 'rgba(255,255,255,0.9)' }} statusStyle={{ color: 'rgba(255,255,255,0.9)' }} />
                </div>
            </div>
        </MessageBase>
    }
}