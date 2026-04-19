import { ConversationContext, FileHelper, ImageContent, WKApp } from "@tsdaodao/base";
import { parseClipboardImagePreview, PastedImagePreviewRef } from "../../Utils/clipboardMedia";
import { WK_PASTE_IMAGE_PREVIEW_EVENT } from "../MessageInput";
import React from "react";
import { Component, ReactNode } from "react";

import "./index.css"


interface ImageToolbarProps {
    conversationContext: ConversationContext
    icon: string
}

interface ImageToolbarState {
    showDialog: boolean
    file?: any
    fileType?: string
    previewUrl?: any,
    fileIconInfo?: any,
    canSend?: boolean
    width?: number
    height?: number
    /** 粘贴内网预览 URL 时保存的对象键；存在则「发送」走引用路径，不重复上传 */
    referenceKey?: string
}

export default class ImageToolbar extends Component<ImageToolbarProps, ImageToolbarState>{
    pasteListen!:(event:any)=>void
    /** MessageInput 在 textarea 目标阶段拦截后，通过 window 自定义事件转发匹配到的引用 */
    private mediaPasteListen!: (event: Event) => void
    constructor(props:any) {
        super(props)
        this.state = {
            showDialog: false,
        }
    }

    /** 打开「发送图片」预览弹窗，走引用路径（无需再上传） */
    private openDialogFromRef(ref: PastedImagePreviewRef) {
        this.setState({
            file: undefined,
            fileType: 'image',
            previewUrl: ref.absoluteUrl,
            referenceKey: ref.storageKey,
            showDialog: true,
            canSend: false,
            width: undefined,
            height: undefined,
        });
    }

    componentDidMount() {
        let self = this;

        const { conversationContext } = this.props

        // eslint-disable-next-line no-console
        console.log('[wkpaste] ImageToolbar mounted, event=', WK_PASTE_IMAGE_PREVIEW_EVENT);

        // 主路径：MessageInput 在 textarea 上拦截粘贴后，派发 window 事件
        this.mediaPasteListen = (event: Event) => {
            const ref = (event as CustomEvent<PastedImagePreviewRef>).detail;
            // eslint-disable-next-line no-console
            console.log('[wkpaste] ImageToolbar got event, ref=', ref);
            if (ref) {
                self.openDialogFromRef(ref);
            }
        };
        window.addEventListener(WK_PASTE_IMAGE_PREVIEW_EVENT, this.mediaPasteListen);

        // 兜底：document 捕获阶段监听，覆盖 textarea 之外的粘贴目标（例如其它 contenteditable）
        this.pasteListen = function (event: any) {
            const files = event.clipboardData?.files as FileList | undefined;
            if (files && files.length > 0) {
                self.showFile(files[0]);
                return;
            }
            const target = event.target as (Node | null);
            if (!target || !(target instanceof Element)) return;
            // textarea 的粘贴走 MessageInput 路径，这里直接放行避免重复触发
            if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;
            if (!target.closest('.wk-conversation-footer')) return;
            const text = event.clipboardData?.getData?.('text/plain') as string | undefined;
            if (!text) return;
            const ref = parseClipboardImagePreview(text);
            if (!ref) return;
            event.preventDefault?.();
            event.stopImmediatePropagation?.();
            self.openDialogFromRef(ref);
        }
        document.addEventListener('paste', this.pasteListen, true)

        conversationContext.addDragFileCallback((file) => {
            if (file.type && file.type.startsWith('image/')) {
                self.showFile(file);
                return true;
            }
            return false;
        })
    }

    componentWillUnmount() {
        // eslint-disable-next-line no-console
        console.log('[wkpaste] ImageToolbar WILL unmount');
        document.removeEventListener("paste", this.pasteListen, true)
        if (this.mediaPasteListen) {
            window.removeEventListener(WK_PASTE_IMAGE_PREVIEW_EVENT, this.mediaPasteListen)
        }
    }

    $fileInput: any
    onFileClick = (event: any) => {
        event.target.value = '' // 防止选中一个文件取消后不能再选中同一个文件
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
                    referenceKey: undefined,
                    showDialog: true,
                });
            };
        }

    }

    onSend() {
        const { conversationContext } = this.props
        const { file, previewUrl, width, height, fileType, referenceKey } = this.state
        if (fileType === "image") {
            if (referenceKey) {
                // 粘贴内网预览 URL 的场景：直接引用服务端已有对象键发送，避免重复下载/上传
                const ic = new ImageContent()
                ic.decodeJSON({ url: referenceKey, width: width || 0, height: height || 0 })
                conversationContext.sendMessage(ic)
            } else {
                conversationContext.sendMessage(new ImageContent(file, previewUrl, width, height))
            }
        }

        this.setState({
            showDialog: false,
            referenceKey: undefined,
        });
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
        const { showDialog, canSend, fileIconInfo, file, fileType, previewUrl } = this.state
        return <div className="wk-imagetoolbar" >
            <div className="wk-imagetoolbar-content" onClick={() => {
            this.chooseFile()
        }}>
                <div className="wk-imagetoolbar-content-icon">
                    <img src={icon}></img>
                    <input onClick={this.onFileClick} onChange={this.onFileChange.bind(this)} ref={(ref) => { this.$fileInput = ref }} type="file" multiple={false} accept="image/*" style={{ display: 'none' }} />
                </div>
            </div>
            {
                showDialog ? (
                    <ImageDialog onSend={this.onSend.bind(this)} onLoad={this.onPreviewLoad.bind(this)} canSend={canSend} fileIconInfo={fileIconInfo} file={file} fileType={fileType} previewUrl={previewUrl} onClose={() => {
                        this.setState({
                            showDialog: !showDialog,
                            referenceKey: undefined,
                        })
                    }} />
                ) : null
            }
        </div>
    }
}


interface ImageDialogProps {
    onClose: () => void
    onSend?: () => void
    fileType?: string // image, file
    previewUrl?: string
    file?: any
    fileIconInfo?: any,
    canSend?: boolean
    onLoad: (e: any) => void
}

class ImageDialog extends Component<ImageDialogProps> {


    // 格式化文件大小
    getFileSizeFormat(size: number) {
        if (size < 1024) {
            return `${size} B`
        }
        if (size > 1024 && size < 1024 * 1024) {
            return `${(size / 1024).toFixed(2)} KB`
        }
        if (size > 1024 * 1024 && size < 1024 * 1024 * 1024) {
            return `${(size / 1024 / 1024).toFixed(2)} M`
        }
        return `${(size / (1024 * 1024 * 1024)).toFixed(2)}G`
    }

    render() {
        const { onClose, onSend, fileType, previewUrl, file, canSend, fileIconInfo, onLoad } = this.props
        return <div className="wk-imagedialog">
            <div className="wk-imagedialog-mask" onClick={onClose}></div>
            <div className="wk-imagedialog-content">
                <div className="wk-imagedialog-content-close" onClick={onClose}>
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
                    <div className="wk-imagedialog-footer" >
                        <button onClick={onClose}>取消</button>
                        <button onClick={onSend} className="wk-imagedialog-footer-okbtn" disabled={!canSend} style={{ backgroundColor: canSend ? WKApp.config.themeColor : 'gray' }}>发送</button>
                    </div>
                </div>

            </div>
        </div>
    }
}