import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { CAT_IMG, FISH_IMG } from '../data/assets';
import { FISH } from '../data/fish';
import { levelFromXp, rankOf, xpForLevel, skin, RANKS } from '../data/game';
import { useGame, wipe, toast } from '../state/store';
import { setSetting } from '../state/actions';
import { fmt, fmtKg } from '../game/engine';
import { RARITY_COLOR, useLang, useT, useTheme } from '../theme';
import { Bar, Btn, Card, Header, Segmented, Tap, shadow } from '../ui/kit';
import { TAB_H } from '../ui/TabBar';
import { LEGAL } from './legal';

export default function Profile() {
  const t = useTheme();
  const tr = useT();
  const lang = useLang();
  const ins = useSafeAreaInsets();
  const s = useGame((x) => x);
  const lv = levelFromXp(s.xp);
  const rk = rankOf(lv);
  const nextRank = RANKS.find((r) => r.minLv > lv);
  const cur = xpForLevel(lv), nxt = xpForLevel(lv + 1);
  const [doc, setDoc] = useState<null | 'privacy' | 'terms'>(null);
  const [del, setDel] = useState(false);
  const [word, setWord] = useState('');
  const records = Object.entries(s.collection).sort((a, b) => b[1].best - a[1].best).slice(0, 5);

  const Row = ({ icon, label, right, onPress, color }: { icon: any; label: string; right?: React.ReactNode; onPress?: () => void; color?: string }) => (
    <Tap disabled={!onPress} onPress={onPress} scale={0.99} hapt={onPress ? 'select' : null} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}>
      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: color || t.card2, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={color ? '#fff' : t.text} />
      </View>
      <Text style={{ flex: 1, color: t.text, fontSize: 15.5, fontWeight: '500' }}>{label}</Text>
      {right}
    </Tap>
  );
  const Sep = () => <View style={{ height: 0.5, backgroundColor: t.line, marginLeft: 42 }} />;
  const sw = (k: 'sound' | 'vibration' | 'notifications') => (
    <Switch value={s.settings[k]} onValueChange={(v) => setSetting(k, v)} trackColor={{ true: t.good, false: t.card2 }} thumbColor="#fff" />
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title={tr('Профиль', 'Profile')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_H(ins.bottom) + 30, gap: 14 }} showsVerticalScrollIndicator={false}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: t.card2, overflow: 'hidden', alignItems: 'center' }}>
            <Image source={CAT_IMG[`player_${skin(s.equipped.outfit).key}`]} style={{ width: 150, height: 150, marginTop: -14 }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: '800', fontSize: 20 }}>{lang === 'ru' ? rk.ru : rk.en}</Text>
            <Text style={{ color: t.sub, marginTop: 2 }}>{tr('Уровень', 'Level')} {lv} · {fmt(s.xp - cur, lang)}/{fmt(nxt - cur, lang)} XP</Text>
            <View style={{ marginTop: 8 }}><Bar value={(s.xp - cur) / (nxt - cur)} color={t.accent} /></View>
            {nextRank && <Text style={{ color: t.sub, fontSize: 11, marginTop: 6 }}>{tr(`Следующее звание «${nextRank.ru}» на ур. ${nextRank.minLv}`, `Next rank "${nextRank.en}" at lvl ${nextRank.minLv}`)}</Text>}
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { v: fmt(s.stats.caught, lang), l: tr('Поймано', 'Caught'), c: '#5BA8D6' },
            { v: s.stats.heaviest ? fmtKg(s.stats.heaviest, lang) : '—', l: tr('Самая тяжёлая', 'Heaviest'), c: '#A05BF0' },
            { v: `${Object.keys(s.collection).length}/${FISH.length}`, l: tr('Коллекция', 'Collection'), c: '#F26B5B' },
          ].map((x, i) => (
            <View key={i} style={[{ flex: 1, backgroundColor: t.card, borderRadius: 18, padding: 12 }, shadow(t)]}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: x.c, marginBottom: 8 }} />
              <Text style={{ color: t.text, fontWeight: '800', fontSize: 17 }} numberOfLines={1} adjustsFontSizeToFit>{x.v}</Text>
              <Text style={{ color: t.sub, fontSize: 11.5, marginTop: 2 }}>{x.l}</Text>
            </View>
          ))}
        </View>

        <Card>
          <Text style={{ color: t.text, fontWeight: '800', fontSize: 16, marginBottom: 6 }}>{tr('Рекорды', 'Records')}</Text>
          {records.length === 0 && <Text style={{ color: t.sub, paddingVertical: 8 }}>{tr('Пока пусто — поймай первую рыбу!', 'Nothing yet — catch your first fish!')}</Text>}
          {records.map(([id, c], i) => {
            const f = FISH.find((x) => x.id === id)!;
            return (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
                <Text style={{ width: 18, color: t.sub, fontWeight: '800' }}>{i + 1}</Text>
                <Image source={FISH_IMG[id]} style={{ width: 44, height: 44 }} />
                <Text style={{ flex: 1, color: t.text, fontWeight: '600' }}>{lang === 'ru' ? f.ru : f.en}</Text>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: RARITY_COLOR[f.rarity] }} />
                <Text style={{ color: t.text, fontWeight: '800' }}>{fmtKg(c.best, lang)}</Text>
              </View>
            );
          })}
        </Card>

        <Card style={{ paddingVertical: 4 }}>
          <Row icon="volume-high" color="#F28C3A" label={tr('Звуки', 'Sounds')} right={sw('sound')} />
          <Sep />
          <Row icon="phone-portrait-outline" color="#A05BF0" label={tr('Вибрация', 'Haptics')} right={sw('vibration')} />
          <Sep />
          <Row icon="notifications" color="#E5484D" label={tr('Уведомления', 'Notifications')} right={sw('notifications')} />
          <Sep />
          <Row icon="language" color="#4A8DF0" label={tr('Язык', 'Language')} right={
            <Segmented value={s.settings.lang} onChange={(v) => setSetting('lang', v)} style={{ width: 130 }} items={[{ id: 'ru', label: 'RU' }, { id: 'en', label: 'EN' }]} />
          } />
          <Sep />
          <View style={{ paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: '#3B2A1E', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="contrast" size={17} color="#fff" />
              </View>
              <Text style={{ color: t.text, fontSize: 15.5, fontWeight: '500' }}>{tr('Тема', 'Theme')}</Text>
            </View>
            <Segmented value={s.settings.theme} onChange={(v) => setSetting('theme', v)}
              items={[{ id: 'auto', label: tr('Авто', 'Auto') }, { id: 'light', label: tr('Светлая', 'Light') }, { id: 'dark', label: tr('Тёмная', 'Dark') }]} />
          </View>
        </Card>

        <Card style={{ paddingVertical: 4 }}>
          <Row icon="shield-checkmark" label={tr('Политика конфиденциальности', 'Privacy Policy')} onPress={() => setDoc('privacy')} right={<Ionicons name="chevron-forward" size={18} color={t.sub} />} />
          <Sep />
          <Row icon="document-text" label={tr('Условия использования', 'Terms of Use')} onPress={() => setDoc('terms')} right={<Ionicons name="chevron-forward" size={18} color={t.sub} />} />
          <Sep />
          <Row icon="information-circle" label={tr('Версия', 'Version')} right={<Text style={{ color: t.sub }}>{Constants.expoConfig?.version || '1.0.0'}</Text>} />
        </Card>

        <Card style={{ paddingVertical: 4 }}>
          <Tap onPress={() => { setWord(''); setDel(true); }} style={{ paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: t.danger, fontWeight: '700', fontSize: 15.5 }}>{tr('Удалить прогресс', 'Delete progress')}</Text>
          </Tap>
        </Card>
        <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center' }}>{tr('Прогресс хранится только на этом телефоне.', 'Progress is stored on this phone only.')}</Text>
      </ScrollView>

      <Modal visible={!!doc} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDoc(null)}>
        <View style={{ flex: 1, backgroundColor: t.bg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
            <Text style={{ color: t.text, fontWeight: '800', fontSize: 20, flex: 1 }}>{doc === 'privacy' ? tr('Конфиденциальность', 'Privacy') : tr('Условия', 'Terms')}</Text>
            <Tap onPress={() => setDoc(null)}><Ionicons name="close-circle" size={30} color={t.sub} /></Tap>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0 }}>
            <Text style={{ color: t.text, fontSize: 15, lineHeight: 22 }}>{doc ? LEGAL[doc][lang] : ''}</Text>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={del} transparent animationType="fade" onRequestClose={() => setDel(false)}>
        <Pressable style={{ flex: 1, backgroundColor: t.overlay, justifyContent: 'center', padding: 28 }} onPress={() => setDel(false)}>
          <Pressable style={{ backgroundColor: t.sheet, borderRadius: 24, padding: 20, gap: 12 }}>
            <Ionicons name="warning" size={34} color={t.danger} />
            <Text style={{ color: t.text, fontWeight: '800', fontSize: 18 }}>{tr('Удалить весь прогресс?', 'Delete all progress?')}</Text>
            <Text style={{ color: t.sub }}>{tr('Монеты, рыбы, коты и скины исчезнут навсегда. Чтобы подтвердить, введите слово УДАЛИТЬ.', 'Coins, fish, cats and skins will be gone forever. Type DELETE to confirm.')}</Text>
            <TextInput value={word} onChangeText={setWord} autoCapitalize="characters" placeholder={tr('УДАЛИТЬ', 'DELETE')} placeholderTextColor={t.sub}
              style={{ backgroundColor: t.card2, borderRadius: 14, padding: 14, fontSize: 16, color: t.text }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn title={tr('Отмена', 'Cancel')} kind="secondary" style={{ flex: 1 }} onPress={() => setDel(false)} />
              <Btn title={tr('Удалить', 'Delete')} kind="danger" style={{ flex: 1 }} disabled={word.trim().toUpperCase() !== tr('УДАЛИТЬ', 'DELETE')}
                onPress={async () => { setDel(false); await wipe(); toast(tr('Прогресс удалён', 'Progress deleted')); }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
