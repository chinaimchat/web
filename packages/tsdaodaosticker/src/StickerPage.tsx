/**
 * 表情页：与安卓 wksticker 对齐，调用后端 /v1/sticker 接口
 * - 商店列表 GET sticker/store?page_index=&page_size=
 * - 商店详情/分类下表情 GET sticker/user/sticker?category=
 * - 按分类添加 POST sticker/user/:category
 * - 我的分类 GET sticker/user/category
 * - 我的自定义表情 GET sticker/user
 * - 移除分类 DELETE sticker/remove?category=
 * - 删除自定义 DELETE sticker/user body { paths }
 * - 移到最前 PUT sticker/user/front body { paths }
 * - 分类排序 PUT sticker/user/category/reorder body { categorys }
 * - 搜索 GET sticker?keyword=&page=&page_size=
 */
import React, { Component } from "react";
import { WKApp, RoutePage } from "@tsdaodao/base";
import { Toast, Button, Spin } from "@douyinfe/semi-ui";
import "@lottiefiles/lottie-player/dist/tgs-player";

export interface StickerCategory {
  category: string;
  cover: string;
  cover_lim?: string;
  sort_num: number;
  title: string;
  desc?: string;
}

export interface StickerStoreItem {
  status: number;
  category: string;
  cover: string;
  cover_lim?: string;
  title: string;
  desc?: string;
}

export interface StickerItem {
  path: string;
  width: number;
  height: number;
  title?: string;
  category: string;
  format?: string;
}

export interface StickerDetailResp {
  list: StickerItem[];
  title: string;
  cover: string;
  cover_lim?: string;
  category: string;
  desc?: string;
  added: boolean;
}

// 展示用中文标题：前端优先展示该映射，避免后端 title 字段编码问题导致显示乱码。
const STICKER_CATEGORY_TITLES_ZH: Record<string, string> = {
  duck: "鸭子",
  elephant: "大象",
  emoji: "表情",
  felix_cat: "猫",
  floof: "毛绒猫",
  funky_goose: "搞怪鹅",
  grumpy_tiggerrr: "暴躁老虎",
  hopper_hippo: "跳跳河马",
  jinx: "金克斯",
  koala: "树袋熊",
  puffer_fish: "河豚",
  red_panda: "小熊猫",
  woodpecker: "啄木鸟",
  zebra: "斑马",
};

interface StickerPageState {
  storeList: StickerStoreItem[];
  storeLoading: boolean;
  storePage: number;
  storeLoadError: boolean;
  detailCategory: string | null;
  detailData: StickerDetailResp | null;
  detailLoading: boolean;
}

const PAGE_SIZE = 20;

export default class StickerPage extends Component<{}, StickerPageState> {
  state: StickerPageState = {
    storeList: [],
    storeLoading: false,
    storePage: 1,
    storeLoadError: false,
    detailCategory: null,
    detailData: null,
    detailLoading: false,
  };

  componentDidMount() {
    this.loadStoreList(true);
  }

  titleForCategory = (category: string, fallbackTitle?: string) => {
    return STICKER_CATEGORY_TITLES_ZH[category] || fallbackTitle || category;
  };

  /** 兼容直接返回数组或 { data/list: array } 的接口格式 */
  private normalizeList<T>(res: T[] | { data?: T[]; list?: T[] } | undefined): T[] {
    if (Array.isArray(res)) return res;
    if (res && typeof res === "object") {
      if (Array.isArray((res as { data?: T[] }).data)) return (res as { data: T[] }).data;
      if (Array.isArray((res as { list?: T[] }).list)) return (res as { list: T[] }).list;
    }
    return [];
  }

  loadStoreList = (reset: boolean) => {
    const page = reset ? 1 : this.state.storePage;
    this.setState({ storeLoading: true, storeLoadError: false });
    WKApp.apiClient
      .get("sticker/store", { param: { page_index: page, page_size: PAGE_SIZE } })
      .then((res: StickerStoreItem[] | { data?: StickerStoreItem[] } | { list?: StickerStoreItem[] }) => {
        const list = this.normalizeList(res as StickerStoreItem[]);
        this.setState({
          storeList: reset ? list : [...this.state.storeList, ...list],
          storePage: page + 1,
          storeLoading: false,
          storeLoadError: false,
        });
      })
      .catch((err: { msg?: string }) => {
        this.setState({ storeLoading: false, storeLoadError: true });
        Toast.error(err?.msg || "加载商店失败");
      });
  };

  loadDetail = (category: string) => {
    this.setState({ detailCategory: category, detailLoading: true });
    WKApp.apiClient
      .get("sticker/user/sticker", { param: { category } })
      .then((res: StickerDetailResp | { data?: StickerDetailResp }) => {
        const data = res && typeof res === "object" && !Array.isArray(res) && "data" in res ? (res as { data?: StickerDetailResp }).data : (res as StickerDetailResp);
        this.setState({ detailData: data || null, detailLoading: false });
      })
      .catch((err: { msg?: string }) => {
        this.setState({ detailLoading: false });
        Toast.error(err?.msg || "加载详情失败");
      });
  };

