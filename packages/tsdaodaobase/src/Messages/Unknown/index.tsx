import { UnknownContent } from "wukongimjssdk";
import React from "react";
import MessageBase from "../Base";
import { MessageCell } from "../MessageCell";
import { MessageContentTypeConst } from "../../Service/Const";
import { VideoCell } from "../Video";

export class UnknownCell extends MessageCell {
  render() {
    const { message, context } = this.props;
    const content = message.content as UnknownContent;

    if (content.realContentType === MessageContentTypeConst.smallVideo) {
      return <VideoCell message={message} context={context} />;
    }

    return (
      <MessageBase context={context} message={message}>
        [此消息不支持查看，请至手机端查看详情({content.realContentType})]
      </MessageBase>
    );
  }
}