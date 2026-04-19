import React, { Component } from "react";
import { WKApp, RoutePage } from "@tsdaodao/base";
import { ContactsStatus } from "@tsdaodao/base";
import { Toast, Button, Spin, TextArea, Input, Select, Checkbox } from "@douyinfe/semi-ui";
import axios from "axios";

/**
 * 朋友圈列表/发布页，与安卓 wkmoments 模块对齐：
 * - 列表 GET moments?page_index=&page_size=
 * - 发布 POST moments，body: text, imgs, video_path, video_cover_path, privacy_type, privacy_uids, remind_uids
 * - 上传文件 file/upload?type=moment&path=/{uid}/...
 * - 评论 POST moments/:moment_no/comments，body: content（可选 reply_comment_id, reply_uid, reply_name）
 */

/** 服务端返回的一条动态 */
export interface MomentItem {
  moment_no: string;
  publisher: string;
  publisher_name: string;
  text: string;
  imgs?: string[];
  video_path?: string;
  video_cover_path?: string;
  created_at: string;
  likes?: { uid: string; name: string }[];
  comments?: { sid: string; uid: string; name: string; content: string; reply_uid?: string; reply_name?: string; comment_at: string }[];
}

interface MomentsPageState {
  list: MomentItem[];
  loading: boolean;
  loadingMore: boolean;
  pageIndex: number;
  pageSize: number;
  hasMore: boolean;
  /** 发布框 */
  publishVisible: boolean;
  publishText: string;
  publishSubmitting: boolean;
  /** 待发布的图片 path 列表（已上传） */
  publishImgs: string[];
  /** 待发布的视频 path（已上传） */
  publishVideoPath: string;
  /** 待发布的视频封面 path（已上传） */
  publishVideoCoverPath: string;
  /** 评论输入：moment_no -> 输入内容 */
  commentInput: Record<string, string>;
  /** 当前点赞状态：moment_no -> 是否已赞 */
  likedMap: Record<string, boolean>;
  /** 正在回复的评论（与安卓一致：回复时带 reply_comment_id, reply_uid, reply_name） */
  replyingTo: { moment_no: string; comment_id: string; reply_uid: string; reply_name: string } | null;
  /** 发布可见范围：public | private | internal | prohibit */
  publishPrivacyType: "public" | "private" | "internal" | "prohibit";
  /** 发布部分可见/不给谁看的 uid 列表 */
  publishPrivacyUids: string[];
  /** 发布提醒谁看的 uid 列表 */
  publishRemindUids: string[];
  /** 是否显示「选择可见用户」弹层 */
  showPrivacyUserSelect: boolean;
  /** 是否显示「提醒谁看」弹层 */
  showRemindUserSelect: boolean;
  /** 选择可见用户弹层内当前选中的 uid（取消不写回） */
  privacySelectTempUids: string[];
  /** 提醒谁看弹层内当前选中的 uid（取消不写回） */
  remindSelectTempUids: string[];
  /** 图片正在上传中（未完成前禁止发布） */
  publishImagesUploading: boolean;
  /** 视频正在上传中（未完成前禁止发布） */
  publishVideoUploading: boolean;
  /** 点击图片/视频放大：是否显示预览层 */
  previewVisible: boolean;
  /** 预览类型：image 多图 | video 视频 */
  previewType: "image" | "video" | null;
  /** 预览的图片 URL 列表（previewType=image 时） */
  previewImages: string[];
  /** 当前预览的图片下标 */
  previewImageIndex: number;
  /** 预览的视频 URL（previewType=video 时） */
  previewVideoUrl: string;
}

const PAGE_SIZE = 20;

function getUUID(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
  let uuid = "";
  for (let i = 0; i < 32; i++) uuid += chars[Math.floor(Math.random() * chars.length)];
  return uuid;
}

/** 与安卓一致：动态图片/视频使用 type=moment */
async function getMomentUploadURL(path: string): Promise<string | undefined> {
  const result = await WKApp.apiClient.get(`file/upload?path=${encodeURIComponent(path)}&type=moment`);
  return (result as { url?: string })?.url;
}

