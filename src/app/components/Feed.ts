/**
 * MMMMM is a mobile app for Secure Scuttlebutt networks
 *
 * Copyright (C) 2017 Andre 'Staltz' Medeiros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import xs from 'xstream';
import {PureComponent, Component} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  NativeScrollEvent,
} from 'react-native';
import {h} from '@cycle/native-screen';
import {FeedId, MsgId} from 'ssb-typescript';
import {Dimensions} from '../global-styles/dimens';
import {Typography} from '../global-styles/typography';
import {Palette} from '../global-styles/palette';
import MessageContainer from './messages/MessageContainer';
import CompactThread from './CompactThread';
import PlaceholderMessage from './messages/PlaceholderMessage';
import {GetReadable, ThreadAndExtras} from '../drivers/ssb';
import PullFlatList from 'pull-flat-list';
import {Stream, Subscription, Listener} from 'xstream';
import {propifyMethods} from 'react-propify-methods';
const pull = require('pull-stream');
const Pushable = require('pull-pushable');
const PullFlatList2 = propifyMethods(
  PullFlatList,
  'scrollToOffset' as any,
  'forceRefresh',
);

export const styles = StyleSheet.create({
  writeMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  writeMessageAuthorImage: {
    height: Dimensions.avatarSizeNormal,
    width: Dimensions.avatarSizeNormal,
    borderRadius: Dimensions.avatarBorderRadius,
    backgroundColor: Palette.indigo1,
  },

  writeInputContainer: {
    flex: 1,
    paddingLeft: Dimensions.horizontalSpaceSmall,
    alignSelf: 'stretch',
    flexDirection: 'column',
    justifyContent: 'center',
  },

  writeInput: {
    fontSize: Typography.fontSizeLarge,
    color: Palette.brand.textVeryWeak,
  },

  container: {
    alignSelf: 'stretch',
    flex: 1,
  },

  itemSeparator: {
    backgroundColor: Palette.brand.voidBackground,
    height: Dimensions.verticalSpaceNormal,
  },

  footer: {
    alignSelf: 'flex-start',
    marginLeft: Dimensions.horizontalSpaceBig,
    marginTop: Dimensions.verticalSpaceBig,
    marginBottom: Dimensions.verticalSpaceBig,
  },
});

type FeedHeaderProps = {
  showPlaceholder: boolean;
  onOpenCompose?: () => void;
};

class FeedHeader extends PureComponent<FeedHeaderProps> {
  public render() {
    const touchableProps = {
      activeOpacity: 0.6,
      onPress: this.props.onOpenCompose,
    };
    return h(View, [
      h(TouchableOpacity, touchableProps, [
        h(MessageContainer, [
          h(View, {style: styles.writeMessageRow}, [
            h(View, {style: styles.writeMessageAuthorImage}),
            h(View, {style: styles.writeInputContainer}, [
              h(
                Text,
                {
                  accessible: true,
                  accessibilityLabel: 'Feed Text Input',
                  style: styles.writeInput,
                },
                'Write a public message',
              ),
            ]),
          ]),
        ]),
      ]),
      h(FeedItemSeparator),
      this.props.showPlaceholder ? h(PlaceholderMessage) : null as any,
      this.props.showPlaceholder ? h(FeedItemSeparator) : null as any,
    ]);
  }
}

const FeedFooter = h(PlaceholderMessage);

class FeedItemSeparator extends PureComponent {
  public render() {
    return h(View, {style: styles.itemSeparator}, this.props.children as any);
  }
}

type Props = {
  getReadable: GetReadable<ThreadAndExtras> | null;
  getPublicationsReadable?: GetReadable<ThreadAndExtras> | null;
  publication$?: Stream<any> | null;
  scrollToTop$?: Stream<any> | null;
  selfFeedId: FeedId;
  showPublishHeader: boolean;
  style?: any;
  onOpenCompose?: () => void;
  onRefresh?: () => void;
  onPressLike?: (ev: {msgKey: MsgId; like: boolean}) => void;
  onPressReply?: (ev: {msgKey: MsgId; rootKey: MsgId}) => void;
  onPressAuthor?: (ev: {authorFeedId: FeedId}) => void;
  onPressExpandThread?: (ev: {rootMsgId: MsgId}) => void;
};

type State = {
  showPlaceholder: boolean;
};

const Y_OFFSET_IS_AT_TOP = 10;

export default class Feed extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {showPlaceholder: false};
    this.addedThreadsStream = Pushable();
    this.yOffset = 0;

    this._onScroll = (ev: {nativeEvent: NativeScrollEvent}) => {
      if (ev && ev.nativeEvent && ev.nativeEvent.contentOffset) {
        this.yOffset = ev.nativeEvent.contentOffset.y || 0;
      }
    };

    this._onOpenCompose = () => {
      const {onOpenCompose} = props;
      if (onOpenCompose) onOpenCompose();
    };
  }

  private addedThreadsStream: any | null;
  private yOffset: number;
  private _onOpenCompose: () => void;
  private _onScroll: (ev: {nativeEvent: NativeScrollEvent}) => void;
  private subscription?: Subscription;

  public componentDidMount() {
    this.addedThreadsStream = this.addedThreadsStream || Pushable();
    const {publication$} = this.props;
    if (publication$) {
      const listener = {next: this.onPublication.bind(this)};
      this.subscription = publication$.subscribe(listener as Listener<any>);
    }
  }

  public componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = void 0;
    }
    if (this.addedThreadsStream) {
      this.addedThreadsStream.end();
      this.addedThreadsStream = null;
    }
  }

  private onPublication() {
    const {getPublicationsReadable} = this.props;
    if (!getPublicationsReadable) return;
    const readable = getPublicationsReadable({live: true, old: false});
    if (!readable) return;
    const addedThreadsStream = this.addedThreadsStream;
    const that = this;

    that.setState({showPlaceholder: true});
    pull(
      readable,
      pull.take(1),
      pull.drain((thread: ThreadAndExtras) => {
        that.setState({showPlaceholder: false});
        addedThreadsStream.push(thread);
      }),
    );
  }

  public render() {
    const {
      onRefresh,
      onPressLike,
      onPressReply,
      onPressAuthor,
      onPressExpandThread,
      showPublishHeader,
      style,
      scrollToTop$,
      getReadable,
      selfFeedId,
    } = this.props;

    return h(PullFlatList2, {
      getScrollStream: getReadable,
      getPrefixStream: () => this.addedThreadsStream,
      style: [styles.container, style] as any,
      initialNumToRender: 2,
      pullAmount: 1,
      numColumns: 1,
      refreshable: true,
      progressViewOffset: 34,
      onRefresh,
      onScroll: this._onScroll,
      scrollToOffset$: (scrollToTop$ || xs.never())
        .filter(() => this.yOffset > Y_OFFSET_IS_AT_TOP)
        .mapTo({offset: 0, animated: true}),
      forceRefresh$: (scrollToTop$ || xs.never())
        .filter(() => this.yOffset <= Y_OFFSET_IS_AT_TOP)
        .mapTo(void 0),
      refreshColors: [Palette.indigo7],
      keyExtractor: (thread: ThreadAndExtras, index: number) =>
        thread.messages[0].key || String(index),
      ListHeaderComponent: showPublishHeader
        ? h(FeedHeader, {
            onOpenCompose: this._onOpenCompose,
            showPlaceholder: this.state.showPlaceholder,
          })
        : null,
      ItemSeparatorComponent: FeedItemSeparator,
      ListFooterComponent: FeedFooter,
      renderItem: ({item}: any) =>
        h(View, [
          h(CompactThread, {
            thread: item as ThreadAndExtras,
            selfFeedId,
            onPressLike,
            onPressReply,
            onPressAuthor,
            onPressExpand: onPressExpandThread || ((x: any) => {}),
          }),
        ]),
    });
  }
}
