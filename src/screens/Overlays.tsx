import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, ScrollView, Share, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CAT_IMG, FISH_IMG, ITEM_IMG, SCENE_IMG } from '../data/assets';
import { FISH } from '../data/fish';
import { fishDef, PLACES, bucketCap, skin, CATS, rIdx } from '../data/game';
import { getUi, setUi, useGame, useUi, toast } from '../state/store';
import { finishOnboarding, goPlace, placeRequirement, sellAll, sellOne, toggleLock, unlockPlace } from '../state/actions';
import { fmt, fmtDuration, fmtKg } from '../game/engine';
import { RARITY_COLOR, RARITY_NAME, useLang, useT, useTheme } from '../theme';
import { Btn, Card, CoinText, Sheet, Tap, shadow, Pill, Bar, useLoop } from '../ui/kit';
import { haptic, sfx } from '../ui/feedback';
import { skinImg } from './Collection';
import { maybeAskAfterSale } from '../notify';

// ---------- ведро ----------
export function BucketSheet() {
  const t = useTheme();
  const tr = useT();
  const lang = useLang();
  const { width } = useWindowDimensions();
  const open = useUi((u) => u.sheet === 'bucket');
  const bucket = useGame((s) => s.bucket);
  const lvl = useGame((s) => s.upgrades.bucket);
  const cap = bucketCap(lvl);
  const [confirm, setConfirm] = useState<string | null>(null);
  const sellable = bucket.filter((f) => !f.locked);
  const total = sellable.reduce((a, f) => a + f.value, 0);
  const lockedTotal = bucket.filter((f) => f.locked).reduce((a, f) => a + f.value, 0);
  const cardW = (width - 40 - 20) / 3;
  const close = () => { setUi({ sheet: null }); setConfirm(null); };
  const cf = confirm ? bucket.find((f) => f.uid === confirm) : null;

  return (
    <Sheet visible={open} onClose={close} height="82%">
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: t.text, fontWeight: '800', fontSize: 24 }}>{tr('Ведро', 'Bucket')} <Text style={{ color: bucket.length >= cap ? t.danger : t.sub }}>{bucket.length}/{cap}</Text></Text>
          <Tap onPress={close}><Ionicons name="close-circle" size={30} color={t.sub} /></Tap>
        </View>
        <View style={{ marginTop: 8 }}><Bar value={bucket.length / cap} color={bucket.length >= cap * 0.8 ? t.danger : t.accent} /></View>
      </View>
      {bucket.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <Image source={ITEM_IMG.icon_bucket} style={{ width: 120, height: 120, opacity: 0.9 }} />
          <Text style={{ color: t.text, fontWeight: '800', fontSize: 18, marginTop: 10 }}>{tr('Ведро пустое', 'Bucket is empty')}</Text>
          <Text style={{ color: t.sub, textAlign: 'center', marginTop: 6 }}>{tr('Закинь удочку — улов появится здесь', 'Cast your rod — your catch will show up here')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {[...bucket].sort((a, b) => b.value - a.value).map((f) => {
            const d = fishDef(f.id);
            const rc = RARITY_COLOR[d.rarity];
            return (
              <Tap key={f.uid} onPress={() => toggleLock(f.uid)} onLongPress={() => { haptic('medium'); setConfirm(f.uid); }}
                style={[{ width: cardW, borderRadius: 16, backgroundColor: t.card, padding: 8, borderWidth: d.rarity !== 'common' || f.shiny ? 2 : 0, borderColor: f.shiny ? '#F2B631' : rc }, shadow(t)]}>
                <Text numberOfLines={1} style={{ color: t.text, fontWeight: '700', fontSize: 12.5 }}>{lang === 'ru' ? d.ru : d.en}</Text>
                <Text style={{ color: t.sub, fontSize: 11 }}>{fmtKg(f.kg, lang)}</Text>
                <Image source={FISH_IMG[f.id]} style={{ width: cardW - 16, height: (cardW - 16) * 0.75 }} resizeMode="contain" />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <CoinText value={f.value} size={12} short />
                  <Ionicons name={f.locked ? 'lock-closed' : 'lock-open-outline'} size={15} color={f.locked ? t.accent : t.sub} />
                </View>
                {f.shiny && <Image source={ITEM_IMG.star} style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18 }} />}
              </Tap>
            );
          })}
        </ScrollView>
      )}
      {bucket.length > 0 && (
        <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: t.sub, fontSize: 12, flex: 1 }}>{tr('Нажми — запереть/отпереть. Долгое нажатие — продать одну.', 'Tap to lock/unlock. Long-press to sell one.')}</Text>
          </View>
          <Btn title={total > 0 ? `${tr('Продать', 'Sell')} ${sellable.length} ${tr('за', 'for')} ${fmt(total, lang)}` : tr('Всё заперто', 'Everything is locked')}
            icon={total > 0 ? <Image source={ITEM_IMG.coin} style={{ width: 22, height: 22 }} /> : undefined}
            disabled={total === 0} onPress={() => { const v = sellAll(); toast(tr(`+${fmt(v)} монет`, `+${fmt(v)} coins`), 'coin'); setTimeout(maybeAskAfterSale, 1200); }} />
          {lockedTotal > 0 && <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center' }}>{tr(`Заперто (редкие) на ${fmt(lockedTotal, lang)} — их не продаём`, `Locked (rare) worth ${fmt(lockedTotal, lang)} — kept safe`)}</Text>}
        </View>
      )}
      <Modal visible={!!cf} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <Pressable style={{ flex: 1, backgroundColor: t.overlay, justifyContent: 'center', padding: 30 }} onPress={() => setConfirm(null)}>
          {cf && (
            <Pressable style={{ backgroundColor: t.sheet, borderRadius: 24, padding: 20, gap: 12, alignItems: 'center' }}>
              <Image source={FISH_IMG[cf.id]} style={{ width: 140, height: 140 }} />
              <Text style={{ color: t.text, fontWeight: '800', fontSize: 18, textAlign: 'center' }}>
                {tr('Продать', 'Sell')} {lang === 'ru' ? fishDef(cf.id).ru : fishDef(cf.id).en} {tr('за', 'for')} {fmt(cf.value, lang)}?
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
                <Btn title={tr('Оставить', 'Keep')} kind="secondary" style={{ flex: 1 }} onPress={() => setConfirm(null)} />
                <Btn title={tr('Продать', 'Sell')} style={{ flex: 1 }} onPress={() => { sellOne(cf.uid); setConfirm(null); }} />
              </View>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </Sheet>
  );
}

