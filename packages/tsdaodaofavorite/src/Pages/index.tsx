import { ContextMenus, ContextMenusContext, WKApp, WKNavMainHeader, WKViewQueueHeader } from "@tsdaodao/base";
import React from "react";
import { Component, ReactNode } from "react";
import Viewer from "react-viewer";
import { Spin, Dropdown } from "@douyinfe/semi-ui";

import "./index.css"

export default class FavoritePage extends Component {

    componentDidMount() {

    }

    render(): ReactNode {
        return <div className="wk-favorites">
            <WKNavMainHeader title="收藏"></WKNavMainHeader>
            <div className="wk-favorites-content">
                <ul>
                    <li className="wk-favorites-content-item-selected" onClick={() => {
                        WKApp.routeRight.replaceToRoot(<FavoriteMain></FavoriteMain>)
                    }}>
                        <div className="wk-favorites-icon">
                            <svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6H8C6.89543 6 6 6.89543 6 8V18C6 19.1046 6.89543 20 8 20H18C19.1046 20 20 19.1046 20 18V8C20 6.89543 19.1046 6 18 6Z" fill="none" stroke="#999" strokeWidth="3" strokeLinejoin="round" /><path d="M18 28H8C6.89543 28 6 28.8954 6 30V40C6 41.1046 6.89543 42 8 42H18C19.1046 42 20 41.1046 20 40V30C20 28.8954 19.1046 28 18 28Z" fill="none" stroke="#999" strokeWidth="3" strokeLinejoin="round" /><path d="M40 6H30C28.8954 6 28 6.89543 28 8V18C28 19.1046 28.8954 20 30 20H40C41.1046 20 42 19.1046 42 18V8C42 6.89543 41.1046 6 40 6Z" fill="none" stroke="#999" strokeWidth="3" strokeLinejoin="round" /><path d="M40 28H30C28.8954 28 28 28.8954 28 30V40C28 41.1046 28.8954 42 30 42H40C41.1046 42 42 41.1046 42 40V30C42 28.8954 41.1046 28 40 28Z" fill="none" stroke="#999" strokeWidth="3" strokeLinejoin="round" /></svg>
                        </div>
                        <div className="wk-favorites-title" >
                            全部收藏
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    }
}


interface FavoriteMainState {
    data: any[]
    selectData?: any
    showPreview: boolean
    imageURL?: string
    loading?: boolean
    contextMenusVisible?: boolean
}

export class FavoriteMain extends Component<any, FavoriteMainState> {
    contextMenusContext!: ContextMenusContext
    constructor(props: any) {
        super(props)
        this.state = {
            data: [],
            showPreview: false,
        }
    }
    componentDidMount() {
        this.requestFavorites(true)
    }

    async requestFavorites(needLoading: boolean) {
        if (needLoading) {
            this.setState({
                loading: true
            })
        }

        const result = await WKApp.dataSource.commonDataSource.getFavoritesAll();
        this.setState({
            data: result,
            loading: false
        })
    }
    favoritesDelete(id: string) {
        WKApp.dataSource.commonDataSource.favoritiesDelete(id).then(() => {
            this.requestFavorites(false)
        })
    }

    getItemContent(value: any) {
        if (value.type === 1) {
            const content = value.payload.content
            // 将 HTML 标签转换成实体字符
            const escapeHtml = (str: string) => {
                return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            };
            const escapedContent = escapeHtml(content);
          

            // 使用正则表达式识别链接并转换为 <a> 标签
            const linkifiedContent = escapedContent.replace(
                /(https?:\/\/[^\s]+)/g,
                '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
            );
            return <div dangerouslySetInnerHTML={{ "__html": linkifiedContent }}></div>
        }
        if (value.type === 2) {
            return <div onClick={() => {
                this.setState({
                    showPreview: true,
                    imageURL: WKApp.dataSource.commonDataSource.getFileURL(value.payload.content),
                })
            }} style={{ cursor: "pointer", width: "120px", height: "120px", backgroundImage: `url(${WKApp.dataSource.commonDataSource.getFileURL(value.payload.content)})`, backgroundSize: "cover" }} />
        }
        return value.payload.content
    }

    render(): React.ReactNode {
        const { data, showPreview, imageURL, loading, selectData } = this.state
        return <div className="wk-favritemain">
            <WKViewQueueHeader title="全部收藏" onBack={() => {
                WKApp.routeRight.pop()
            }}></WKViewQueueHeader>
            <div className="wk-favritemain-content">
                {
                    loading ? <div className="wk-loading">
                        <Spin></Spin>
                    </div> : <ul>
                        {
                            data && data.map((d) => {

                                return (
                                    <li key={d.no} onContextMenu={(event) => {
                                        this.setState({
                                            selectData: d
                                        })
                                        this.contextMenusContext.show(event)
                                    }} >
                                        <div className="wk-wk-favritemain-item-content">
                                            {this.getItemContent(d)}
                                        </div>
                                        <div className="wk-favritemain-item-info">
                                            <p>{d.created_at.substr(0, 10)}</p>
                                            <p>来自：{d.author_name}</p>
                                        </div>
                                    </li>
                                )


                            })
                        }
                    </ul>
                }

            </div>
            <ContextMenus onContext={(ctx) => {
                this.contextMenusContext = ctx
            }} menus={[{
                title: "删除", onClick: () => {
                    this.favoritesDelete(selectData!.unique_key)
                }
            }]}></ContextMenus>
            <Viewer
                visible={showPreview}
                noImgDetails={true}
                downloadable={true}
                rotatable={false}
                changeable={false}
                showTotal={false}
                onMaskClick={() => { this.setState({ showPreview: false }); }}
                onClose={() => { this.setState({ showPreview: false }); }}
                images={[{ src: imageURL || "", alt: '', downloadUrl: imageURL }]}
            />
        </div>
    }
}