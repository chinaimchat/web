import classNames from "classnames";
import React from "react";
import { Component, ReactNode } from "react";
import { EndpointID } from "../../Service/Const";
import WKApp from "../../App";
import { Emoji, EmojiService } from "../../Service/EmojiService";
import ConversationContext from "../Conversation/context";

import "./index.css"
import { LottieSticker } from "../../Messages/LottieSticker";

interface EmojiToolbarProps {
    conversationContext: ConversationContext
    icon: string
}

interface EmojiToolbarState {
    show: boolean
    animationStart: boolean
}

export default class EmojiToolbar extends Component<EmojiToolbarProps, EmojiToolbarState>{

    constructor(props: any) {
        super(props)
        this.state = {
            show: false,
            animationStart: false,
        }
    }

    render(): ReactNode {
        const { show, animationStart } = this.state
        const { icon, conversationContext } = this.props
        return <div className="wk-emojitoolbar" >
            <div
                className="wk-emojitoolbar-content"
                onClick={() => {
                    this.setState({
                        show: !show,
                        animationStart: true
                    })
                }}
                title="表情"
                role="button"
                aria-label="表情"
            >
                <img src={icon} alt="表情"></img>
                <div onAnimationEnd={() => {
                    // this.setState({
                    //     animationStart: false
                    // })
                    if (!show) {
                        this.setState({
                            animationStart: false,
                        })
                    }
                }} className={classNames("wk-emojitoolbar-emojipanel", animationStart ? (show ? "wk-emojitoolbar-emojipanel-show" : "wk-emojitoolbar-emojipanel-hide") : undefined)}>
                    <EmojiPanel onSticker={(sticker) => {
                        this.setState({
                            show: false
                        })
                        const lottieSticker = new LottieSticker()
                        lottieSticker.category = sticker.category
                        lottieSticker.url = sticker.path
                        lottieSticker.placeholder = sticker.placeholder
                        lottieSticker.format = sticker.format
                        conversationContext.sendMessage(lottieSticker)
                    }} onEmoji={(emoji) => {
                        this.setState({
                            show: false
                        })
                        conversationContext.messageInputContext().insertText(emoji.key)
                    }}></EmojiPanel>
                </div>
            </div>
            {
                show ? <div className="wk-emojitoolbar-mask" onClick={()=>{
                    this.setState({
                        show: false,
                    })
                }}>
                </div> : undefined
            }

        </div>
    }
}

interface EmojiPanelState {
    emojis: Emoji[]
    category: string
    stickers: any[]
}

interface EmojiPanelProps {
    onEmoji?: (emoji: Emoji) => void
    onSticker?: (sticker: any) => void
}

var stickerCategories = new Array<any>()
export class EmojiPanel extends Component<EmojiPanelProps, EmojiPanelState> {
    emojiService: EmojiService

    constructor(props: any) {
        super(props)
        this.emojiService = WKApp.endpointManager.invoke(EndpointID.emojiService)
        this.state = {
            emojis: [],
            category: "emoji",
            stickers: []
        }
    }

    componentDidMount() {
        this.setState({
            emojis: this.emojiService.getAllEmoji()
        })
        this.requestStickerCategory()
        window.addEventListener("wk-sticker-category-updated", this.handleStickerCategoryUpdated as EventListener)
    }

    componentWillUnmount() {
        window.removeEventListener("wk-sticker-category-updated", this.handleStickerCategoryUpdated as EventListener)
    }

    handleStickerCategoryUpdated = () => {
        stickerCategories = []
        this.requestStickerCategory()
    }