// ---------- места ----------
export function SpotsSheet() {
  const t = useTheme();
  const tr = useT();
  const lang = useLang();
  const { width } = useWindowDimensions();
  const open = useUi((u) => u.sheet === 'spots');
  const s = useGame((x) => x);
  const close = () => setUi({ sheet: null });
  return (
    <Sheet visible={open} onClose={close} height="86%">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 6 }}>
        <Text style={{ color: t.text, fontWeight: '800', fontSize: 24 }}>{tr('Места', 'Fishing spots')}</Text>
        <Tap onPress={close}><Ionicons name="close-circle" size={30} color={t.sub} /></Tap>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 12 }}>
        {PLACES.map((p) => {
          const open_ = s.unlocked[p.id];
          const cur = s.place === p.id;
          const req = placeRequirement(s, p.id);
          const pool = FISH.filter((f) => f.place === p.id);
          const found = pool.filter((f) => s.collection[f.id]).length;
          const rars = Array.from(new Set(pool.map((f) => f.rarity)));
          return (
            <View key={p.id} style={[{ backgroundColor: t.card, borderRadius: 22, overflow: 'hidden', borderWidth: cur ? 3 : 0, borderColor: t.accent }, shadow(t)]}>
              <View style={{ height: 110, overflow: 'hidden' }}>
                <Image source={SCENE_IMG[`${p.id}_sunset`]} style={{ width: width - 40, height: (width - 40) * 2300 / 1080, marginTop: -(width - 40) * 0.5 }} />
                {!open_ && <View style={{ position: 'absolute', inset: 0, left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(20,16,30,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="lock-closed" size={30} color="#fff" />
                </View>}
              </View>
              <View style={{ padding: 14, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: t.text, fontWeight: '800', fontSize: 17 }}>{lang === 'ru' ? p.ru : p.en}</Text>
                  <Text style={{ color: t.sub, fontWeight: '700', fontSize: 12 }}>{found}/{pool.length} {tr('найдено', 'found')}</Text>
                </View>
                <Text style={{ color: t.sub, fontSize: 13 }}>{lang === 'ru' ? p.descRu : p.descEn}</Text>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {rars.map((r) => <View key={r} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: RARITY_COLOR[r] }} />)}
                </View>
                {cur ? (
                  <Btn title={tr('Вы здесь', "You're here")} kind="secondary" small onPress={close} />
                ) : open_ ? (
                  <Btn title={tr('Ловить здесь', 'Fish here')} small onPress={() => { goPlace(p.id); haptic('success'); close(); }} />
                ) : !req.ok ? (
                  <Btn title={lang === 'ru' ? req.needRu : req.needEn} kind="secondary" small onPress={() => p.id === 'bay' && setUi({ tab: 'shop', sheet: null })}
                    icon={<Ionicons name="lock-closed" size={14} color={t.sub} />} />
                ) : (
                  <Btn title={`${tr('Открыть за', 'Unlock for')} ${fmt(req.cost, lang)}`} small disabled={s.coins < req.cost}
                    icon={<Image source={ITEM_IMG.coin} style={{ width: 18, height: 18 }} />}
                    onPress={() => { if (unlockPlace(p.id)) { toast(tr('Новое место открыто!', 'New spot unlocked!')); close(); } }} />
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

// ---------- новая рыба / рекорд ----------
function Rays({ color, size }: { color: string; size: number }) {
  const rot = useLoop(9000, []);
  const n = 12;
  const pts = Array.from({ length: n }).map((_, i) => {
    const a0 = (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n / 1.4;
    const c = size / 2;
    return `${c},${c} ${c + Math.cos(a0) * c},${c + Math.sin(a0) * c} ${c + Math.cos(a1) * c},${c + Math.sin(a1) * c}`;
  });
  return (
    <Animated.View style={{ position: 'absolute', width: size, height: size, opacity: 0.5, transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
      <Svg width={size} height={size}>{pts.map((p, i) => <Polygon key={i} points={p} fill={color} />)}</Svg>
    </Animated.View>
  );
}

export function NewFishModal() {
  const t = useTheme();
  const tr = useT();
  const lang = useLang();
  const { width } = useWindowDimensions();
  const ev = useUi((u) => u.newFish);
  const coll = useGame((s) => Object.keys(s.collection).length);
  const a = useRef(new Animated.Value(0)).current;
  const bob = useLoop(2200, [ev?.fish.uid]);
  useEffect(() => {
    if (!ev) return;
    a.setValue(0);
    Animated.spring(a, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 120 }).start();
    haptic('success');
  }, [ev?.fish.uid]);
  if (!ev) return null;
  const d = fishDef(ev.fish.id);
  const rc = ev.fish.shiny ? '#F2B631' : RARITY_COLOR[d.rarity];
  const title = ev.fish.shiny ? tr('БЛЕСТЯЩАЯ!', 'SHINY!') : ev.isNew ? tr('НОВАЯ РЫБА!', 'NEW FISH!') : tr('НОВЫЙ РЕКОРД!', 'NEW RECORD!');
  const close = () => setUi({ newFish: null });
  const share = () => {
    Share.share({ message: tr(`Я поймал ${d.ru} весом ${fmtKg(ev.fish.kg, 'ru')} в игре «Улов»! 🎣`, `I caught a ${d.en} weighing ${fmtKg(ev.fish.kg, 'en')} in Ulov! 🎣`) }).catch(() => {});
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,10,25,0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Animated.View style={{ alignItems: 'center', width: '100%', opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
          {rIdx(d.rarity) >= 2 || ev.fish.shiny ? <Rays color={rc} size={width * 1.1} /> : null}
          <Animated.Image source={FISH_IMG[d.id]} style={{ width: width * 0.62, height: width * 0.62, marginBottom: -40, zIndex: 2,
            transform: [{ translateY: bob.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -10, 0] }) }] }} />
          <View style={{ backgroundColor: t.sheet, borderRadius: 28, paddingTop: 34, padding: 20, width: '100%', alignItems: 'center', borderWidth: 3, borderColor: rc,
            shadowColor: rc, shadowOpacity: 0.8, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } }}>
            <View style={{ position: 'absolute', top: -18, backgroundColor: '#F2B631', paddingHorizontal: 18, paddingVertical: 6, borderRadius: 12, transform: [{ rotate: '-2deg' }] }}>
              <Text style={{ color: '#3B2A1E', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>{title}</Text>
            </View>
            <Pill text={(lang === 'ru' ? RARITY_NAME[d.rarity].ru : RARITY_NAME[d.rarity].en).toUpperCase()} color={RARITY_COLOR[d.rarity]} style={{ alignSelf: 'center' }} />
            <Text style={{ color: t.text, fontWeight: '800', fontSize: 26, marginTop: 8 }}>{lang === 'ru' ? d.ru : d.en}</Text>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, alignItems: 'center' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: t.sub, fontSize: 12 }}>{tr('Вес', 'Weight')}</Text>
                <Text style={{ color: t.text, fontWeight: '800', fontSize: 18 }}>{fmtKg(ev.fish.kg, lang)}</Text>
                {ev.isRecord && <Text style={{ color: t.good, fontSize: 11, fontWeight: '700' }}>{tr('было', 'was')} {fmtKg(ev.prevBest, lang)}</Text>}
              </View>
              <View style={{ width: 1, height: 34, backgroundColor: t.line }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: t.sub, fontSize: 12 }}>{tr('Цена', 'Value')}</Text>
                <CoinText value={ev.fish.value} size={18} />
              </View>
            </View>
            {ev.isNew && <Text style={{ color: t.sub, marginTop: 10 }}>{tr('Коллекция', 'Collection')} {coll}/{FISH.length}</Text>}
            {ev.soldInstead && <Text style={{ color: t.danger, marginTop: 8, textAlign: 'center' }}>{tr('Ведро полное — рыба продана', 'Bucket full — the fish was sold')}</Text>}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' }}>
              <Btn title={tr('Поделиться', 'Share')} kind="secondary" style={{ flex: 1 }} onPress={share} icon={<Ionicons name="share-outline" size={18} color={t.text} />} />
              <Btn title={ev.inBucket ? tr('В ведро', 'To bucket') : tr('Отлично', 'Great')} style={{ flex: 1.3 }} onPress={close} />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------- пока тебя не было ----------
export function WelcomeModal() {
  const t = useTheme();
  const tr = useT();
  const lang = useLang();
  const ev = useUi((u) => u.welcome);
  const cats = useGame((s) => s.cats);
  if (!ev) return null;
  const total = ev.toBucket + ev.autoSold;
  const close = () => setUi({ welcome: null });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,10,25,0.6)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: t.sheet, borderRadius: 28, padding: 22, alignItems: 'center', gap: 6 }}>
          <Text style={{ color: t.text, fontWeight: '800', fontSize: 22 }}>{tr('Пока тебя не было', 'While you were away')}</Text>
          <Text style={{ color: t.sub }}>{fmtDuration(ev.seconds, lang)}</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginVertical: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {ev.perCat.map((p) => {
              const c = CATS.find((x) => x.id === p.id)!;
              return (
                <View key={p.id} style={{ alignItems: 'center' }}>
                  <Image source={CAT_IMG[`helper_${p.id}_0`]} style={{ width: 64, height: 64 }} />
                  <Text style={{ color: t.text, fontWeight: '800' }}>+{p.n}</Text>
                  <Text style={{ color: t.sub, fontSize: 10 }} numberOfLines={1}>{cats[p.id]?.name || (lang === 'ru' ? c.ru : c.en)}</Text>
                </View>
              );
            })}
          </View>
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>{tr(`Коты поймали ${total} рыб`, `Cats caught ${total} fish`)}</Text>
          <Text style={{ color: t.text }}>{tr('В ведро', 'To bucket')}: <Text style={{ fontWeight: '800' }}>{ev.toBucket}</Text></Text>
          {ev.autoSold > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: t.text }}>{tr(`Продано автоматически: ${ev.autoSold} →`, `Auto-sold: ${ev.autoSold} →`)}</Text>
              <CoinText value={ev.coins} size={15} />
            </View>
          )}
          <Btn title={tr('Забрать', 'Collect')} style={{ alignSelf: 'stretch', marginTop: 14 }} onPress={() => { sfx('coin'); haptic('success'); close(); }} />
        </View>
      </View>
    </Modal>
  );
}

// ---------- награды / звание / редкость собрана ----------
export function RewardModal() {
  const t = useTheme();
  const tr = useT();
  const lang = useLang();
  const rewards = useUi((u) => u.rewards);
  const rank = useUi((u) => u.rankUp);
  const set = useUi((u) => u.setDone);
  const newFish = useUi((u) => u.newFish);
  if (newFish) return null; // сначала карточка рыбы
  let title = '', sub = '', skinId: string | undefined, coins: number | undefined, onClose = () => {};
  if (set) {
    title = tr('Редкость собрана!', 'Rarity complete!');
    sub = lang === 'ru' ? set.ru : set.en;
    onClose = () => setUi({ setDone: null });
  } else if (rank) {
    title = tr('Новое звание!', 'New rank!');
    sub = lang === 'ru' ? rank.ru : rank.en;
    skinId = rank.skin;
    onClose = () => setUi({ rankUp: null });
  } else if (rewards.length) {
    const r = rewards[0];
    title = tr('Награда!', 'Reward!');
    sub = lang === 'ru' ? r.ru : r.en;
    skinId = r.skin;
    coins = r.coins;
    onClose = () => setUi({ rewards: getUi().rewards.slice(1) });
  } else return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,10,25,0.68)', justifyContent: 'center', padding: 28 }}>
        <View style={{ backgroundColor: t.sheet, borderRadius: 28, padding: 22, alignItems: 'center', gap: 8, borderWidth: 3, borderColor: '#F2B631' }}>
          <Ionicons name={set ? 'trophy' : rank ? 'ribbon' : 'gift'} size={40} color="#F2B631" />
          <Text style={{ color: t.text, fontWeight: '900', fontSize: 22 }}>{title}</Text>
          <Text style={{ color: t.sub, fontSize: 15, textAlign: 'center' }}>{sub}</Text>
          {skinId && (
            <View style={{ alignItems: 'center', marginTop: 6 }}>
              <Image source={skinImg(skinId)} style={{ width: 120, height: 120, borderRadius: 16 }} />
              <Text style={{ color: t.text, fontWeight: '800', marginTop: 4 }}>{tr('Скин', 'Skin')}: {lang === 'ru' ? skin(skinId).ru : skin(skinId).en}</Text>
            </View>
          )}
          {coins ? <View style={{ marginTop: 6 }}><CoinText value={coins} size={22} /></View> : null}
          <Btn title={tr('Забрать', 'Claim')} style={{ alignSelf: 'stretch', marginTop: 10 }} onPress={() => { sfx('success'); haptic('success'); onClose(); }} />
        </View>
      </View>
    </Modal>
  );
}

