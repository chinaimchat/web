import { ConversationContext, FileHelper, ImageContent, WKApp } from "@tsdaodao/base";
import React from "react";
import { Component, ReactNode } from "react";
import { FileContent } from "../Messages/File";
import axios from "axios";
import { Toast } from "@douyinfe/semi-ui";

import "./index.css"

function getUUID(): string {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
    let uuid = "";
    for (let i = 0; i < 32; i++) uuid += chars[Math.floor(Math.random() * chars.length)];
    return uuid;
}

async function getUploadURL(path: string): Promise<string | undefined> {
    const result = await WKApp.apiClient.get(`file/upload?path=${path}&type=chat`);
    return result?.url;
}

async function uploadFileWithProgress(
    file: File | Blob,
    uploadURL: string,
    fileName?: string,
    onProgress?: (percent: number) => void
): Promise<string | undefined> {
    const form = new FormData();
    form.append("file", file, fileName || (file instanceof File ? file.name : "file"));
    const resp = await axios.post(uploadURL, form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: onProgress
            ? (e) => {
                if (e.total && e.total > 0) {
                    onProgress(Math.round((e.loaded * 100) / e.total));
                }
            }
            : undefined,
    });
    return resp?.data?.path;
}

interface FileToolbarProps {
    conversationContext: ConversationContext
    icon: string
}

interface FileToolbarState {
    showDialog: boolean
    file?: any
    fileType?: string
    previewUrl?: any,
    fileIconInfo?: any,
    canSend?: boolean
    width?: number
    height?: number
    sending: boolean
    uploadProgress: number
}

export default class FileToolbar extends Component<FileToolbarProps, FileToolbarState>{
    pasteListen!:(event:any)=>void
    constructor(props:any) {
        super(props)
        this.state = {
            showDialog: false,
            sending: false,
            uploadProgress: 0,
        }
    }

    componentDidMount() {
        let self = this;

        const { conversationContext } = this.props

        this.pasteListen = function (event:any) {
            let files = event.clipboardData.files;
            if (files.length > 0) {
                self.showFile(files[0]);
            }
        }
        document.addEventListener('paste',this.pasteListen )

        conversationContext.addDragFileCallback((file) => {
            if (file.type && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
                return false;
            }
            self.showFile(file);
            return true;
        })
    }

    componentWillUnmount() {
        document.removeEventListener("paste",this.pasteListen)
    }

    $fileInput: any
    onFileClick = (event: any) => {
        event.target.value = ''
    }
    onFileChange() {
        let file = this.$fileInput.files[0];
        this.showFile(file);
    }
    chooseFile = () => {
        this.$fileInput.click();
    }
    showFile(file: any) {
        const self = this
        if (file.type && file.type.startsWith('image/')) {
            var reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = function (e: any) {
                self.setState({
                    file: file,
                    fileType: "image",
                    previewUrl: reader.result,
                    showDialog: true,
                });
            };
        } else {
            const fileIconInfo = FileHelper.getFileIconInfo(file.name);
            this.setState({
                fileType: 'file',
                fileIconInfo: fileIconInfo,
                file: file,
                showDialog: true,
                canSend: true,
            });
        }
    }

    onClose = () => {
        if (!this.state.sending) {
            this.setState({ showDialog: false, file: undefined, previewUrl: undefined, uploadProgress: 0 });
        }
    }

    onSend = async () => {
        const { conversationContext } = this.props
        const { file, previewUrl, width, height, fileType } = this.state

        if (fileType === "image") {
            conversationContext.sendMessage(new ImageContent(file, previewUrl, width, height))
            this.setState({ showDialog: false });
            return;
        }

        const channel = conversationContext.channel();
        if (!channel) { Toast.error("未选择会话"); return; }

        this.setState({ sending: true, uploadProgress: 0 });
        const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
        const uuid = getUUID();
        const filePath = `/${channel.channelType}/${channel.channelID}/${uuid}${ext}`;

        try {
            const uploadURL = await getUploadURL(filePath);
            if (!uploadURL) { Toast.error("获取上传地址失败"); return; }

            const remotePath = await uploadFileWithProgress(file, uploadURL, file.name, (p) => {
                this.setState({ uploadProgress: p });
            });
            if (!remotePath) { Toast.error("文件上传失败"); return; }

            const content = new FileContent();
            content.name = file.name;
            content.size = file.size;
            content.url = remotePath;
            await conversationContext.sendMessage(content);
            Toast.success("已发送");
        } catch (e) {
            Toast.error("发送失败");
            console.error(e);
        } finally {
            this.setState({ sending: false, showDialog: false, uploadProgress: 0 });
        }
    }

