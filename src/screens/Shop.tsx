import React, { useState } from 'react';
import { Image, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Polygon } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CAT_IMG, ITEM_IMG, PLAYER_META, SCENE_IMG } from '../data/assets';
import {
  UPG_INFO, UpgKind, upgCost, MAX_LV, BOAT_COST, SKINS, SKIN_CATS, SkinCat, skin, ROD_STYLE,
} from '../data/game';
import { toast, useGame } from '../state/store';
import { buyBoat, buySkin, buyUpgrade, equipSkin, resetSkin } from '../state/actions';
import { fmt } from '../game/engine';
import { RARITY_COLOR, useIsDark, useLang, useT, useTheme } from '../theme';
import { Btn, Card, Chip, CoinText, Header, Segmented, Tap, shadow } from '../ui/kit';
import { TAB_H } from '../ui/TabBar';
import { skinImg } from './Collection';

export default function Shop() {
  const t = useTheme();
  const tr = useT();
  const ins = useSafeAreaInsets();
  const coins = useGame((s) => s.coins);
  const [seg, setSeg] = useState<'up' | 'skins'>('up');
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title={tr('Магазин', 'Shop')} right={<View style={[{ backgroundColor: t.card, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 }, shadow(t)]}><CoinText value={coins} /></View>} />
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <Segmented value={seg} onChange={setSeg} items={[{ id: 'up', label: tr('Улучшения', 'Upgrades') }, { id: 'skins', label: tr('Скины', 'Skins') }]} />
      </View>
      {seg === 'up' ? <Upgrades /> : <Skins />}
    </View>
  );
}

