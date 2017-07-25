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

import xs, {Stream, Listener} from 'xstream';
import {ReactElement} from 'react';
import {h} from '@cycle/native-screen';
import {View, Text} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {PeerMetadata} from '../types';
import {styles, iconProps} from './styles';
import LocalPeerMetadata from '../components/LocalPeerMetadata';

export default function view(connectedPeers$: Stream<Array<PeerMetadata>>) {
  return connectedPeers$.map(connectedPeers =>
    h(View, {style: styles.container}, [
      h(View, {style: styles.headerContainer}, [
        h(Text, {style: styles.headerText}, 'Peers around you'),
        h(Icon, {
          ...iconProps.info,
          name: 'information-outline',
          style: styles.infoIcon as any
        })
      ]),
      ...connectedPeers.map(peer => h(LocalPeerMetadata, {peer}))
    ])
  );
}