// ---------- карточка рыбы ----------
export function FishCardModal() {
  const t = useTheme();
  const tr = useT();
  const lang = useLang();
  const { width } = useWindowDimensions();
  const id = useUi((u) => u.fishCard);
  const c = useGame((s) => (id ? s.collection[id] : undefined));
  if (!id || !c) return null;
  const d = fishDef(id);
  const p = PLACES.find((x) => x.id === d.place)!;
  const close = () => setUi({ fishCard: null });
  const Stat = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: t.line }}>
      <Text style={{ color: t.sub }}>{k}</Text>
      {typeof v === 'string' ? <Text style={{ color: t.text, fontWeight: '700' }}>{v}</Text> : v}
    </View>
  );
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: t.overlay }} onPress={close} />
      <View style={{ backgroundColor: t.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 40, alignItems: 'center' }}>
        <Image source={FISH_IMG[id]} style={{ width: width * 0.6, height: width * 0.6, marginTop: -width * 0.25 }} />
        <Pill text={(lang === 'ru' ? RARITY_NAME[d.rarity].ru : RARITY_NAME[d.rarity].en).toUpperCase()} color={RARITY_COLOR[d.rarity]} style={{ alignSelf: 'center' }} />
        <Text style={{ color: t.text, fontWeight: '800', fontSize: 26, marginTop: 6 }}>{lang === 'ru' ? d.ru : d.en}</Text>
        <View style={{ alignSelf: 'stretch', marginTop: 12 }}>
          <Stat k={tr('Где водится', 'Found at')} v={lang === 'ru' ? p.ru : p.en} />
          <Stat k={tr('Поймано', 'Caught')} v={fmt(c.count, lang)} />
          <Stat k={tr('Рекорд веса', 'Record weight')} v={fmtKg(c.best, lang)} />
          <Stat k={tr('Вес бывает', 'Weight range')} v={`${fmtKg(d.kgMin, lang)} – ${fmtKg(d.kgMax, lang)}`} />
          <Stat k={tr('Цена за кг', 'Price per kg')} v={<CoinText value={d.ppk} size={14} />} />
          <Stat k={tr('Блестящая', 'Shiny')} v={c.shiny ? tr('Поймана ✨', 'Caught ✨') : tr('Ещё нет (шанс ~1%)', 'Not yet (~1% chance)')} />
        </View>
        <Btn title={tr('Закрыть', 'Close')} kind="secondary" style={{ alignSelf: 'stretch', marginTop: 16 }} onPress={close} />
      </View>
    </Modal>
  );
}

