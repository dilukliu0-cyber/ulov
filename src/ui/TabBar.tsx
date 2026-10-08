import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { setUi, useGame, useUi, UiState } from '../state/store';
import { bucketCap } from '../data/game';
import { useT, useTheme } from '../theme';
import { Tap } from './kit';

export const TAB_H = (bottomInset: number) => 62 + Math.max(bottomInset, 8);

export default function TabBar() {
  const t = useTheme();
  const tr = useT();
  const ins = useSafeAreaInsets();
  const tab = useUi((u) => u.tab);
  const full = useGame((s) => s.bucket.length >= bucketCap(s.upgrades.bucket));
  const tabs: { id: UiState['tab']; icon: any; on: any; label: string; dot?: boolean }[] = [
    { id: 'fish', icon: 'fish-outline', on: 'fish', label: tr('Рыбалка', 'Fishing'), dot: full },
    { id: 'collection', icon: 'book-outline', on: 'book', label: tr('Коллекция', 'Collection') },
    { id: 'shop', icon: 'storefront-outline', on: 'storefront', label: tr('Магазин', 'Shop') },
    { id: 'cats', icon: 'paw-outline', on: 'paw', label: tr('Коты', 'Cats') },
    { id: 'profile', icon: 'person-circle-outline', on: 'person-circle', label: tr('Профиль', 'Profile') },
  ];
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: TAB_H(ins.bottom), paddingBottom: Math.max(ins.bottom, 8),
      backgroundColor: t.sheet, flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: t.line, paddingHorizontal: 6 }}>
      {tabs.map((it) => {
        const on = tab === it.id;
        return (
          <Tap key={it.id} hapt="select" scale={0.9} onPress={() => setUi({ tab: it.id, sheet: null })} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 6 }}>
            <View style={{ paddingHorizontal: 14, paddingVertical: 4, borderRadius: 14, backgroundColor: on ? (t.dark ? 'rgba(242,107,91,0.2)' : 'rgba(242,107,91,0.14)') : 'transparent' }}>
              <Ionicons name={on ? it.on : it.icon} size={23} color={on ? t.accent : t.sub} />
              {it.dot && <View style={{ position: 'absolute', top: 2, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: t.danger, borderWidth: 1.5, borderColor: t.sheet }} />}
            </View>
            <Text style={{ fontSize: 10.5, marginTop: 2, fontWeight: on ? '700' : '600', color: on ? t.accent : t.sub }}>{it.label}</Text>
          </Tap>
        );
      })}
    </View>
  );
}
