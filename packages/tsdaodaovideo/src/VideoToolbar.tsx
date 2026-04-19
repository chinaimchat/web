import React, { Component } from "react";
import { ConversationContext, WKApp, parseClipboardVideoPreview, PastedVideoPreviewRef, WK_PASTE_VIDEO_PREVIEW_EVENT } from "@tsdaodao/base";
import { VideoContent } from "@tsdaodao/base/src/Messages/Video";
import axios from "axios";
import { Toast } from "@douyinfe/semi-ui";

interface VideoToolbarProps {
  conversationContext: ConversationContext;
  icon: string;
}

interface VideoToolbarState {
  sending: boolean;
  showDialog: boolean;
  file: File | null;
  previewUrl: string;
  uploadProgress: number;
  uploadStage: string;
  /** 粘贴内网视频预览 URL 时保存的「视频对象键」；存在则「发送」直接引用不重复上传 */
  referenceVideoKey?: string;
  /** 粘贴内网视频预览 URL 时保存的「封面对象键」，与上传约定一致 (`<videoKey>_cover.jpg`) */
  referenceCoverKey?: string;
  /** 粘贴场景下从 <video> onLoadedMetadata 读到的元数据，用于 VideoContent 填充 */
  referenceMeta?: { width: number; height: number; second: number };
}

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

async function uploadFile(
  file: File | Blob,
  uploadURL: string,
  fileName?: string,
  onProgress?: (percent: number) => void
): Promise<string | undefined> {
  const form = new FormData();
  form.append("file", file, fileName || (file instanceof File ? file.name : "cover.jpg"));
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

function captureVideoCover(videoFile: File): Promise<{ blob: Blob; width: number; height: number; second: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(videoFile);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      const second = Math.ceil(video.duration) || 1;
      video.currentTime = 0.1;
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("canvas context"));
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) resolve({ blob, width: w, height: h, second });
            else reject(new Error("toBlob failed"));
          },
          "image/jpeg",
          0.8
        );
      };
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("video load error"));
    };
    video.src = url;
  });
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} M`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} G`;
}

export default class VideoToolbar extends Component<VideoToolbarProps, VideoToolbarState> {
  state: VideoToolbarState = { sending: false, showDialog: false, file: null, previewUrl: "", uploadProgress: 0, uploadStage: "" };
  $input: HTMLInputElement | null = null;
  private pasteListener?: (e: ClipboardEvent) => void;
  private mediaPasteListener?: (e: Event) => void;

  private openDialogFromRef(ref: PastedVideoPreviewRef) {
    this.setState({
      file: null,
      previewUrl: ref.absoluteUrl,
      showDialog: true,
      referenceVideoKey: ref.storageKey,
      referenceCoverKey: ref.coverStorageKey,
      referenceMeta: undefined,
      uploadProgress: 0,
      uploadStage: "",
      sending: false,
    });
  }

  componentDidMount() {
    const { conversationContext } = this.props;
    // eslint-disable-next-line no-console
    console.log('[wkpaste] VideoToolbar mounted, event=', WK_PASTE_VIDEO_PREVIEW_EVENT);
    conversationContext.addDragFileCallback((file) => {
      if (file.type && file.type.startsWith("video/")) {
        this.showVideoPreview(file);
        return true;
      }
      return false;
    });

    // 主路径：MessageInput 已在 textarea 目标阶段拦截粘贴，通过 window 事件转发视频引用
    this.mediaPasteListener = (event: Event) => {
      const ref = (event as CustomEvent<PastedVideoPreviewRef>).detail;
      // eslint-disable-next-line no-console
      console.log('[wkpaste] VideoToolbar got event, ref=', ref);
      if (ref) this.openDialogFromRef(ref);
    };
    window.addEventListener(WK_PASTE_VIDEO_PREVIEW_EVENT, this.mediaPasteListener);

    // 兜底：document 捕获，覆盖 textarea 之外的粘贴目标
    this.pasteListener = (event: ClipboardEvent) => {
      if (event.clipboardData?.files && event.clipboardData.files.length > 0) return;
      const target = event.target as (Node | null);
      if (!target || !(target instanceof Element)) return;
      // textarea 的粘贴走 MessageInput 路径，避免重复
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
      if (!target.closest(".wk-conversation-footer")) return;
      const text = event.clipboardData?.getData?.("text/plain");
      if (!text) return;
      const ref = parseClipboardVideoPreview(text);
      if (!ref) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.openDialogFromRef(ref);
    };
    document.addEventListener("paste", this.pasteListener, true);
  }

