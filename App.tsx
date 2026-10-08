import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, Image, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { load, persistNow, useGame, useReady, useUi, useSaveError, getState } from './src/state/store';
import { applyOffline, catsTick } from './src/state/actions';
import { useIsDark, useTheme, useT } from './src/theme';
import { initSounds } from './src/ui/feedback';
import { ToastHost } from './src/ui/kit';
import TabBar from './src/ui/TabBar';
import FishScreen from './src/screens/Fish';
import Collection from './src/screens/Collection';
import Shop from './src/screens/Shop';
import Cats from './src/screens/Cats';
import Profile from './src/screens/Profile';
import { BucketSheet, FishCardModal, NewFishModal, Onboarding, RewardModal, SpotsSheet, WelcomeModal } from './src/screens/Overlays';
import { scheduleReminders, cancelReminders } from './src/notify';
import Scene3D from './src/game3d/Scene3D';
import { send, useScene3D } from './src/game3d/bridge';
import { CATS, catTier, skin } from './src/data/game';

/** Передаёт в 3D-сцену место, время суток, скины и котов-помощников */
function SceneSync() {
  const place = useGame((s) => s.place);
  const eq = useGame((s) => s.equipped);
  const cats = useGame((s) => s.cats);
  const dark = useIsDark();
  const tab = useUi((u) => u.tab);
  const s3 = useScene3D();
  useEffect(() => {
    const tod = eq.scene === 'auto' ? (dark ? 'night' : 'sunset') : skin(eq.scene).key;
    const helpers = CATS.filter((c) => cats[c.id]?.hired && cats[c.id].place === place).slice(0, 2)
      .map((c) => ({ id: c.id, tier: catTier(cats[c.id].level) }));
    send({ type: 'state', place, tod, outfit: skin(eq.outfit).key, rod: skin(eq.rod).key, bobber: skin(eq.bobber).key, helpers });
  }, [place, eq, cats, dark, s3.ready]);
  useEffect(() => { send({ type: 'pause', on: tab !== 'fish' }); }, [tab, s3.ready]);
  return null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: Error | null; key: number }> {
  state = { err: null as Error | null, key: 0 };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  componentDidCatch(err: Error) {
    console.warn('UI crash', err);
  }
  render() {
    if (this.state.err) {
      return (
        <View style={{ flex: 1, backgroundColor: '#FBF5EA', padding: 28, paddingTop: 80 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#4A3425' }}>Ой, леска запуталась 🎣</Text>
          <Text style={{ fontSize: 15, color: '#9B8672', marginTop: 8 }}>Произошла ошибка. Прогресс сохранён. / Something went wrong. Your progress is safe.</Text>
          <ScrollView style={{ maxHeight: 220, marginTop: 16, backgroundColor: '#F6EBD9', borderRadius: 14, padding: 12 }}>
            <Text selectable style={{ fontFamily: 'Menlo', fontSize: 12, color: '#4A3425' }}>{String(this.state.err?.message)}{'\n'}{String(this.state.err?.stack || '').slice(0, 1200)}</Text>
          </ScrollView>
          <Text onPress={() => this.setState({ err: null, key: this.state.key + 1 })}
            style={{ marginTop: 22, backgroundColor: '#F26B5B', color: '#fff', textAlign: 'center', paddingVertical: 15, borderRadius: 16, fontWeight: '800', fontSize: 16, overflow: 'hidden' }}>
            Перезапустить / Restart
          </Text>
        </View>
      );
    }
    return <React.Fragment key={this.state.key}>{this.props.children}</React.Fragment>;
  }
}

function Root() {
  const ready = useReady();
  const t = useTheme();
  const dark = useIsDark();
  const tr = useT();
  const tab = useUi((u) => u.tab);
  const onboarded = useGame((s) => s.onboarded);
  const saveErr = useSaveError();
  const bg = useRef(0);

  useEffect(() => {
    initSounds();
    load().then((away) => applyOffline(away));
    const iv = setInterval(() => catsTick(1), 1000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        cancelReminders();
        if (bg.current) {
          const away = (Date.now() - bg.current) / 1000;
          bg.current = 0;
          applyOffline(away);
        }
      } else if (st === 'background' || st === 'inactive') {
        if (!bg.current) bg.current = Date.now();
        persistNow();
        scheduleReminders(getState());
      }
    });
    return () => { clearInterval(iv); sub.remove(); };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={require('./assets/splash-icon.png')} style={{ width: 200, height: 200 }} />
        <ActivityIndicator color={t.accent} style={{ marginTop: 16 }} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Scene3D />
      <SceneSync />
      {tab === 'fish' && <FishScreen />}
      {tab === 'collection' && <Collection />}
      {tab === 'shop' && <Shop />}
      {tab === 'cats' && <Cats />}
      {tab === 'profile' && <Profile />}
      <TabBar />
      <BucketSheet />
      <SpotsSheet />
      <NewFishModal />
      <RewardModal />
      <WelcomeModal />
      <FishCardModal />
      <ToastHost />
      {saveErr && (
        <View style={{ position: 'absolute', top: 50, left: 16, right: 16, backgroundColor: t.danger, borderRadius: 14, padding: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{tr('Не удалось сохранить прогресс. Игра цела на этом телефоне, попробуем ещё раз.', 'Could not save progress. Your game is safe; we will retry.')}</Text>
        </View>
      )}
      {!onboarded && <Onboarding />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <Root />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
