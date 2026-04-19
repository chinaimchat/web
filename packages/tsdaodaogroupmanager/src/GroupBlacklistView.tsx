import React, { Component } from "react";
import { Channel, Subscriber } from "wukongimjssdk";
import {
  WKApp,
  Row,
  Section,
  ListItemIcon,
  SubscriberStatus,
} from "@tsdaodao/base";
import { Toast } from "@douyinfe/semi-ui";
import Sections from "@tsdaodao/base/src/Components/Sections";

export default class GroupBlacklistView extends Component<{ channel: Channel }> {
  state: { list: Subscriber[] } = { list: [] };

  componentDidMount() {
    WKApp.dataSource.channelDataSource.subscribers(this.props.channel, {}).then((all) => {
      this.setState({ list: all.filter((s) => s.status === SubscriberStatus.blacklist) });
    });
  }

  render() {
    const { channel } = this.props;
    const { list } = this.state;
    if (list.length === 0) return <div className="wk-section-subtitle">暂无黑名单成员</div>;
    return (
      <Sections
        sections={[
          new Section({
            rows: list.map((s) =>
              new Row({
                cell: ListItemIcon,
                properties: {
                  title: s.remark || s.name || s.uid,
                  icon: (
                    <img
                      style={{ width: 24, height: 24, borderRadius: "50%" }}
                      src={WKApp.shared.avatarUser(s.uid)}
                      alt=""
                    />
                  ),
                  onClick: () => {
                    WKApp.dataSource.channelDataSource
                      .blacklistRemove(channel, [s.uid])
                      .then(() => {
                        this.setState({ list: this.state.list.filter((x) => x.uid !== s.uid) });
                      })
                      .catch((err) => Toast.error(err.msg));
                  },
                },
              })
            ),
          }),
        ]}
      />
    );
  }
}