  componentWillUnmount() {
    if (this.pasteListener) {
      document.removeEventListener("paste", this.pasteListener, true);
      this.pasteListener = undefined;
    }
    if (this.mediaPasteListener) {
      window.removeEventListener(WK_PASTE_VIDEO_PREVIEW_EVENT, this.mediaPasteListener);
      this.mediaPasteListener = undefined;
    }
  }

  showVideoPreview(file: File) {
    const previewUrl = URL.createObjectURL(file);
    this.setState({
      file,
      previewUrl,
      showDialog: true,
      referenceVideoKey: undefined,
      referenceCoverKey: undefined,
      referenceMeta: undefined,
    });
  }

  onReferencePreviewLoaded = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    const width = v.videoWidth || 0;
    const height = v.videoHeight || 0;
    const second = Math.max(1, Math.ceil(v.duration || 0));
    this.setState({ referenceMeta: { width, height, second } });
  };

  onFileChange = () => {
    const file = this.$input?.files?.[0];
    if (!file || !file.type.startsWith("video/")) {
      Toast.warning("请选择视频文件");
      return;
    }
    this.showVideoPreview(file);
    if (this.$input) this.$input.value = "";
  };

  onClose = () => {
    const { previewUrl, referenceVideoKey } = this.state;
    if (previewUrl && !referenceVideoKey) {
      // 仅本地 blob URL 需要 revoke；远端预览 URL 不能 revoke
      URL.revokeObjectURL(previewUrl);
    }
    this.setState({
      showDialog: false,
      file: null,
      previewUrl: "",
      referenceVideoKey: undefined,
      referenceCoverKey: undefined,
      referenceMeta: undefined,
    });
  };

  onSend = async () => {
    const { file, referenceVideoKey, referenceCoverKey, referenceMeta } = this.state;
    const { conversationContext } = this.props;
    const channel = conversationContext.channel();
    if (!channel) {
      Toast.error("未选择会话");
      return;
    }

    // 粘贴内网预览 URL 的引用发送路径：直接构造 VideoContent，跳过重复上传
    if (referenceVideoKey) {
      const vc = new VideoContent();
      vc.url = referenceVideoKey;
      vc.cover = referenceCoverKey || "";
      vc.size = 0;
      vc.width = referenceMeta?.width || 0;
      vc.height = referenceMeta?.height || 0;
      vc.second = referenceMeta?.second || 1;
      try {
        this.setState({ sending: true });
        await conversationContext.sendMessage(vc);
        Toast.success("已发送");
      } catch (e) {
        Toast.error("发送失败");
        console.error(e);
      } finally {
        this.setState({ sending: false });
        this.onClose();
      }
      return;
    }

    if (!file) return;

    this.setState({ sending: true, uploadProgress: 0, uploadStage: "上传视频中" });
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".mp4";
    const uuid = getUUID();
    const videoPath = `/${channel.channelType}/${channel.channelID}/${uuid}${ext}`;
    const coverPath = `/${channel.channelType}/${channel.channelID}/${uuid}_cover.jpg`;

    try {
      // 并行：获取两个上传URL + 生成封面
      const [uploadURL, coverUploadURL, coverResult] = await Promise.all([
        getUploadURL(videoPath),
        getUploadURL(coverPath),
        captureVideoCover(file),
      ]);
      if (!uploadURL) { Toast.error("获取上传地址失败"); return; }
      if (!coverUploadURL) { Toast.error("获取封面上传地址失败"); return; }

      this.setState({ uploadStage: "上传中" });
      const { blob, width, height, second } = coverResult;

      // 并行：同时上传视频和封面
      const [videoRemotePath, coverRemotePath] = await Promise.all([
        uploadFile(file, uploadURL, file.name, (p) => {
          this.setState({ uploadProgress: p });
        }),
        uploadFile(blob, coverUploadURL, "cover.jpg"),
      ]);
      if (!videoRemotePath) { Toast.error("视频上传失败"); return; }
      if (!coverRemotePath) { Toast.error("封面上传失败"); return; }
      const content = new VideoContent();
      content.url = videoRemotePath;
      content.cover = coverRemotePath;
      content.size = file.size;
      content.width = width;
      content.height = height;
      content.second = second;
      await conversationContext.sendMessage(content);
      Toast.success("已发送");
    } catch (e) {
      Toast.error("发送失败");
      console.error(e);
    } finally {
      this.setState({ sending: false });
      this.onClose();
    }
  };

  render() {
    const { icon } = this.props;
    const { sending, showDialog, file, previewUrl, uploadProgress, uploadStage, referenceVideoKey, referenceMeta } = this.state;
    const isReference = !!referenceVideoKey;
    const displayName = file?.name || (referenceVideoKey ? (referenceVideoKey.split("/").pop() || "视频") : "");
    const displaySizeLine = file
      ? formatFileSize(file.size)
      : referenceMeta
        ? `${referenceMeta.width}×${referenceMeta.height}  ${referenceMeta.second}s`
        : "引用服务器已有视频";
    return (
      <div className="wk-video-toolbar" style={{ display: "inline-flex", alignItems: "center" }}>
        <div
          style={{ cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1 }}
          onClick={() => !sending && this.$input?.click()}
        >
          <img src={icon} alt="视频" style={{ width: 24, height: 24 }} />
        </div>
        <input
          ref={(r) => (this.$input = r)}
          type="file"
          accept="video/*"
          style={{ display: "none" }}
          onChange={this.onFileChange}
        />
        {showDialog && (file || isReference) && (
          <div className="wk-imagedialog">
            <div className="wk-imagedialog-mask" onClick={this.onClose}></div>
            <div className="wk-imagedialog-content">
              <div className="wk-imagedialog-content-close" onClick={this.onClose}>
                <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
                  <path d="M568.92178541 508.23169412l299.36805789-299.42461715a39.13899415 39.13899415 0 0 0 0-55.1452591L866.64962537 152.02159989a39.13899415 39.13899415 0 0 0-55.08869988 0L512.19286756 451.84213173 212.76825042 151.90848141a39.13899415 39.13899415 0 0 0-55.0886999 0L155.98277331 153.54869938a38.46028327 38.46028327 0 0 0 0 55.08869987L455.46394971 508.23169412 156.03933259 807.71287052a39.13899415 39.13899415 0 0 0 0 55.08869986l1.64021795 1.6967772a39.13899415 39.13899415 0 0 0 55.08869988 0l299.42461714-299.48117638 299.36805793 299.42461714a39.13899415 39.13899415 0 0 0 55.08869984 0l1.6967772-1.64021796a39.13899415 39.13899415 0 0 0 0-55.08869987L568.86522614 508.17513487z"></path>
                </svg>
              </div>
              <div className="wk-imagedialog-content-title">发送视频</div>
              <div className="wk-imagedialog-content-body">
                <div className="wk-imagedialog-content-preview">
                  <video
                    src={previewUrl}
                    controls
                    playsInline
                    muted
                    onLoadedMetadata={isReference ? this.onReferencePreviewLoaded : undefined}
                    style={{
                      maxWidth: 200,
                      maxHeight: 240,
                      borderRadius: 4,
                      backgroundColor: "#000",
                    }}
                  />
                  <div style={{
                    flex: 1,
                    paddingLeft: 16,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}>
                    <div style={{
                      color: "var(--wk-text-item)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      lineHeight: "normal",
                      fontSize: 14,
                    }}>
                      {displayName}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: "var(--wk-color-font-tip)",
                      marginTop: 6,
                    }}>
                      {displaySizeLine}
                    </div>
                  </div>
                </div>
                {sending && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      color: "var(--wk-color-font-tip)",
                      marginBottom: 4,
                    }}>
                      <span>{uploadStage}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div style={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: "#e8e8e8",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${uploadProgress}%`,
                        backgroundColor: WKApp.config.themeColor || "#f56c2c",
                        borderRadius: 2,
                        transition: "width 0.2s ease",
                      }} />
                    </div>
                  </div>
                )}
                <div className="wk-imagedialog-footer">
                  <button onClick={this.onClose} disabled={sending}>取消</button>
                  <button
                    onClick={this.onSend}
                    className="wk-imagedialog-footer-okbtn"
                    disabled={sending}
                    style={{ backgroundColor: sending ? "gray" : WKApp.config.themeColor }}
                  >
                    {sending ? "发送中..." : "发送"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}