/** 上传文件到 uploadURL，返回服务端返回的 path（用于发布时传给 moments 接口） */
async function uploadFileToPath(file: File | Blob, uploadURL: string, fileName?: string): Promise<string | undefined> {
  if (!uploadURL.startsWith("http")) {
    const base = (WKApp.apiClient.config.apiURL || "").replace(/\/$/, "");
    uploadURL = base + "/" + uploadURL.replace(/^\//, "");
  }
  const form = new FormData();
  form.append("file", file, fileName || (file instanceof File ? file.name : "cover.jpg"));
  const resp = await axios.post(uploadURL, form, {
    headers: { "Content-Type": "multipart/form-data", "token": WKApp.loginInfo.token || "" },
  });
  const data = resp?.data;
  if (data == null) return undefined;
  if (typeof data.path === "string") return data.path;
  if (typeof data === "string") return data;
  return undefined;
}

/** 从视频文件取第一帧为封面 Blob */
function captureVideoCover(videoFile: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(videoFile);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      video.currentTime = 0.1;
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("canvas"));
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error("toBlob"));
        }, "image/jpeg", 0.8);
      };
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("video"));
    };
    video.src = url;
  });
}

/** 将服务端返回的 path 转为可访问的完整 URL（上传接口返回的已是 file/preview/xxx，勿再拼 file/preview） */
function imageUrl(img: string): string {
  if (!img) return "";
  if (img.startsWith("http")) return img;
  const base = (WKApp.apiClient.config.apiURL || "").replace(/\/$/, "");
  const path = img.startsWith("/") ? img.slice(1) : img;
  if (path.startsWith("file/preview/")) return `${base}/${path}`;
  return `${base}/file/preview/${path}`;
}

export default class MomentsPage extends Component<{}, MomentsPageState> {
  state: MomentsPageState = {
    list: [],
    loading: true,
    loadingMore: false,
    pageIndex: 1,
    pageSize: PAGE_SIZE,
    hasMore: true,
    publishVisible: false,
    publishText: "",
    publishSubmitting: false,
    publishImgs: [],
    publishVideoPath: "",
    publishVideoCoverPath: "",
    commentInput: {},
    likedMap: {},
    replyingTo: null,
    publishPrivacyType: "public",
    publishPrivacyUids: [],
    publishRemindUids: [],
    showPrivacyUserSelect: false,
    showRemindUserSelect: false,
    privacySelectTempUids: [],
    remindSelectTempUids: [],
    publishImagesUploading: false,
    publishVideoUploading: false,
    previewVisible: false,
    previewType: null,
    previewImages: [],
    previewImageIndex: 0,
    previewVideoUrl: "",
  };

  private _isMounted = false;
  componentDidMount() {
    this._isMounted = true;
    this.loadList(true);
  }
  componentWillUnmount() {
    this._isMounted = false;
  }

  /** GET /v1/moments?page_index=1&page_size=20  不传 uid 为“我的朋友圈”时间线 */
  loadList = (reset: boolean) => {
    if (reset) {
      this.setState({ loading: true, pageIndex: 1, hasMore: true });
    } else {
      this.setState({ loadingMore: true });
    }
    const pageIndex = reset ? 1 : this.state.pageIndex;
    const pageSize = this.state.pageSize;
    WKApp.apiClient
      .get("moments", { param: { page_index: pageIndex, page_size: pageSize } })
      .then((res: MomentItem[]) => {
        if (!this._isMounted) return;
        const list = Array.isArray(res) ? res : [];
        const nextList = reset ? list : [...this.state.list, ...list];
        const likedMap = { ...this.state.likedMap };
        list.forEach((m) => {
          const mine = WKApp.loginInfo.uid;
          likedMap[m.moment_no] = (m.likes || []).some((l) => l.uid === mine);
        });
        this.setState({
          list: nextList,
          loading: false,
          loadingMore: false,
          pageIndex: pageIndex + 1,
          hasMore: list.length >= pageSize,
          likedMap,
        });
      })
      .catch(() => {
        if (this._isMounted) {
          this.setState({ loading: false, loadingMore: false });
          Toast.error("加载失败");
        }
      });
  };