    onPreviewLoad(e: any) {
        let img = e.target;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        this.setState({
            width: width,
            height: height,
            canSend: true,
        });
    }
    render(): ReactNode {
        const { icon } = this.props
        const { showDialog, canSend, fileIconInfo, file, fileType, previewUrl, sending, uploadProgress } = this.state
        return <div className="wk-filetoolbar" >
            <div className="wk-filetoolbar-content" onClick={() => {
            this.chooseFile()
        }}>
                <div className="wk-filetoolbar-content-icon">
                    <img src={icon}></img>
                    <input onClick={this.onFileClick} onChange={this.onFileChange.bind(this)} ref={(ref) => { this.$fileInput = ref }} type="file" multiple={false} accept="*" style={{ display: 'none' }} />
                </div>
            </div>
            {
                showDialog ? (
                    <FileDialog
                        onSend={this.onSend}
                        onLoad={this.onPreviewLoad.bind(this)}
                        canSend={canSend}
                        fileIconInfo={fileIconInfo}
                        file={file}
                        fileType={fileType}
                        previewUrl={previewUrl}
                        sending={sending}
                        uploadProgress={uploadProgress}
                        onClose={this.onClose}
                    />
                ) : null
            }
        </div>
    }
}


interface FileDialogProps {
    onClose: () => void
    onSend?: () => void
    fileType?: string
    previewUrl?: string
    file?: any
    fileIconInfo?: any,
    canSend?: boolean
    onLoad: (e: any) => void
    sending: boolean
    uploadProgress: number
}

class FileDialog extends Component<FileDialogProps> {

    getFileSizeFormat(size: number) {
        if (size < 1024) return `${size} B`
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
        if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} M`
        return `${(size / (1024 * 1024 * 1024)).toFixed(2)} G`
    }

    render() {
        const { onClose, onSend, fileType, previewUrl, file, canSend, fileIconInfo, onLoad, sending, uploadProgress } = this.props
        const disableSend = sending || !canSend
        return <div className="wk-imagedialog">
            <div className="wk-imagedialog-mask" onClick={sending ? undefined : onClose}></div>
            <div className="wk-imagedialog-content">
                <div className="wk-imagedialog-content-close" onClick={sending ? undefined : onClose}>
                    <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2683" ><path d="M568.92178541 508.23169412l299.36805789-299.42461715a39.13899415 39.13899415 0 0 0 0-55.1452591L866.64962537 152.02159989a39.13899415 39.13899415 0 0 0-55.08869988 0L512.19286756 451.84213173 212.76825042 151.90848141a39.13899415 39.13899415 0 0 0-55.0886999 0L155.98277331 153.54869938a38.46028327 38.46028327 0 0 0 0 55.08869987L455.46394971 508.23169412 156.03933259 807.71287052a39.13899415 39.13899415 0 0 0 0 55.08869986l1.64021795 1.6967772a39.13899415 39.13899415 0 0 0 55.08869988 0l299.42461714-299.48117638 299.36805793 299.42461714a39.13899415 39.13899415 0 0 0 55.08869984 0l1.6967772-1.64021796a39.13899415 39.13899415 0 0 0 0-55.08869987L568.86522614 508.17513487z" p-id="2684"></path></svg>
                </div>
                <div className="wk-imagedialog-content-title">发送{fileType === 'image' ? '图片' : '文件'}</div>
                <div className="wk-imagedialog-content-body">
                    {
                        fileType === 'image' ? (
                            <div className="wk-imagedialog-content-preview">
                                <img alt="" className="wk-imagedialog-content-previewImg" src={previewUrl} onLoad={onLoad} />
                            </div>
                        ) : (
                            <div className="wk-imagedialog-content-preview">
                                <div className="wk-imagedialog-content-preview-file">
                                    <div className="wk-imagedialog-content-preview-file-icon" style={{ backgroundColor: fileIconInfo?.color }}>
                                        <img alt="" className="wk-imagedialog-content-preview-file-thumbnail" src={fileIconInfo?.icon} />
                                    </div>
                                    <div className="wk-imagedialog-content-preview--filecontent">
                                        <div className="wk-imagedialog-content-preview--filecontent-name">{file?.name}</div>
                                        <div className="wk-imagedialog-content-preview--filecontent-size">{this.getFileSizeFormat(file?.size)}</div>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                    {sending && (
                        <div style={{ marginTop: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--wk-color-font-tip)", marginBottom: 4 }}>
                                <span>上传中</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, backgroundColor: "#e8e8e8", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${uploadProgress}%`, backgroundColor: WKApp.config.themeColor || "#f56c2c", borderRadius: 2, transition: "width 0.2s ease" }} />
                            </div>
                        </div>
                    )}
                    <div className="wk-imagedialog-footer" >
                        <button onClick={onClose} disabled={sending}>取消</button>
                        <button onClick={onSend} className="wk-imagedialog-footer-okbtn" disabled={disableSend} style={{ backgroundColor: disableSend ? 'gray' : WKApp.config.themeColor }}>
                            {sending ? "发送中..." : "发送"}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    }
}