    requestStickerCategory() {
        if (!stickerCategories || stickerCategories.length === 0) {
            WKApp.dataSource.commonDataSource.userStickerCategory()
                .then((result) => {
                    stickerCategories = result || []
                    this.setState({})
                })
                .catch(() => { /* 接口 404 等由 Nginx 代理或 PC 端 API 根配置解决，此处仅避免未捕获的 Promise */ })
        }
    }
    requestStickers(category: string) {
        WKApp.dataSource.commonDataSource.getStickers(category)
            .then((result) => {
                this.setState({
                    stickers: result?.list || [],
                })
            })
            .catch(() => { /* 同上 */ })
    }

    render(): React.ReactNode {
        const { emojis, category, stickers } = this.state
        const { onEmoji, onSticker } = this.props
        const isStickerPackTab = category === "sticker_pack"
        return <div className="wk-emojipanel">
            <div className={classNames("wk-emojipanel-content", category !== "emoji" && !isStickerPackTab ? "wk-emojipanel-content-sticker" : undefined)}>
                {isStickerPackTab ? (
                    <div className="wk-emojipanel-stickerpack-cta" style={{ padding: 24, textAlign: "center", boxSizing: "border-box" }}>
                        <div style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>添加更多表情包</div>
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                                e.stopPropagation();
                                WKApp.route.push("/sticker");
                                if (typeof (WKApp.route as any).onPushCallback === "function") {
                                    (WKApp.route as any).onPushCallback("/sticker");
                                }
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter") { WKApp.route.push("/sticker"); (WKApp.route as any).onPushCallback?.("/sticker"); } }}
                            style={{ display: "inline-block", padding: "8px 16px", background: "var(--semi-color-primary)", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
                        >
                            表情包商店
                        </div>
                    </div>
                ) : (
                <ul>
                    {
                        category === "emoji" ? emojis.map((emoji, i) => {
                            return <li key={i} onClick={(e) => {
                                e.stopPropagation()
                                if (onEmoji) {
                                    onEmoji(emoji)
                                }
                            }}>
                                <img src={emoji.image}></img>
                            </li>
                        }) : undefined
                    }
                    {
                        stickers && stickers.length > 0 && category !== "emoji" ? stickers.map((sticker) => {
                            return <li key={sticker.path} onClick={(e) => {
                                e.stopPropagation()
                                if (onSticker) {
                                    onSticker(sticker)
                                }
                            }}>
                                <tgs-player style={{ width: "74px", height: "74px" }} autoplay mode="normal" src={WKApp.dataSource.commonDataSource.getFileURL(sticker.path)}></tgs-player>
                            </li>
                        }) : undefined
                    }
                </ul>
                )}
            </div>
            <div className="wk-emojipanel-tab">
                <div
                    className={classNames("wk-emojipanel-tab-item", category === "emoji" ? "wk-emojipanel-tab-item-selected" : undefined)}
                    onClick={(e) => {
                        e.stopPropagation()
                        this.setState({ category: "emoji" })
                    }}
                    title="表情"
                    role="button"
                    aria-label="表情"
                >
                    <img alt="表情" src={require("./emoji_tab_icon.png")}></img>
                </div>
                {
                    stickerCategories.map((stickerCategory) => {
                        return (
                            <div key={stickerCategory.category} className={classNames("wk-emojipanel-tab-item", stickerCategory.category === category ? "wk-emojipanel-tab-item-selected" : undefined)} onClick={(e) => {
                                e.stopPropagation()
                                const category: string = stickerCategory.category || ""
                                this.setState({ category: category })
                                this.requestStickers(category)

                            }}>
                                <img alt="" src={WKApp.dataSource.commonDataSource.getFileURL(stickerCategory.cover)}></img>
                            </div>
                        )
                    })
                }
                <div
                    className={classNames("wk-emojipanel-tab-item", isStickerPackTab ? "wk-emojipanel-tab-item-selected" : undefined)}
                    onClick={(e) => {
                        e.stopPropagation()
                        this.setState({ category: "sticker_pack" })
                    }}
                    title="表情包"
                    role="button"
                    aria-label="表情包"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/>
                    </svg>
                </div>
            </div>
        </div>
    }
}