// ---------- обучение ----------
export function Onboarding() {
  const t = useTheme();
  const tr = useT();
  const ins = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [i, setI] = useState(0);
  const slides = [
    { img: CAT_IMG.player_sailor, title: tr('Закинь', 'Cast'), text: tr('Нажми «Закинуть» и жди поклёвки', 'Tap Cast and wait for a bite') },
    { img: ITEM_IMG.bobber_classic, title: tr('Подсеки', 'Hook it'), text: tr('Поплавок нырнул — жми! Редкую рыбу тяни, держа кнопку', 'Bobber dives — tap! Reel rare fish in by holding the button') },
    { img: ITEM_IMG.icon_bucket_full, title: tr('Продавай и собирай', 'Sell and collect'), text: tr('Находи редких рыб, нанимай котов и открывай скины', 'Find rare fish, hire cats and unlock skins') },
  ];
  const s = slides[i];
  const done = () => { finishOnboarding(); haptic('success'); };
  return (
    <View style={{ ...StyleAbs, backgroundColor: t.bg }}>
      <Image source={SCENE_IMG[t.dark ? 'pier_night' : 'pier_sunset']} style={{ position: 'absolute', width, height: width * 2300 / 1080, opacity: 0.35 }} />
      <View style={{ flex: 1, paddingTop: ins.top + 10, paddingBottom: ins.bottom + 20, paddingHorizontal: 24 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Tap onPress={done}><Text style={{ color: t.sub, fontWeight: '700', fontSize: 15, padding: 8 }}>{tr('Пропустить', 'Skip')}</Text></Tap>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: width * 0.66, height: width * 0.66, borderRadius: width, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', ...shadow(t) }}>
            <Image source={s.img} style={{ width: width * 0.56, height: width * 0.56 }} />
          </View>
          <Text style={{ color: t.text, fontWeight: '900', fontSize: 34, marginTop: 30 }}>{s.title}</Text>
          <Text style={{ color: t.sub, fontSize: 17, textAlign: 'center', marginTop: 10, lineHeight: 24 }}>{s.text}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          {slides.map((_, k) => <View key={k} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? t.accent : t.line }} />)}
        </View>
        <Btn title={i < 2 ? tr('Далее', 'Next') : tr('Начать рыбалку', 'Start fishing')} onPress={() => (i < 2 ? setI(i + 1) : done())} />
      </View>
    </View>
  );
}
const StyleAbs = { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0 };
