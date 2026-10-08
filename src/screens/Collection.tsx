import React, { useMemo, useState } from 'react';
import { Image, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FISH, Rarity } from '../data/fish';
import { FISH_IMG, ITEM_IMG, CAT_IMG, SCENE_IMG } from '../data/assets';
import { MILESTONES, RARITIES, placeOf, skin } from '../data/game';
import { setUi, useGame } from '../state/store';
import { fmtKg } from '../game/engine';
import { RARITY_COLOR, RARITY_NAME, useLang, useT, useTheme } from '../theme';
import { Card, Chip, Header, Tap, shadow, Bar } from '../ui/kit';
import { TAB_H } from '../ui/TabBar';

export function Ring({ value, size = 56, color, track, children }: { value: number; size?: number; color: string; track: string; children?: React.ReactNode }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={6} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={6} fill="none" strokeLinecap="round"
          strokeDasharray={`${c}`} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} />
      </Svg>
      {children}
    </View>
  );
}

export default function Collection() {
  const t = useTheme();
  const tr = useT();
  const lang = useLang();
  const ins = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const coll = useGame((s) => s.collection);
  const [filter, setFilter] = useState<Rarity | 'all'>('all');
  const n = Object.keys(coll).length;
  const list = useMemo(() => FISH.filter((f) => filter === 'all' || f.rarity === filter), [filter]);
  const next = MILESTONES.find((m) => n < m.n);
  const cardW = (width - 20 * 2 - 10 * 2) / 3;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title={tr('Коллекция', 'Collection')} right={
        <Ring value={n / FISH.length} color={t.accent} track={t.card2} size={58}>
          <Text style={{ color: t.text, fontWeight: '800', fontSize: 13 }}>{n}/{FISH.length}</Text>
        </Ring>
      } />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_H(ins.bottom) + 20 }} showsVerticalScrollIndicator={false}>
        {next && (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            {next.r.skin ? <Image source={skinImg(next.r.skin)} style={{ width: 44, height: 44 }} /> : <Image source={ITEM_IMG.coin} style={{ width: 40, height: 40 }} />}
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '700' }}>
                {tr(`Ещё ${next.n - n} — и награда`, `${next.n - n} more for a reward`)}
                {next.r.skin ? `: ${lang === 'ru' ? skin(next.r.skin).ru : skin(next.r.skin).en}` : next.r.coins ? `: +${next.r.coins}` : ''}
              </Text>
              <View style={{ marginTop: 8 }}><Bar value={n / next.n} color={t.accent} /></View>
            </View>
          </Card>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <Chip label={tr('Все', 'All')} on={filter === 'all'} onPress={() => setFilter('all')} />
          {RARITIES.map((r) => (
            <Chip key={r} label={lang === 'ru' ? RARITY_NAME[r].ru : RARITY_NAME[r].en} on={filter === r} color={RARITY_COLOR[r]} onPress={() => setFilter(r)} />
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {list.map((f) => {
            const c = coll[f.id];
            const rc = RARITY_COLOR[f.rarity];
            return (
              <Tap key={f.id} disabled={!c} onPress={() => setUi({ fishCard: f.id })}
                style={[{ width: cardW, height: cardW * 1.28, borderRadius: 18, backgroundColor: c ? t.card : t.card2, padding: 8, alignItems: 'center', borderWidth: c && f.rarity !== 'common' ? 2 : 0, borderColor: rc }, c ? shadow(t) : {}]}>
                <Image source={FISH_IMG[f.id]} tintColor={c ? undefined : (t.dark ? '#4a4858' : '#cdbfa9')} style={{ width: cardW * 0.82, height: cardW * 0.82, marginTop: -4 }} />
                <Text numberOfLines={1} style={{ color: c ? t.text : t.sub, fontWeight: '700', fontSize: 12.5 }}>{c ? (lang === 'ru' ? f.ru : f.en) : '???'}</Text>
                <Text style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>{c ? fmtKg(c.best, lang) : (lang === 'ru' ? placeOf(f.place).ru : placeOf(f.place).en)}</Text>
                {c?.shiny && <Image source={ITEM_IMG.star} style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18 }} />}
                <View style={{ position: 'absolute', top: 8, left: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: rc }} />
              </Tap>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export function skinImg(id: string) {
  const s = skin(id);
  if (s.cat === 'rod') return ITEM_IMG[`rod_${s.key}`];
  if (s.cat === 'bobber') return ITEM_IMG[`bobber_${s.key}`];
  if (s.cat === 'outfit') return CAT_IMG[`player_${s.key}`];
  return SCENE_IMG[`pier_${s.key}`];
}