function Upgrades() {
  const t = useTheme();
  const tr = useT();
  const lang = useLang();
  const ins = useSafeAreaInsets();
  const up = useGame((s) => s.upgrades);
  const coins = useGame((s) => s.coins);
  const boat = useGame((s) => s.boat);
  const kinds: UpgKind[] = ['rod', 'line', 'bait', 'bucket'];
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_H(ins.bottom) + 20, gap: 12 }} showsVerticalScrollIndicator={false}>
      {kinds.map((k) => {
        const info = UPG_INFO[k];
        const lv = up[k];
        const max = lv >= MAX_LV;
        const cost = max ? 0 : upgCost(k, lv);
        const can = coins >= cost;
        return (
          <Card key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: t.card2, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={ITEM_IMG[info.img]} style={{ width: 54, height: 54 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{lang === 'ru' ? info.ru : info.en} <Text style={{ color: t.sub, fontWeight: '600', fontSize: 13 }}>{tr('ур.', 'lvl')} {lv}</Text></Text>
              <View style={{ flexDirection: 'row', gap: 3, marginVertical: 5 }}>
                {Array.from({ length: MAX_LV }).map((_, i) => (
                  <View key={i} style={{ width: 10, height: 6, borderRadius: 3, backgroundColor: i < lv ? t.accent : t.card2 }} />
                ))}
              </View>
              <Text style={{ color: t.sub, fontSize: 12 }}>{lang === 'ru' ? info.effRu(lv) : info.effEn(lv)}</Text>
              {!max && <Text style={{ color: t.good, fontSize: 12, fontWeight: '700', marginTop: 2 }}>→ {lang === 'ru' ? info.effRu(lv + 1) : info.effEn(lv + 1)}</Text>}
            </View>
            {max ? (
              <View style={{ backgroundColor: t.card2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ fontWeight: '800', color: t.sub }}>{tr('МАКС', 'MAX')}</Text></View>
            ) : (
              <Tap onPress={() => { if (!buyUpgrade(k)) toast(tr(`Не хватает ${fmt(cost - coins)}`, `Need ${fmt(cost - coins)} more`), 'coin'); }}
                style={{ backgroundColor: can ? t.accent : t.card2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }}>
                <CoinText value={cost} size={13} short color={can ? '#fff' : t.sub} />
              </Tap>
            )}
          </Card>
        );
      })}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: t.card2, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={ITEM_IMG.icon_boat} style={{ width: 56, height: 56 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{tr('Лодка', 'Boat')}</Text>
          <Text style={{ color: t.sub, fontSize: 12, marginTop: 4 }}>{tr('Открывает «Залив с лодкой»: новые рыбы, до эпических', 'Unlocks Rowboat Bay: new fish up to Epic')}</Text>
        </View>
        {boat ? (
          <Ionicons name="checkmark-circle" size={30} color={t.good} />
        ) : (
          <Tap onPress={() => { if (!buyBoat()) toast(tr(`Не хватает ${fmt(BOAT_COST - coins)}`, `Need ${fmt(BOAT_COST - coins)} more`), 'coin'); else toast(tr('Залив открыт! Выбери место сверху', 'Bay unlocked! Pick it at the top'), 'icon_boat'); }}
            style={{ backgroundColor: coins >= BOAT_COST ? t.accent : t.card2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }}>
            <CoinText value={BOAT_COST} size={13} short color={coins >= BOAT_COST ? '#fff' : t.sub} />
          </Tap>
        )}
      </Card>
    </ScrollView>
  );
}

/** Мини-сцена: кот в наряде, удочка, поплавок, фон */
export function Preview({ outfit, rod, bobber, scene, height = 200 }: { outfit: string; rod: string; bobber: string; scene: string; height?: number }) {
  const { width } = useWindowDimensions();
  const W = width - 40;
  const S = height * 0.92;
  const left = W * 0.3 - S * 0.44;
  const top = height - S * 0.98;
  const pm = PLAYER_META[outfit] || { paw: [0.53, 0.67] };
  const paw = { x: left + pm.paw[0] * S, y: top + pm.paw[1] * S };
  const tip = { x: paw.x + W * 0.3, y: Math.max(12, paw.y - height * 0.55) };
  const rs = ROD_STYLE[rod] || ROD_STYLE.bamboo;
  const bob = { x: tip.x + 18, y: height * 0.8 };
  const dx = tip.x - paw.x, dy = tip.y - paw.y, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
  const poly = [[paw.x + nx * 5, paw.y + ny * 5], [tip.x + nx * 1.4, tip.y + ny * 1.4], [tip.x - nx * 1.4, tip.y - ny * 1.4], [paw.x - nx * 5, paw.y - ny * 5]].map((p) => p.join(',')).join(' ');
  return (
    <View style={{ width: W, height, borderRadius: 22, overflow: 'hidden', backgroundColor: '#000' }}>
      <Image source={SCENE_IMG[`pier_${scene}`]} style={{ position: 'absolute', width: W, height: W * 2300 / 1080, top: -W * 0.42 }} />
      <Svg width={W} height={height} style={{ position: 'absolute' }}>
        <Line x1={tip.x} y1={tip.y} x2={bob.x} y2={bob.y} stroke="rgba(255,255,255,0.9)" strokeWidth={1.3} />
      </Svg>
      <Image source={CAT_IMG[`player_${outfit}`]} style={{ position: 'absolute', left, top, width: S, height: S }} />
      <Svg width={W} height={height} style={{ position: 'absolute' }}>
        <Polygon points={poly} fill={rs.base} stroke={rs.grip} strokeWidth={0.8} />
        <Line x1={paw.x - dx * 0.1} y1={paw.y - dy * 0.1} x2={paw.x + dx * 0.15} y2={paw.y + dy * 0.15} stroke={rs.grip} strokeWidth={7} strokeLinecap="round" />
      </Svg>
      <Image source={ITEM_IMG[`bobber_${bobber}`]} style={{ position: 'absolute', left: bob.x - 18, top: bob.y - 24, width: 36, height: 36 }} />
    </View>
  );
}

function Skins() {
  const t = useTheme();
  const tr = useT();
  const lang = useLang();
  const dark = useIsDark();
  const ins = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const owned = useGame((s) => s.owned);
  const eq = useGame((s) => s.equipped);
  const coins = useGame((s) => s.coins);
  const [cat, setCat] = useState<SkinCat>('rod');
  const [sel, setSel] = useState<string | null>(null);
  const list = SKINS.filter((s) => s.cat === cat);
  const selected = sel && skin(sel).cat === cat ? skin(sel) : null;

  const eqKey = (c: SkinCat) => {
    const id = (eq as any)[c] as string;
    if (c === 'scene' && id === 'auto') return dark ? 'night' : 'sunset';
    return skin(id).key;
  };
  const pv = (c: SkinCat) => (selected && selected.cat === c ? selected.key : eqKey(c));
  const cardW = (width - 40 - 20) / 3;
  const isEq = (id: string) => (eq as any)[skin(id).cat] === id;

  let action: React.ReactNode = null;
  if (selected) {
    const has = owned.includes(selected.id);
    if (isEq(selected.id)) action = <Btn title={tr('Надето', 'Equipped')} kind="secondary" onPress={() => {}} />;
    else if (has) action = <Btn title={tr('Надеть', 'Equip')} onPress={() => equipSkin(selected.id)} />;
    else if (selected.price != null) action = (
      <Btn title={`${tr('Купить за', 'Buy for')} ${fmt(selected.price, lang)}`} icon={<Image source={ITEM_IMG.coin} style={{ width: 20, height: 20 }} />}
        disabled={coins < selected.price} onPress={() => { if (buySkin(selected.id)) { equipSkin(selected.id); toast(tr('Куплено и надето!', 'Bought and equipped!')); } }} />
    );
    else action = <Btn title={lang === 'ru' ? selected.rewardRu! : selected.rewardEn!} kind="secondary" onPress={() => {}} icon={<Ionicons name="lock-closed" size={16} color={t.sub} />} />;
  }

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_H(ins.bottom) + 20 }} showsVerticalScrollIndicator={false}>
      <Preview outfit={pv('outfit')} rod={pv('rod')} bobber={pv('bobber')} scene={pv('scene')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 14 }}>
        {SKIN_CATS.map((c) => <Chip key={c.id} label={lang === 'ru' ? c.ru : c.en} on={cat === c.id} onPress={() => { setCat(c.id); setSel(null); }} />)}
      </ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {list.map((s) => {
          const has = owned.includes(s.id);
          const on = sel === s.id;
          const rc = RARITY_COLOR[s.rarity];
          return (
            <Tap key={s.id} onPress={() => setSel(s.id)} style={[{ width: cardW, borderRadius: 18, backgroundColor: t.card, padding: 8, alignItems: 'center', borderWidth: on ? 3 : 2, borderColor: on ? t.accent : s.rarity === 'common' ? t.line : rc }, shadow(t)]}>
              <Image source={skinImg(s.id)} style={{ width: cardW - 22, height: cardW - 22, borderRadius: s.cat === 'scene' ? 12 : 0 }} resizeMode="cover" />
              <Text numberOfLines={1} style={{ color: t.text, fontWeight: '700', fontSize: 12.5, marginTop: 4 }}>{lang === 'ru' ? s.ru : s.en}</Text>
              <View style={{ marginTop: 4, minHeight: 20, justifyContent: 'center' }}>
                {isEq(s.id) ? <Text style={{ color: t.good, fontWeight: '800', fontSize: 11 }}>{tr('НАДЕТО', 'EQUIPPED')}</Text>
                  : has ? <Text style={{ color: t.sub, fontWeight: '700', fontSize: 11 }}>{tr('Есть', 'Owned')}</Text>
                  : s.price != null ? <CoinText value={s.price} size={12} short />
                  : <Ionicons name="gift" size={16} color={rc} />}
              </View>
              {!has && <Ionicons name="lock-closed" size={14} color={t.sub} style={{ position: 'absolute', top: 8, right: 8 }} />}
            </Tap>
          );
        })}
      </View>
      <View style={{ marginTop: 14, gap: 10 }}>
        {action}
        <Btn title={cat === 'scene' ? tr('Фон по теме (авто)', 'Scene follows theme (auto)') : tr('Сбросить на стандартный', 'Reset to default')} kind="ghost" small onPress={() => { resetSkin(cat); setSel(null); }} />
      </View>
    </ScrollView>
  );
}