  /** POST /v1/moments 发布（与安卓一致：privacy_type, privacy_uids, remind_uids） */
  doPublish = () => {
    const { publishText, publishImgs, publishVideoPath, publishVideoCoverPath, publishPrivacyType, publishPrivacyUids, publishRemindUids, publishImagesUploading, publishVideoUploading } = this.state;
    if (publishImagesUploading || publishVideoUploading) {
      Toast.warning("图片或视频上传中，请稍候再发布");
      return;
    }
    if (!publishText.trim() && (publishImgs?.length || 0) === 0 && !publishVideoPath) {
      Toast.warning("请输入内容或添加图片/视频");
      return;
    }
    if ((publishPrivacyType === "internal" || publishPrivacyType === "prohibit") && (publishPrivacyUids?.length || 0) === 0) {
      Toast.warning("请选择可见范围用户");
      return;
    }
    this.setState({ publishSubmitting: true });
    WKApp.apiClient
      .post("moments", {
        text: (publishText || "").trim(),
        imgs: publishImgs || [],
        video_path: publishVideoPath || undefined,
        video_cover_path: publishVideoCoverPath || undefined,
        privacy_type: publishPrivacyType,
        privacy_uids: publishPrivacyUids || [],
        remind_uids: publishRemindUids || [],
      })
      .then(() => {
        if (!this._isMounted) return;
        Toast.success("发布成功");
        this.setState({
          publishVisible: false,
          publishText: "",
          publishSubmitting: false,
          publishImgs: [],
          publishVideoPath: "",
          publishVideoCoverPath: "",
          publishPrivacyType: "public",
          publishPrivacyUids: [],
          publishRemindUids: [],
          publishImagesUploading: false,
          publishVideoUploading: false,
        });
        this.loadList(true);
      })
      .catch((err: { msg?: string }) => {
        if (this._isMounted) this.setState({ publishSubmitting: false });
        Toast.error(err?.msg || "发布失败");
      });
  };

  /** PUT /v1/moments/:moment_no/like */
  like = (momentNo: string) => {
    WKApp.apiClient.put(`moments/${momentNo}/like`).then(() => {
      this.setState((s) => ({ likedMap: { ...s.likedMap, [momentNo]: true } }));
      this.loadList(true); // 刷新列表以更新点赞名单
    }).catch(() => Toast.error("操作失败"));
  };

  /** PUT /v1/moments/:moment_no/unlike */
  unlike = (momentNo: string) => {
    WKApp.apiClient.put(`moments/${momentNo}/unlike`).then(() => {
      this.setState((s) => ({ likedMap: { ...s.likedMap, [momentNo]: false } }));
      this.loadList(true);
    }).catch(() => Toast.error("操作失败"));
  };

  /** POST /v1/moments/:moment_no/comments（与安卓一致：支持 reply_comment_id, reply_uid, reply_name） */
  submitComment = (momentNo: string) => {
    const content = (this.state.commentInput[momentNo] || "").trim();
    if (!content) return;
    const { replyingTo } = this.state;
    const body: Record<string, string> = { content };
    if (replyingTo && replyingTo.moment_no === momentNo) {
      body.reply_comment_id = replyingTo.comment_id;
      body.reply_uid = replyingTo.reply_uid;
      body.reply_name = replyingTo.reply_name;
    }
    WKApp.apiClient
      .post(`moments/${momentNo}/comments`, body)
      .then(() => {
        if (!this._isMounted) return;
        this.setState((s) => ({
          commentInput: { ...s.commentInput, [momentNo]: "" },
          replyingTo: null,
        }));
        this.loadList(true);
      })
      .catch(() => Toast.error("评论失败"));
  };

  /** DELETE /v1/moments/:moment_no/comments/:id（与安卓一致） */
  deleteComment = (momentNo: string, commentId: string) => {
    if (!window.confirm("确定删除这条评论？")) return;
    WKApp.apiClient.delete(`moments/${momentNo}/comments/${commentId}`).then(() => {
      Toast.success("已删除");
      this.loadList(true);
    }).catch(() => Toast.error("删除失败"));
  };

