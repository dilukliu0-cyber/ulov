import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CAT_IMG } from '../data/assets';
import { CATS, catUpgCost, catRate, catTier, MAX_LV, PLACES } from '../data/game';
import type { PlaceId } from '../data/fish';
import { toast, useGame } from '../state/store';
import { hireCat, renameCat, setCatPlace, upgradeCat } from '../state/actions';
import { catCanFish, catIncomePerMin, fmt } from '../game/engine';
import { useLang, useT, useTheme } from '../theme';
import { Btn, Card, CoinText, Header, Tap, shadow, Bar } from '../ui/kit';
import { TAB_H } from '../ui/TabBar';

export default function Cats() {
  const t = useTheme();
  const tr = useT();
  const lang = useLang();
  const ins = useSafeAreaInsets();
  const cats = useGame((s) => s.cats);
  const coins = useGame((s) => s.coins);
  const unlocked = useGame((s) => s.unlocked);
  const [rename, setRename] = useState<string | null>(null);
  const [nameVal, setNameVal] = useState('');

  const total = CATS.reduce((a, c) => a + (cats[c.id].hired ? catIncomePerMin(c, cats[c.id].level, cats[c.id].place) : 0), 0);
  const fishPerMin = CATS.reduce((a, c) => a + (cats[c.id].hired && catCanFish(cats[c.id].place) ? catRate(c, cats[c.id].level) : 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title={tr('Коты-рыбаки', 'Cat Crew')} right={<View style={[{ backgroundColor: t.card, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 }, shadow(t)]}><CoinText value={coins} /></View>} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_H(ins.bottom) + 20, gap: 12 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: t.accent, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name="trending-up" size={26} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>≈ {fmt(total, lang)} {tr('монет в минуту', 'coins per minute')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
              {tr(`${fishPerMin.toFixed(1).replace('.', ',')} рыб/мин в ведро. Ловят и когда игра закрыта (до 8 ч).`, `${fishPerMin.toFixed(1)} fish/min into the bucket. They fish while you're away (up to 8h).`)}
            </Text>
          </View>
        </View>

        {CATS.map((c) => {
          const st = cats[c.id];
          const name = st.name || (lang === 'ru' ? c.ru : c.en);
          const img = CAT_IMG[`helper_${c.id}_${catTier(st.level)}`];
          if (!st.hired) {
            const can = coins >= c.cost;
            return (
              <Card key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: 0.96 }}>
                <Image source={img} tintColor={t.dark ? '#4a4858' : '#cdbfa9'} style={{ width: 76, height: 76 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{lang === 'ru' ? c.ru : c.en}</Text>
                  <Text style={{ color: t.sub, fontSize: 12, marginTop: 3 }}>{tr(`${c.rate} рыб/мин на 1-м уровне`, `${c.rate} fish/min at level 1`)}</Text>
                </View>
                <Tap onPress={() => { if (hireCat(c.id)) toast(tr(`${c.ru} теперь в команде!`, `${c.en} joined the crew!`), 'paw'); else toast(tr(`Не хватает ${fmt(c.cost - coins)}`, `Need ${fmt(c.cost - coins)} more`), 'coin'); }}
                  style={{ backgroundColor: can ? t.accent : t.card2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center' }}>
                  <Text style={{ color: can ? '#fff' : t.sub, fontWeight: '800', fontSize: 13 }}>{c.cost === 0 ? tr('Нанять бесплатно', 'Hire free') : tr('Нанять', 'Hire')}</Text>
                  {c.cost > 0 && <CoinText value={c.cost} size={12} short color={can ? '#fff' : t.sub} />}
                </Tap>
              </Card>
            );
          }
          const max = st.level >= MAX_LV;
          const cost = max ? 0 : catUpgCost(c, st.level);
          const can = coins >= cost;
          const canHere = catCanFish(st.place);
          return (
            <Card key={c.id} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Image source={img} style={{ width: 76, height: 76 }} />
                <View style={{ flex: 1 }}>
                  <Tap hapt="select" onPress={() => { setRename(c.id); setNameVal(st.name); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{name}</Text>
                    <Ionicons name="pencil" size={14} color={t.sub} />
                  </Tap>
                  <Text style={{ color: t.sub, fontSize: 12, marginTop: 2 }}>
                    {tr('ур.', 'lvl')} {st.level} · {canHere ? `≈ ${fmt(catIncomePerMin(c, st.level, st.place), lang)} ${tr('в мин', '/min')}` : tr('здесь не ловит', "can't fish here")}
                  </Text>
                  <View style={{ marginTop: 6 }}><Bar value={st.level / MAX_LV} color={t.good} height={6} /></View>
                  <Text style={{ color: t.sub, fontSize: 11, marginTop: 4 }}>
                    {st.level < 5 ? tr('Новый наряд на 5 уровне', 'New outfit at level 5') : st.level < 10 ? tr('Медаль на 10 уровне', 'Medal at level 10') : tr('Максимальный ранг!', 'Top rank!')}
                  </Text>
                </View>
                {max ? <View style={{ backgroundColor: t.card2, borderRadius: 12, padding: 9 }}><Text style={{ fontWeight: '800', color: t.sub }}>{tr('МАКС', 'MAX')}</Text></View> : (
                  <Tap onPress={() => { if (!upgradeCat(c.id)) toast(tr(`Не хватает ${fmt(cost - coins)}`, `Need ${fmt(cost - coins)} more`), 'coin'); }}
                    style={{ backgroundColor: can ? t.accent : t.card2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, alignItems: 'center' }}>
                    <Text style={{ color: can ? '#fff' : t.sub, fontWeight: '800', fontSize: 12 }}>{tr('Улучшить', 'Upgrade')}</Text>
                    <CoinText value={cost} size={12} short color={can ? '#fff' : t.sub} />
                  </Tap>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {PLACES.filter((p) => unlocked[p.id] && catCanFish(p.id)).map((p) => {
                  const on = st.place === p.id;
                  return (
                    <Tap key={p.id} hapt="select" onPress={() => setCatPlace(c.id, p.id as PlaceId)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: on ? t.accent : t.card2 }}>
                      <Text style={{ color: on ? '#fff' : t.text, fontWeight: '700', fontSize: 12 }}>{lang === 'ru' ? p.ru : p.en}</Text>
                    </Tap>
                  );
                })}
              </View>
            </Card>
          );
        })}
        <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
          {tr('Коты ловят только обычных и необычных рыб. Редких ловишь ты сам!', 'Cats catch only Common and Uncommon fish. Rare ones are up to you!')}
        </Text>
      </ScrollView>

      <Modal visible={!!rename} transparent animationType="fade" onRequestClose={() => setRename(null)}>
        <Pressable style={{ flex: 1, backgroundColor: t.overlay, justifyContent: 'center', padding: 30 }} onPress={() => setRename(null)}>
          <Pressable style={{ backgroundColor: t.sheet, borderRadius: 24, padding: 20, gap: 14 }}>
            <Text style={{ color: t.text, fontWeight: '800', fontSize: 18 }}>{tr('Имя кота', 'Cat name')}</Text>
            <TextInput value={nameVal} onChangeText={setNameVal} autoFocus maxLength={18} placeholder={tr('Например, Барсик', 'e.g. Whiskers')} placeholderTextColor={t.sub}
              style={{ backgroundColor: t.card2, borderRadius: 14, padding: 14, fontSize: 16, color: t.text }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn title={tr('Отмена', 'Cancel')} kind="secondary" style={{ flex: 1 }} onPress={() => setRename(null)} />
              <Btn title={tr('Сохранить', 'Save')} style={{ flex: 1 }} onPress={() => { if (rename) renameCat(rename, nameVal); setRename(null); }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
