import { IModule, WKApp, MessageContentTypeConst } from "@tsdaodao/base";
import { WKSDK } from "wukongimjssdk";
import React from "react";
import { ElementType } from "react";
import FileToolbar from "./FileToolbar";
import { FileCell, FileContent } from "./Messages/File";



export default class FileModule implements IModule {
    id(): string {
        return "FileModule"
    }
    init(): void {
        console.log("【FileModule】初始化")

        WKSDK.shared().register(MessageContentTypeConst.file, () => new FileContent()) // 文件

        WKApp.messageManager.registerCell(MessageContentTypeConst.file, (): ElementType => {
            return FileCell
        })

        // 历史上这里错用了 "chattoolbar.image" key，覆盖了 base 的真正 ImageToolbar（导致粘贴弹窗失效）。
        // 统一改成 chattoolbar.file：和文件本意一致，让 base 的 ImageToolbar 得以正常挂载。
        WKApp.endpoints.registerChatToolbar("chattoolbar.file",(ctx)=>{
            return <FileToolbar icon={require("./assets/func_file_normal.svg").default} conversationContext={ctx}></FileToolbar>
        })
    }


}