  /** DELETE /v1/moments/:moment_no */
  deleteMoment = (momentNo: string) => {
    if (!window.confirm("确定删除这条动态？")) return;
    WKApp.apiClient.delete(`moments/${momentNo}`).then(() => {
      Toast.success("已删除");
      this.loadList(true);
    }).catch(() => Toast.error("删除失败"));
  };

  /** 选择图片上传到 moments 路径 */
  onPublishImagesChange = async () => {
    const files = (this as any).$publishImgInput?.files;
    if (!files?.length) return;
    this.setState({ publishImagesUploading: true });
    const uid = WKApp.loginInfo.uid || "temp";
    const paths: string[] = [];
    try {
      for (let i = 0; i < Math.min(files.length, 9 - (this.state.publishImgs?.length || 0)); i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;
        const path = `/${uid}/${getUUID()}_${file.name}`;
        const url = await getMomentUploadURL(path);
        if (!url) {
          Toast.error("获取上传地址失败");
          break;
        }
        const remotePath = await uploadFileToPath(file, url, file.name);
        if (remotePath) paths.push(remotePath);
        else Toast.error(`图片 ${file.name} 上传失败`);
      }
      if (paths.length && this._isMounted) {
        this.setState((s) => ({ publishImgs: [...(s.publishImgs || []), ...paths].slice(0, 9) }));
      }
    } finally {
      if (this._isMounted) this.setState({ publishImagesUploading: false });
    }
    (this as any).$publishImgInput!.value = "";
  };

  /** 选择视频上传 */
  onPublishVideoChange = async () => {
    const file = (this as any).$publishVideoInput?.files?.[0];
    if (!file || !file.type.startsWith("video/")) {
      Toast.warning("请选择视频文件");
      return;
    }
    this.setState({ publishVideoUploading: true });
    const uid = WKApp.loginInfo.uid || "temp";
    const videoPath = `/${uid}/${getUUID()}.mp4`;
    try {
      const videoURL = await getMomentUploadURL(videoPath);
      if (!videoURL) {
        Toast.error("获取上传地址失败");
        return;
      }
      Toast.info("视频上传中…");
      const remoteVideo = await uploadFileToPath(file, videoURL, file.name);
      if (!remoteVideo) {
        Toast.error("视频上传失败");
        return;
      }
      let coverPath = "";
      try {
        const blob = await captureVideoCover(file);
        const coverRel = `/${uid}/${getUUID()}_cover.jpg`;
        const coverURL = await getMomentUploadURL(coverRel);
        if (coverURL) coverPath = (await uploadFileToPath(blob, coverURL, "cover.jpg")) || "";
      } catch (_) {}
      if (this._isMounted) {
        this.setState({ publishVideoPath: remoteVideo, publishVideoCoverPath: coverPath });
      }
    } finally {
      if (this._isMounted) this.setState({ publishVideoUploading: false });
    }
    (this as any).$publishVideoInput!.value = "";
  };

  removePublishImg = (index: number) => {
    this.setState((s) => ({
      publishImgs: (s.publishImgs || []).filter((_, i) => i !== index),
    }));
  };

  removePublishVideo = () => {
    this.setState({ publishVideoPath: "", publishVideoCoverPath: "" });
  };

  /** 点击图片放大预览 */
  showImagePreview = (imgs: string[], index: number) => {
    if (!imgs?.length) return;
    this.setState({
      previewVisible: true,
      previewType: "image",
      previewImages: imgs,
      previewImageIndex: Math.min(index, imgs.length - 1),
      previewVideoUrl: "",
    });
  };

  /** 点击视频封面放大播放 */
  showVideoPreview = (videoPath: string) => {
    if (!videoPath) return;
    this.setState({
      previewVisible: true,
      previewType: "video",
      previewImages: [],
      previewImageIndex: 0,
      previewVideoUrl: imageUrl(videoPath),
    });
  };

  closePreview = () => {
    this.setState({ previewVisible: false, previewType: null, previewImages: [], previewVideoUrl: "" });
  };

