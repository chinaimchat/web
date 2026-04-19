import { MediaMessageContent } from "wukongimjssdk"
import React from "react"
import { MessageContentTypeConst,FileHelper, MessageCell, MessageBaseCellProps, MessageBase, MessageTrail, WKApp } from "@tsdaodao/base"
import "./index.css"

export class FileContent extends MediaMessageContent {
    size?: number
    name?: string
    constructor(file?: File) {
        super()
        if(file) {
            this.file = file
            this.size = file.size
            this.name = file.name
            this.extension = FileHelper.getFileExt(file.name)
        }
       
    }
    decodeJSON(content: any) {
        this.size = content["size"] || 0
        this.name = content["name"] || ""
        this.url = content["url"] || ''
        this.remoteUrl = this.url
    }
    encodeJSON() {
        return { "size": this.size || 0, "name": this.name || "", "url": this.remoteUrl || "" }
    }
    get contentType() {
        return MessageContentTypeConst.file
    }
    get conversationDigest() {
        return "[文件]"
    }

    public set url(url:string) {
        this.remoteUrl = url
    }
    public get url() {
        return this.remoteUrl
    }
}


export class FileCell extends MessageCell<MessageBaseCellProps> {
    fileIconInfo: any
    constructor(props: any) {
        super(props)
        const { message } = this.props
        const content = message.content as FileContent
        this.fileIconInfo = FileHelper.getFileIconInfo(content.name || "")
    }

    render() {
        const { message,context } = this.props
        const content = message.content as FileContent
        const isSend = message.send;
       let downloadURL = WKApp.dataSource.commonDataSource.getImageURL(content.url || '')
       if(downloadURL.indexOf("?")!=-1) {
         downloadURL += "&filename=" + content.name
       }else {
        downloadURL += "?filename=" + content.name
       }
        return <MessageBase context={context} message={message} bubbleStyle={{ padding: '0px' }}>
            <div className="wk-message-file" onClick={() => {
                window.open(`${downloadURL}`, 'top');
            }}>
                <div className="fileHeader" style={{ backgroundColor: this.fileIconInfo?.color, borderRadius: isSend ? "4px 0px 0px 4px" : "0px 4px 4px 0px" }}>
                    <img alt="" src={this.fileIconInfo?.icon} style={{ width: '48px', height: '48px' }} />
                </div>
                <div className="fileContent">
                    <div className="name">{content.name}</div>
                    <div className="size">{FileHelper.getFileSizeFormat(content.size || 0)} <MessageTrail message={message} /></div>
                </div>
            </div>

        </MessageBase>
    }
}