  addCategory = (category: string) => {
    WKApp.apiClient
      .post(`sticker/user/${encodeURIComponent(category)}`)
      .then(() => {
        Toast.success("已添加");
        this.loadStoreList(true);
        this.setState({ detailData: this.state.detailData ? { ...this.state.detailData, added: true } : null });
        window.dispatchEvent(new CustomEvent("wk-sticker-category-updated"));
      })
      .catch((err: { msg?: string }) => Toast.error(err?.msg || "添加失败"));
  };

  removeCategory = (category: string) => {
    if (!window.confirm("确定移除此分类？")) return;
    WKApp.apiClient
      .delete("sticker/remove", { param: { category } })
      .then(() => {
        Toast.success("已移除");
        this.loadStoreList(true);
        this.setState({ detailCategory: null, detailData: null });
        window.dispatchEvent(new CustomEvent("wk-sticker-category-updated"));
      })
      .catch((err: { msg?: string }) => Toast.error(err?.msg || "移除失败"));
  };

  fileURL = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return WKApp.dataSource.commonDataSource.getFileURL(path);
  };

  lottieURL = (path?: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    // 与消息里的 LottieStickerCell 对齐，走同一条图片/预览地址拼接链路。
    return WKApp.dataSource.commonDataSource.getImageURL(path);
  };

  renderLottieSticker = (path?: string) => {
    return React.createElement("tgs-player", {
      style: { width: 64, height: 64 },
      autoplay: true,
      loop: true,
      mode: "normal",
      src: this.lottieURL(path),
    });
  };

  render() {
    const {
      storeList,
      storeLoading,
      detailCategory,
      detailData,
      detailLoading,
    } = this.state;

    return (
      <RoutePage
        title="表情包商店"
        onClose={() => {
          if (typeof (WKApp.route as any).onCloseCallback === "function") {
            (WKApp.route as any).onCloseCallback();
          }
        }}
        render={() => (
          <div className="wk-sticker-page" style={{ padding: 16 }}>
            {detailCategory != null ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <Button size="small" type="tertiary" onClick={() => this.setState({ detailCategory: null, detailData: null })}>
                    返回
                  </Button>
                </div>
                {detailLoading ? (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <Spin size="large" />
                  </div>
                ) : detailData ? (
                  <div>
                        <div style={{ marginBottom: 12, fontWeight: 600 }}>
                          {this.titleForCategory(detailCategory || detailData.category || "", detailData.title)}
                        </div>
                    {detailData.desc ? <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>{detailData.desc}</div> : null}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {detailData.list?.map((s) => (
                        <div
                          key={s.path}
                          style={{
                            width: 72,
                            height: 72,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#f5f5f5",
                            borderRadius: 8,
                            overflow: "hidden",
                          }}
                        >
                          {s.format === "gzip" || s.format === "lim" || (s.path && s.path.toLowerCase().endsWith(".tgs")) ? (
                            this.renderLottieSticker(s.path)
                          ) : (
                            <img
                              src={this.fileURL(s.path)}
                              alt=""
                              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 16 }}>
                      {detailData.added ? (
                        <Button type="secondary" onClick={() => this.removeCategory(detailCategory)}>
                          移除此分类
                        </Button>
                      ) : (
                        <Button theme="solid" type="primary" onClick={() => this.addCategory(detailCategory)}>
                          添加此分类
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {storeLoading && storeList.length === 0 && !this.state.storeLoadError ? (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <Spin size="large" />
                  </div>
                ) : this.state.storeLoadError ? (
                  <div style={{ textAlign: "center", color: "#999", padding: 40 }}>
                    <div>加载失败，请检查网络或联系管理员</div>
                    <Button theme="light" size="small" style={{ marginTop: 12 }} onClick={() => this.loadStoreList(true)}>重试</Button>
                  </div>
                ) : storeList.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#999", padding: 40 }}>商店暂无上架表情包，敬请期待</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {storeList.map((item) => (
                      <div
                        key={item.category}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: 12,
                          background: "#f9f9f9",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                        onClick={() => this.loadDetail(item.category)}
                      >
                        <img
                          src={this.fileURL(item.cover)}
                          alt=""
                          style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4, marginRight: 12 }}
                          onError={(e) => {(e.target as HTMLImageElement).style.display = "none";}}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500 }}>
                            {this.titleForCategory(item.category, item.title)}
                          </div>
                          {item.desc ? <div style={{ fontSize: 12, color: "#666" }}>{item.desc}</div> : null}
                        </div>
                        {item.status === 1 ? <span style={{ fontSize: 12, color: "#999" }}>已添加</span> : null}
                      </div>
                    ))}
                    {storeLoading ? <div style={{ textAlign: "center" }}><Spin /></div> : null}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      />
    );
  }
}