  render() {
    const {
      list,
      loading,
      loadingMore,
      hasMore,
      publishVisible,
      publishText,
      publishSubmitting,
      publishImgs,
      publishVideoPath,
      publishVideoCoverPath,
      commentInput,
      likedMap,
      replyingTo,
      publishPrivacyType,
      publishPrivacyUids,
      publishRemindUids,
      showPrivacyUserSelect,
      showRemindUserSelect,
      privacySelectTempUids,
      remindSelectTempUids,
      publishImagesUploading,
      publishVideoUploading,
      previewVisible,
      previewType,
      previewImages,
      previewImageIndex,
      previewVideoUrl,
    } = this.state;
    const myUid = WKApp.loginInfo.uid || "";

    return (
      <RoutePage
        title="朋友圈"
        render={() => (
          <div className="wk-moments-page" style={{ paddingBottom: 24 }}>
            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "flex-end" }}>
              <Button theme="solid" type="primary" onClick={() => this.setState({ publishVisible: true })}>
                发动态
              </Button>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <Spin size="large" />
              </div>
            ) : list.length === 0 ? (
              <div style={{ textAlign: "center", color: "#999", padding: 40 }}>
                暂无动态，点击「发动态」发布一条吧
              </div>
            ) : (
              <div style={{ padding: "0 16px" }}>
                {list.map((m) => (
                  <div
                    key={m.moment_no}
                    style={{
                      borderBottom: "1px solid #eee",
                      padding: "16px 0",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start" }}>
                      <img
                        src={WKApp.shared.avatarUser(m.publisher)}
                        alt=""
                        style={{ width: 40, height: 40, borderRadius: "50%", marginRight: 12, flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{m.publisher_name || m.publisher}</div>
                        <div style={{ color: "#333", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {m.text || ""}
                        </div>
                        {m.imgs && m.imgs.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                            {m.imgs.slice(0, 9).map((img, i) => (
                              <img
                                key={i}
                                src={imageUrl(img)}
                                alt=""
                                role="button"
                                tabIndex={0}
                                style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 4, cursor: "pointer" }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                onClick={() => this.showImagePreview(m.imgs!, i)}
                                onKeyDown={(e) => e.key === "Enter" && this.showImagePreview(m.imgs!, i)}
                              />
                            ))}
                          </div>
                        )}
                        {m.video_cover_path && (
                          <div
                            style={{ marginTop: 8, cursor: m.video_path ? "pointer" : "default" }}
                            onClick={() => m.video_path && this.showVideoPreview(m.video_path)}
                          >
                            <img
                              src={imageUrl(m.video_cover_path)}
                              alt="视频"
                              style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 4 }}
                            />
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: "#999", marginTop: 8 }}>{m.created_at}</div>

                        {/* 点赞与评论 */}
                        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 16 }}>
                          <span
                            style={{ cursor: "pointer", color: likedMap[m.moment_no] ? "#1890ff" : "#666" }}
                            onClick={() => (likedMap[m.moment_no] ? this.unlike(m.moment_no) : this.like(m.moment_no))}
                          >
                            {likedMap[m.moment_no] ? "取消赞" : "赞"}
                          </span>
                          {(m.likes?.length || 0) > 0 && (
                            <span style={{ fontSize: 12, color: "#999" }}>
                              共 {(m.likes?.length || 0)} 人点赞
                            </span>
                          )}
                          {m.publisher === myUid && (
                            <span
                              style={{ cursor: "pointer", color: "#999", fontSize: 12 }}
                              onClick={() => this.deleteMoment(m.moment_no)}
                            >
                              删除
                            </span>
                          )}
                        </div>

                        {m.comments && m.comments.length > 0 && (
                          <div style={{ marginTop: 8, padding: 8, background: "#f5f5f5", borderRadius: 4, fontSize: 13 }}>
                            {m.comments.map((c) => (
                              <div key={c.sid} style={{ marginBottom: 4, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                                {c.reply_uid ? (
                                  <span>
                                    <strong>{c.name}</strong> 回复 <strong>{c.reply_name}</strong>：{c.content}
                                  </span>
                                ) : (
                                  <span>
                                    <strong>{c.name}</strong>：{c.content}
                                  </span>
                                )}
                                <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                                  <span
                                    style={{ cursor: "pointer", color: "#1890ff", fontSize: 12 }}
                                    onClick={() => this.setState({ replyingTo: { moment_no: m.moment_no, comment_id: c.sid, reply_uid: c.uid, reply_name: c.name || "" } })}
                                  >
                                    回复
                                  </span>
                                  {(c.uid === myUid || m.publisher === myUid) && (
                                    <span
                                      style={{ cursor: "pointer", color: "#999", fontSize: 12 }}
                                      onClick={() => this.deleteComment(m.moment_no, c.sid)}
                                    >
                                      删除
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                          {replyingTo?.moment_no === m.moment_no && (
                            <span style={{ fontSize: 12, color: "#999" }}>
                              回复 {replyingTo.reply_name}：
                              <span
                                style={{ cursor: "pointer", color: "#1890ff", marginLeft: 4 }}
                                onClick={() => this.setState({ replyingTo: null })}
                              >
                                取消
                              </span>
                            </span>
                          )}
                          <Input
                            placeholder={replyingTo?.moment_no === m.moment_no ? `回复 ${replyingTo.reply_name}...` : "写评论..."}
                            value={commentInput[m.moment_no] || ""}
                            onChange={(v) =>
                              this.setState((s) => ({
                                commentInput: { ...s.commentInput, [m.moment_no]: v },
                              }))
                            }
                            onKeyDown={(e) => e.key === "Enter" && this.submitComment(m.moment_no)}
                            style={{ flex: 1 }}
                          />
                          <Button size="small" onClick={() => this.submitComment(m.moment_no)}>
                            发送
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {hasMore && (
                  <div style={{ textAlign: "center", padding: 16 }}>
                    {loadingMore ? (
                      <Spin />
                    ) : (
                      <Button onClick={() => this.loadList(false)}>加载更多</Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 发布弹层 */}
            {publishVisible && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
                onClick={() =>
                  !publishSubmitting &&
                  !publishImagesUploading &&
                  !publishVideoUploading &&
                  this.setState({
                    publishVisible: false,
                    publishPrivacyType: "public",
                    publishPrivacyUids: [],
                    publishRemindUids: [],
                    showPrivacyUserSelect: false,
                    showRemindUserSelect: false,
                    publishImagesUploading: false,
                    publishVideoUploading: false,
                  })
                }
              >
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 8,
                    padding: 20,
                    width: "90%",
                    maxWidth: 420,
                    maxHeight: "90vh",
                    overflow: "auto",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ marginBottom: 12, fontWeight: 600 }}>发动态</div>
                  <TextArea
                    placeholder="分享新鲜事..."
                    value={publishText}
                    onChange={(v: string) => this.setState({ publishText: v })}
                    rows={4}
                    maxCount={500}
                  />
                  {/* 可见范围、提醒谁看（与安卓一致） */}
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, color: "#333", minWidth: 72 }}>可见范围</span>
                      <Select
                        value={publishPrivacyType}
                        optionList={[
                          { value: "public", label: "公开" },
                          { value: "private", label: "私密" },
                          { value: "internal", label: "部分可见" },
                          { value: "prohibit", label: "不给谁看" },
                        ]}
                        onChange={(v) => this.setState({ publishPrivacyType: v as typeof publishPrivacyType, publishPrivacyUids: (v === "internal" || v === "prohibit") ? this.state.publishPrivacyUids : [] })}
                        style={{ width: 140 }}
                      />
                      {(publishPrivacyType === "internal" || publishPrivacyType === "prohibit") && (
                        <Button
                          size="small"
                          type="tertiary"
                          onClick={() => this.setState({ showPrivacyUserSelect: true, privacySelectTempUids: [...publishPrivacyUids] })}
                        >
                          {publishPrivacyUids.length ? `已选 ${publishPrivacyUids.length} 人` : "选择用户"}
                        </Button>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, color: "#333", minWidth: 72 }}>提醒谁看</span>
                      <Button
                        size="small"
                        type="tertiary"
                        onClick={() => this.setState({ showRemindUserSelect: true, remindSelectTempUids: [...publishRemindUids] })}
                      >
                        {publishRemindUids.length ? `已选 ${publishRemindUids.length} 人` : "选择用户"}
                      </Button>
                    </div>
                  </div>
                  {/* 图片/视频选择 */}
                  <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
                    {!(publishImgs?.length >= 9) && !publishVideoPath && (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          style={{ display: "none" }}
                          ref={(el) => { (this as any).$publishImgInput = el; }}
                          onChange={this.onPublishImagesChange}
                        />
                        <input
                          type="file"
                          accept="video/*"
                          style={{ display: "none" }}
                          ref={(el) => { (this as any).$publishVideoInput = el; }}
                          onChange={this.onPublishVideoChange}
                        />
                        <Button
                          size="small"
                          type="tertiary"
                          onClick={() => (this as any).$publishImgInput?.click()}
                          disabled={publishSubmitting}
                        >
                          图片
                        </Button>
                        <Button
                          size="small"
                          type="tertiary"
                          onClick={() => (this as any).$publishVideoInput?.click()}
                          disabled={publishSubmitting || (publishImgs?.length || 0) > 0}
                        >
                          视频
                        </Button>
                      </>
                    )}
                    {publishImgs?.map((path, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        <img
                          src={imageUrl(path)}
                          alt=""
                          style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 4 }}
                        />
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => this.removePublishImg(i)}
                          style={{
                            position: "absolute",
                            top: -4,
                            right: -4,
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "#999",
                            color: "#fff",
                            fontSize: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          ×
                        </span>
                      </div>
                    ))}
                    {publishVideoPath && (
                      <div style={{ position: "relative" }}>
                        <img
                          src={publishVideoCoverPath ? imageUrl(publishVideoCoverPath) : ""}
                          alt="视频"
                          style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 4, background: "#eee" }}
                        />
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={this.removePublishVideo}
                          style={{
                            position: "absolute",
                            top: -4,
                            right: -4,
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "#999",
                            color: "#fff",
                            fontSize: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          ×
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <Button
                      onClick={() =>
                        this.setState({
                          publishVisible: false,
                          publishPrivacyType: "public",
                          publishPrivacyUids: [],
                          publishRemindUids: [],
                          showPrivacyUserSelect: false,
                          showRemindUserSelect: false,
                          publishImagesUploading: false,
                          publishVideoUploading: false,
                        })
                      }
                      disabled={publishSubmitting || publishImagesUploading || publishVideoUploading}
                    >
                      取消
                    </Button>
                    <Button
                      theme="solid"
                      type="primary"
                      loading={publishSubmitting || publishImagesUploading || publishVideoUploading}
                      disabled={publishImagesUploading || publishVideoUploading}
                      onClick={this.doPublish}
                    >
                      {publishImagesUploading || publishVideoUploading ? "上传中…" : "发布"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 选择可见用户弹层（排除黑名单，多选） */}
            {showPrivacyUserSelect && (() => {
              const contacts = (WKApp.dataSource.contactsList || []).filter((c: { status: number }) => c.status !== ContactsStatus.Blacklist);
              return (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1001,
                  }}
                  onClick={() => this.setState({ showPrivacyUserSelect: false })}
                >
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 8,
                      padding: 16,
                      width: "90%",
                      maxWidth: 360,
                      maxHeight: "70vh",
                      overflow: "auto",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ marginBottom: 12, fontWeight: 600 }}>选择可见用户</div>
                    <div style={{ maxHeight: 300, overflow: "auto" }}>
                      {contacts.length === 0 ? (
                        <div style={{ color: "#999", fontSize: 14 }}>暂无联系人</div>
                      ) : (
                        contacts.map((c: { uid: string; name?: string; remark?: string }) => {
                          const name = (c.remark || c.name || c.uid) as string;
                          const checked = privacySelectTempUids.includes(c.uid);
                          return (
                            <div key={c.uid} style={{ display: "flex", alignItems: "center", padding: "6px 0" }}>
                              <Checkbox
                                checked={checked}
                                onChange={(e) => {
                                  const v = e.target.checked;
                                  this.setState((s) => ({
                                    privacySelectTempUids: v
                                      ? [...s.privacySelectTempUids, c.uid]
                                      : s.privacySelectTempUids.filter((id) => id !== c.uid),
                                  }));
                                }}
                              />
                              <span style={{ marginLeft: 8 }}>{name}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <Button onClick={() => this.setState({ showPrivacyUserSelect: false })}>取消</Button>
                      <Button
                        theme="solid"
                        type="primary"
                        onClick={() =>
                          this.setState({ publishPrivacyUids: [...privacySelectTempUids], showPrivacyUserSelect: false })
                        }
                      >
                        确定
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 提醒谁看弹层（排除黑名单，多选） */}
            {showRemindUserSelect && (() => {
              const contacts = (WKApp.dataSource.contactsList || []).filter((c: { status: number }) => c.status !== ContactsStatus.Blacklist);
              return (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1001,
                  }}
                  onClick={() => this.setState({ showRemindUserSelect: false })}
                >
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 8,
                      padding: 16,
                      width: "90%",
                      maxWidth: 360,
                      maxHeight: "70vh",
                      overflow: "auto",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ marginBottom: 12, fontWeight: 600 }}>提醒谁看</div>
                    <div style={{ maxHeight: 300, overflow: "auto" }}>
                      {contacts.length === 0 ? (
                        <div style={{ color: "#999", fontSize: 14 }}>暂无联系人</div>
                      ) : (
                        contacts.map((c: { uid: string; name?: string; remark?: string }) => {
                          const name = (c.remark || c.name || c.uid) as string;
                          const checked = remindSelectTempUids.includes(c.uid);
                          return (
                            <div key={c.uid} style={{ display: "flex", alignItems: "center", padding: "6px 0" }}>
                              <Checkbox
                                checked={checked}
                                onChange={(e) => {
                                  const v = e.target.checked;
                                  this.setState((s) => ({
                                    remindSelectTempUids: v
                                      ? [...s.remindSelectTempUids, c.uid]
                                      : s.remindSelectTempUids.filter((id) => id !== c.uid),
                                  }));
                                }}
                              />
                              <span style={{ marginLeft: 8 }}>{name}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <Button onClick={() => this.setState({ showRemindUserSelect: false })}>取消</Button>
                      <Button
                        theme="solid"
                        type="primary"
                        onClick={() =>
                          this.setState({ publishRemindUids: [...remindSelectTempUids], showRemindUserSelect: false })
                        }
                      >
                        确定
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 点击图片/视频放大预览 */}
            {previewVisible && (previewType === "image" || previewType === "video") && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.92)",
                  zIndex: 1100,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={this.closePreview}
              >
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); this.closePreview(); }}
                  onKeyDown={(e) => e.key === "Enter" && this.closePreview()}
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.2)",
                    color: "#fff",
                    fontSize: 24,
                    lineHeight: "32px",
                    textAlign: "center",
                    cursor: "pointer",
                    zIndex: 1,
                  }}
                >
                  ×
                </span>
                {previewType === "image" && previewImages.length > 0 && (
                  <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "100%", maxHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                    {previewImages.length > 1 && previewImageIndex > 0 && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); this.setState((s) => ({ previewImageIndex: s.previewImageIndex - 1 })); }}
                        style={{
                          position: "absolute",
                          left: 16,
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.2)",
                          color: "#fff",
                          fontSize: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        ‹
                      </span>
                    )}
                    <img
                      src={imageUrl(previewImages[previewImageIndex])}
                      alt=""
                      style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain" }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {previewImages.length > 1 && previewImageIndex < previewImages.length - 1 && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); this.setState((s) => ({ previewImageIndex: s.previewImageIndex + 1 })); }}
                        style={{
                          position: "absolute",
                          right: 16,
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.2)",
                          color: "#fff",
                          fontSize: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        ›
                      </span>
                    )}
                  </div>
                )}
                {previewType === "video" && previewVideoUrl && (
                  <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "90vw", maxHeight: "90vh" }}>
                    <video
                      src={previewVideoUrl}
                      controls
                      autoPlay
                      style={{ maxWidth: "100%", maxHeight: "85vh" }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      />
    );
  }
}
