import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Defs, LinearGradient, Stop, Polygon, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CAT_IMG, FISH_IMG, ITEM_IMG, PLAYER_META, SCENE_IMG, SCENE_META } from '../data/assets';
import { fishDef, hookWindow, rodZone, lineCap, FIGHT, upgCost, MAX_LV, bucketCap, skin, ROD_STYLE, placeOf, CATS, catTier, rIdx } from '../data/game';
import { FISH } from '../data/fish';
import { getState, setUi, toast, useGame, useUi, CaughtFish } from '../state/store';
import { buyUpgrade, catchFish, fishLost } from '../state/actions';
import { makeFish, rollBite, rollWeight, fmt, fmtKg, rand } from '../game/engine';
import { RARITY_COLOR, RARITY_NAME, useIsDark, useLang, useT, useTheme } from '../theme';
import { CoinText, Tap, Bar, shadow, useLoop } from '../ui/kit';
import { haptic, sfx } from '../ui/feedback';
import { TAB_H } from '../ui/TabBar';
import { send, useScene3D } from '../game3d/bridge';

type Phase = 'idle' | 'casting' | 'waiting' | 'bite' | 'fight';
const IMG_W = 1080, IMG_H = 2300;

function useLayout() {
  const { width: W, height: H } = useWindowDimensions();
  const place = useGame((s) => s.place);
  const outfit = useGame((s) => s.equipped.outfit);
  return useMemo(() => {
    const sc = Math.max(W / IMG_W, H / IMG_H);
    const ox = (IMG_W * sc - W) / 2, oy = (IMG_H * sc - H) / 2;
    const map = (nx: number, ny: number) => ({ x: nx * IMG_W * sc - ox, y: ny * IMG_H * sc - oy });
    const meta = SCENE_META[`${place}_sunset`] || { cat: [0.64, 0.32], bobber: [0.85, 0.42] };
    const cat = map(meta.cat[0], meta.cat[1]);
    const S = Math.min(W * 0.42, 210);
    const sprite = { left: cat.x - 0.44 * S, top: cat.y - 0.84 * S, size: S };
    const pm = PLAYER_META[skin(outfit).key] || { paw: [0.53, 0.67] };
    const paw = { x: sprite.left + pm.paw[0] * S, y: sprite.top + pm.paw[1] * S };
    const tip = { x: Math.min(W - 18, paw.x + W * 0.24), y: paw.y - W * 0.36 };
    const bw = map(meta.bobber[0], meta.bobber[1]);
    const water = { x: Math.min(W * 0.86, Math.max(tip.x - 10, bw.x)), y: Math.max(cat.y + W * 0.1, bw.y) };
    const dangle = { x: tip.x, y: tip.y + W * 0.13 };
    return { W, H, sc, map, cat, sprite, paw, tip, water, dangle };
  }, [W, H, place, outfit]);
}

const AnimatedLine = Animated.createAnimatedComponent(Line);

export default function FishScreen() {
  const t = useTheme();
  const tr = useT();
  const lang = useLang();
  const dark = useIsDark();
  const ins = useSafeAreaInsets();
  const L = useLayout();
  const place = useGame((s) => s.place);
  const coins = useGame((s) => s.coins);
  const eq = useGame((s) => s.equipped);
  const up = useGame((s) => s.upgrades);
  const bucketN = useGame((s) => s.bucket.length);
  const caught = useGame((s) => s.stats.caught);
  const cats = useGame((s) => s.cats);
  const coinFly = useUi((u) => u.coinFly);
  const cap = bucketCap(up.bucket);
  const s3 = useScene3D();
  const use3d = s3.ready && !s3.error;

  const sceneKey = eq.scene === 'auto' ? (dark ? 'night' : 'sunset') : skin(eq.scene).key;
  const rod = ROD_STYLE[skin(eq.rod).key] || ROD_STYLE.bamboo;
  const bobberImg = ITEM_IMG[`bobber_${skin(eq.bobber).key}`];

  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const setP = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  const fishRef = useRef<CaughtFish | null>(null);
  const use3dRef = useRef(false);
  const lastSend = useRef(0);
  use3dRef.current = use3d;
  const timers = useRef<any[]>([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const later = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };

  // позиция поплавка / рыбы (общая для SVG-лески и картинок)
  const bx = useRef(new Animated.Value(L.dangle.x)).current;
  const by = useRef(new Animated.Value(L.dangle.y)).current;
  const dive = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(1)).current;
  const excl = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const windowV = useRef(new Animated.Value(0)).current;
  const floatV = useRef(new Animated.Value(0)).current;
  const coinBump = useRef(new Animated.Value(1)).current;
  const [floatFish, setFloatFish] = useState<CaughtFish | null>(null);
  const bob = useLoop(1800, []);

  useEffect(() => {
    if (phaseRef.current === 'idle') { bx.setValue(L.dangle.x); by.setValue(L.dangle.y); }
  }, [L]);
  useEffect(() => () => clearTimers(), []);
  useEffect(() => {
    if (!coinFly) return;
    sfx('coin');
    Animated.sequence([
      Animated.spring(coinBump, { toValue: 1.25, useNativeDriver: true, speed: 50 }),
      Animated.spring(coinBump, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
  }, [coinFly]);
  // смена места — смотать удочку
  useEffect(() => { if (phaseRef.current !== 'idle') reelBack(true); }, [place]);

  const doRipple = () => {
    ripple.setValue(0);
    Animated.timing(ripple, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  function cast() {
    if (phaseRef.current !== 'idle') return;
    setP('casting');
    send({ type: 'cast' });
    sfx('cast', 0.6);
    haptic('medium');
    const midY = Math.min(L.tip.y, L.water.y) - L.W * 0.15;
    Animated.parallel([
      Animated.timing(bx, { toValue: L.water.x, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.sequence([
        Animated.timing(by, { toValue: midY, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(by, { toValue: L.water.y, duration: 390, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      ]),
    ]).start(() => {
      if (phaseRef.current !== 'casting') return;
      sfx('splash', 0.7);
      doRipple();
      send({ type: 'land' });
      setP('waiting');
      const first = getState().stats.caught === 0;
      const wait = first ? 2200 : 2500 + rand() * 4500;
      // ложные подёргивания
      const twitches = first ? 0 : Math.floor(rand() * 3);
      for (let i = 0; i < twitches; i++) {
        later(wait * (0.25 + 0.5 * rand()), () => {
          if (phaseRef.current !== 'waiting') return;
          Animated.sequence([
            Animated.timing(dive, { toValue: 0.35, duration: 90, useNativeDriver: true }),
            Animated.timing(dive, { toValue: 0, duration: 220, useNativeDriver: true }),
          ]).start();
          haptic('light');
          send({ type: 'twitch' });
        });
      }
      later(wait, bite);
    });
  }

  function bite() {
    if (phaseRef.current !== 'waiting') return;
    const s = getState();
    const f = s.stats.caught === 0
      ? makeFish(fishDef('roach'), rollWeight(fishDef('roach')), false)
      : rollBite(s.place, s.upgrades.bait, s.upgrades.rod);
    fishRef.current = f;
    setP('bite');
    send({ type: 'bite', rarity: fishDef(f.id).rarity });
    sfx('bite');
    haptic('heavy');
    doRipple();
    Animated.spring(dive, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }).start();
    excl.setValue(0);
    Animated.spring(excl, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 14 }).start();
    const rareHint = rIdx(fishDef(f.id).rarity) >= 2;
    glow.setValue(0);
    if (rareHint) Animated.timing(glow, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    const win = s.stats.caught === 0 ? 4000 : hookWindow(s.upgrades.rod);
    windowV.setValue(1);
    Animated.timing(windowV, { toValue: 0, duration: win, easing: Easing.linear, useNativeDriver: false }).start();
    later(win, () => { if (phaseRef.current === 'bite') miss(); });
  }

  function hook() {
    clearTimers();
    const f = fishRef.current!;
    const r = fishDef(f.id).rarity;
    excl.setValue(0);
    send({ type: 'hook' });
    if (r === 'common') {
      finish(true);
    } else {
      sfx('reel', 0.5);
      haptic('medium');
      send({ type: 'fight', fish: { id: f.id, rarity: r } });
      setP('fight');
    }
  }

  function miss() {
    clearTimers();
    sfx('fail', 0.6);
    haptic('warning');
    toast(tr('Рыба ушла… Подсекай быстрее', 'The fish got away… Hook faster'));
    fishLost();
    reelBack();
  }

  function finish(win: boolean) {
    const f = fishRef.current;
    if (!f) return reelBack();
    send({ type: win ? 'catch' : 'lost', fish: { id: f.id } });
    if (!win) {
      sfx('fail');
      haptic('error');
      fishLost();
      toast(tr('Леска не выдержала! Улучши леску или удочку', 'The line snapped! Upgrade your line or rod'));
      return reelBack();
    }
    const def = fishDef(f.id);
    const info = catchFish(f);
    haptic('success');
    if (info.isNew || info.isRecord || f.shiny) {
      sfx(rIdx(def.rarity) >= 2 || f.shiny ? 'rare' : 'success');
      setUi({ newFish: { fish: f, ...info } });
    } else if (use3dRef.current) {
      sfx('success', 0.6);
      toast(`+ ${lang === 'ru' ? def.ru : def.en} · ${fmtKg(f.kg, lang)}`);
      if (info.soldInstead) toast(tr(`Ведро полное — продано за ${f.value}`, `Bucket full — sold for ${f.value}`), 'coin');
    } else {
      sfx('success', 0.6);
      setFloatFish(f);
      floatV.setValue(0);
      Animated.timing(floatV, { toValue: 1, duration: 1500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setFloatFish(null));
      if (info.soldInstead) toast(tr(`Ведро полное — продано за ${f.value}`, `Bucket full — sold for ${f.value}`), 'coin');
    }
    reelBack();
  }

  function reelBack(silent = false) {
    clearTimers();
    fishRef.current = null;
    dive.setValue(0);
    glow.setValue(0);
    excl.setValue(0);
    setP('idle');
    send({ type: 'reel' });
    if (!silent) sfx('reel', 0.4);
    Animated.parallel([
      Animated.timing(bx, { toValue: L.dangle.x, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(by, { toValue: L.dangle.y, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    ]).start();
  }

  function onMainButton() {
    const p = phaseRef.current;
    if (p === 'idle') {
      if (getState().bucket.length >= cap && getState().bucket.every((x) => x.locked)) {
        toast(tr('Ведро полное — продай улов', 'Bucket is full — sell your catch'), 'icon_bucket_full');
      }
      cast();
    } else if (p === 'waiting') {
      toast(tr('Рано! Жди, пока поплавок нырнёт', 'Too early! Wait for the bobber to dive'));
      haptic('warning');
      reelBack();
    } else if (p === 'bite') hook();
  }

  // ---------- рендер ----------
  const sceneSrc = SCENE_IMG[`${place}_${sceneKey}`] || SCENE_IMG[`pier_sunset`];
  const bobS = L.W * 0.085;
  const helpers = CATS.filter((c) => cats[c.id]?.hired && cats[c.id].place === place).slice(0, 2);
  const panelH = 214;
  const fightFish = phase === 'fight' ? fishRef.current : null;

  // натяжение удочки: кончик чуть ниже, когда рыба тянет
  const tipY = L.tip.y + (phase === 'fight' ? L.W * 0.05 : phase === 'bite' ? L.W * 0.02 : 0);
  const rodPoly = (() => {
    const dx = L.tip.x - L.paw.x, dy = tipY - L.paw.y;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len;
    const w0 = 6, w1 = 1.6;
    return [
      [L.paw.x + nx * w0, L.paw.y + ny * w0], [L.tip.x + nx * w1, tipY + ny * w1],
      [L.tip.x - nx * w1, tipY - ny * w1], [L.paw.x - nx * w0, L.paw.y - ny * w0],
    ].map((p) => p.join(',')).join(' ');
  })();

  return (
    <View style={{ flex: 1, backgroundColor: use3d ? 'transparent' : t.bg }}>
      {!use3d && (<>
      {/* фон-сцена */}
      <Image source={sceneSrc} style={{ position: 'absolute', width: IMG_W * L.sc, height: IMG_H * L.sc, left: -(IMG_W * L.sc - L.W) / 2, top: -(IMG_H * L.sc - L.H) / 2 }} resizeMode="cover" />

      {/* коты-помощники на пирсе/в лодке */}
      {helpers.map((c, i) => {
        const s = L.sprite.size * 0.62;
        return (
          <Image key={c.id} source={CAT_IMG[`helper_${c.id}_${catTier(cats[c.id].level)}`]}
            style={{ position: 'absolute', width: s, height: s, left: L.cat.x - L.sprite.size * (0.55 + 0.42 * i) - s * 0.5, top: L.cat.y - s * 0.95 }} />
        );
      })}

      {/* рябь и подсказка редкой рыбы */}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', left: L.water.x - 60, top: L.water.y - 18, width: 120, height: 40, borderRadius: 60,
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)',
        opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
        transform: [{ scaleX: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.2] }) }, { scaleY: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.2] }) }],
      }} />

      {/* удочка и леска */}
      <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={L.W} height={L.H} pointerEvents="none">
        <Defs>
          <LinearGradient id="rod" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={rod.base} />
            <Stop offset="1" stopColor={rod.stripe} />
          </LinearGradient>
        </Defs>
        <AnimatedLine x1={L.tip.x} y1={tipY} x2={bx as any} y2={by as any} stroke={dark ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.9)'} strokeWidth={1.4} />
      </Svg>

      {/* кот */}
      <Image source={CAT_IMG[`player_${skin(eq.outfit).key}`]} style={{ position: 'absolute', left: L.sprite.left, top: L.sprite.top, width: L.sprite.size, height: L.sprite.size }} />
      <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={L.W} height={L.H} pointerEvents="none">
        <Polygon points={rodPoly} fill={rod.base} stroke={rod.grip} strokeWidth={0.8} />
        <Line x1={L.paw.x - (L.tip.x - L.paw.x) * 0.12} y1={L.paw.y - (tipY - L.paw.y) * 0.12} x2={L.paw.x + (L.tip.x - L.paw.x) * 0.16} y2={L.paw.y + (tipY - L.paw.y) * 0.16} stroke={rod.grip} strokeWidth={8} strokeLinecap="round" />
        <Circle cx={L.tip.x} cy={tipY} r={2.2} fill={rod.stripe} />
      </Svg>
      {/* «!» над котом */}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', left: L.sprite.left + L.sprite.size * 0.36, top: L.sprite.top - 6,
        width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFD23A', alignItems: 'center', justifyContent: 'center',
        transform: [{ scale: excl }], opacity: excl, ...shadow(t),
      }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: '#3B2A1E' }}>!</Text>
      </Animated.View>

      {/* поплавок / силуэт рыбы */}
      {fightFish ? (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateX: bx }, { translateY: by }] }}>
          <View style={{ position: 'absolute', left: -60, top: -12, width: 120, height: 44, borderRadius: 60, backgroundColor: RARITY_COLOR[fishDef(fightFish.id).rarity], opacity: 0.35 }} />
          <Image source={FISH_IMG[fightFish.id]} tintColor="rgba(10,30,50,0.55)" style={{ position: 'absolute', left: -50, top: -30, width: 100, height: 100, opacity: 0.85 }} />
        </Animated.View>
      ) : (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateX: bx }, { translateY: by }] }}>
          <Animated.View style={{ position: 'absolute', left: -55, top: -6, width: 110, height: 40, borderRadius: 55, backgroundColor: fishRef.current ? RARITY_COLOR[fishDef(fishRef.current.id).rarity] : '#fff', opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }) }} />
          <Animated.Image source={bobberImg} style={{
            position: 'absolute', left: -bobS / 2, top: -bobS * 0.75, width: bobS, height: bobS,
            transform: [
              { translateY: Animated.add(dive.interpolate({ inputRange: [0, 1], outputRange: [0, bobS * 0.45] }), bob.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, phase === 'waiting' ? 2.5 : 1, 0] })) },
              { scale: dive.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }) },
            ],
            opacity: dive.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }),
          }} />
        </Animated.View>
      )}

      {/* улов уплывает в ведро */}
      {floatFish && (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', left: L.water.x - 50, top: L.water.y - 90, alignItems: 'center',
          opacity: floatV.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: floatV.interpolate({ inputRange: [0, 1], outputRange: [20, -60] }) }, { scale: floatV.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.5, 1.1, 0.9] }) }],
        }}>
          <Image source={FISH_IMG[floatFish.id]} style={{ width: 100, height: 100 }} />
          <View style={{ backgroundColor: 'rgba(59,42,30,0.85)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{lang === 'ru' ? fishDef(floatFish.id).ru : fishDef(floatFish.id).en} · {fmtKg(floatFish.kg, lang)}</Text>
          </View>
        </Animated.View>
      )}

      </>)}
      {/* верхняя панель */}
      <View style={{ position: 'absolute', top: ins.top + 8, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Animated.View style={{ transform: [{ scale: coinBump }], backgroundColor: t.dark ? 'rgba(30,28,38,0.82)' : 'rgba(255,250,240,0.9)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7, ...shadow(t) }}>
          <CoinText value={coins} size={16} />
        </Animated.View>
        <Tap onPress={() => setUi({ sheet: 'spots' })} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.dark ? 'rgba(30,28,38,0.82)' : 'rgba(255,250,240,0.9)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8, ...shadow(t) }}>
          <Ionicons name="location" size={15} color={t.accent} />
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 14 }}>{lang === 'ru' ? placeOf(place).ru : placeOf(place).en}</Text>
          <Ionicons name="chevron-down" size={14} color={t.sub} />
        </Tap>
      </View>

      {/* нижняя панель */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: TAB_H(ins.bottom) - 2, height: panelH, backgroundColor: t.sheet, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 16, paddingTop: 14, ...shadow(t) }}>
        {phase === 'fight' && fightFish ? (
          <FightPanel key={fightFish.uid} fish={fightFish} onEnd={finish} onMove={(m, ten) => {
            const now = Date.now();
            if (now - lastSend.current > 50) { lastSend.current = now; send({ type: 'fightM', m, ten }); }
            bx.setValue(L.water.x + (m - 0.5) * L.W * 0.42);
            by.setValue(L.water.y + Math.sin(Date.now() / 300) * 3);
          }} />
        ) : (
          <MainPanel phase={phase} windowV={windowV} cap={cap} bucketN={bucketN} onMain={onMainButton} />
        )}
      </View>

      {/* подсказка первого заброса */}
      {caught === 0 && (phase === 'idle' || phase === 'bite') && (
        <Hint bottom={TAB_H(ins.bottom) + panelH + 46} text={phase === 'idle' ? tr('Нажми, чтобы закинуть удочку', 'Tap to cast your line') : tr('Клюёт! Нажми сейчас!', 'A bite! Tap now!')} />
      )}
    </View>
  );
}

function Hint({ bottom, text }: { bottom: number; text: string }) {
  const v = useLoop(1100, [text]);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', right: 20, bottom, backgroundColor: '#3B2A1E', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8,
      transform: [{ translateY: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -6, 0] }) }],
    }}>
      <Text style={{ color: '#FFF6E8', fontWeight: '700' }}>{text}</Text>
      <View style={{ position: 'absolute', right: 40, bottom: -6, width: 12, height: 12, backgroundColor: '#3B2A1E', transform: [{ rotate: '45deg' }] }} />
    </Animated.View>
  );
}

function MainPanel({ phase, windowV, cap, bucketN, onMain }: { phase: Phase; windowV: Animated.Value; cap: number; bucketN: number; onMain: () => void }) {
  const t = useTheme();
  const tr = useT();
  const up = useGame((s) => s.upgrades);
  const coins = useGame((s) => s.coins);
  const cats = useGame((s) => s.cats);
  const pulse = useLoop(700, [phase]);
  const full = bucketN >= cap;
  const warn = bucketN >= cap * 0.8;
  const hired = Object.values(cats).filter((c) => c.hired).length;

  const label = phase === 'bite' ? tr('Подсекай!', 'Hook it!') : phase === 'waiting' ? tr('Ждём…', 'Waiting…') : phase === 'casting' ? '…' : tr('Закинуть', 'Cast');
  const btnColor = phase === 'bite' ? '#E5484D' : phase === 'waiting' ? '#B9A894' : t.accent;

  const quick = (k: 'rod' | 'bait', img: string, name: string) => {
    const lv = up[k];
    const max = lv >= MAX_LV;
    const cost = max ? 0 : upgCost(k, lv);
    return (
      <Tap key={k} style={[{ flex: 1, backgroundColor: t.card, borderRadius: 18, padding: 10, alignItems: 'center' }, shadow(t)]}
        onPress={() => {
          if (max) return;
          if (coins < cost) toast(tr(`Не хватает ${fmt(cost - coins)}`, `Need ${fmt(cost - coins)} more`), 'coin');
          else if (buyUpgrade(k)) toast(tr(`${name}: уровень ${lv + 1}`, `${name}: level ${lv + 1}`));
        }}>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 13 }}>{name}</Text>
        <Image source={ITEM_IMG[img]} style={{ width: 40, height: 40, marginVertical: 2 }} />
        <Text style={{ color: t.sub, fontSize: 11, fontWeight: '600' }}>{tr('ур.', 'lvl')} {lv}</Text>
        <View style={{ marginTop: 4, backgroundColor: max ? t.card2 : coins >= cost ? t.accent : t.card2, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
          {max ? <Text style={{ fontWeight: '800', fontSize: 12, color: t.sub }}>{tr('МАКС', 'MAX')}</Text>
            : <CoinText value={cost} size={12} short color={coins >= cost ? '#fff' : t.sub} />}
        </View>
      </Tap>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Tap onPress={() => setUi({ sheet: 'bucket' })} style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.card, borderRadius: 18, padding: 10 }, shadow(t)]}>
          <Image source={ITEM_IMG[warn ? 'icon_bucket_full' : 'icon_bucket']} style={{ width: 42, height: 42 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: '800', fontSize: 15 }}>
              {tr('Ведро', 'Bucket')} <Text style={{ color: full ? t.danger : t.sub, fontWeight: '700' }}>{bucketN}/{cap}</Text>
            </Text>
            <View style={{ marginTop: 6 }}><Bar value={bucketN / cap} color={warn ? t.danger : t.accent} /></View>
            <Text style={{ color: full ? t.danger : t.sub, fontSize: 11, marginTop: 4, fontWeight: '600' }}>{full ? tr('Полное — нажми, чтобы продать', 'Full — tap to sell') : tr('Нажми, чтобы продать улов', 'Tap to sell your catch')}</Text>
          </View>
        </Tap>
        <View style={{ width: 96 }} />
      </View>
      {/* большая кнопка */}
      <Animated.View style={{ position: 'absolute', right: 0, top: -46, transform: [{ scale: phase === 'bite' ? pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] }) : 1 }] }}>
        <Pressable onPress={onMain} disabled={phase === 'casting'}>
          <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: btnColor, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: t.sheet, ...shadow(t) }}>
            <Ionicons name={phase === 'bite' ? 'flash' : phase === 'waiting' ? 'hourglass-outline' : 'fish'} size={26} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14, marginTop: 2 }}>{label}</Text>
          </View>
          {phase === 'bite' && (
            <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 8, right: 8, bottom: 10, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
              <Animated.View style={{ height: '100%', backgroundColor: '#fff', width: windowV.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
            </Animated.View>
          )}
        </Pressable>
      </Animated.View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {quick('rod', 'rod_bamboo', tr('Удочка', 'Rod'))}
        {quick('bait', 'icon_bait', tr('Наживка', 'Bait'))}
        <Tap onPress={() => setUi({ tab: 'cats' })} style={[{ flex: 1, backgroundColor: t.card, borderRadius: 18, padding: 10, alignItems: 'center' }, shadow(t)]}>
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 13 }}>{tr('Коты', 'Cats')}</Text>
          <Image source={ITEM_IMG.paw} style={{ width: 40, height: 40, marginVertical: 2 }} />
          <Text style={{ color: t.sub, fontSize: 11, fontWeight: '600' }}>{hired}/5</Text>
          <View style={{ marginTop: 4, backgroundColor: t.card2, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontWeight: '800', fontSize: 12, color: t.text }}>{tr('Открыть', 'Open')}</Text>
          </View>
        </Tap>
      </View>
    </View>
  );
}

// ---------- борьба с рыбой ----------
function FightPanel({ fish, onEnd, onMove }: { fish: CaughtFish; onEnd: (win: boolean) => void; onMove: (m: number, ten: number) => void }) {
  const t = useTheme();
  const tr = useT();
  const lang = useLang();
  const def = fishDef(fish.id);
  const cfg = FIGHT[def.rarity] || FIGHT.uncommon!;
  const rodLv = getState().upgrades.rod;
  const lineLv = getState().upgrades.line;
  const zoneW = rodZone(rodLv) * cfg.zone;
  const cap = lineCap(lineLv);
  const [barW, setBarW] = useState(300);
  const marker = useRef(new Animated.Value(0.5)).current;
  const zone = useRef(new Animated.Value(0.5)).current;
  const prog = useRef(new Animated.Value(0.15)).current;
  const ten = useRef(new Animated.Value(0)).current;
  const hold = useRef(false);
  const [holding, setHolding] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const s = { m: 0.5, v: 0, t: 0, prog: 0.15, ten: 0, pull: 0, target: 0, nextPull: 0, ph: rand() * 6, lastH: 0, warned: false };
    let raf = 0;
    let last = Date.now();
    const amp = rIdx(def.rarity) >= 3 ? 0.24 : 0.16;
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      s.t += dt;
      if (s.t > s.nextPull) {
        s.target = (rand() * 2 - 1) * cfg.pull;
        s.nextPull = s.t + 0.45 + rand() * 0.6;
      }
      s.pull += (s.target - s.pull) * Math.min(1, dt * 4);
      const acc = (hold.current ? 2.4 : -2.4) + s.pull * 1.7;
      s.v += acc * dt;
      s.v *= 1 - Math.min(0.9, 1.8 * dt);
      s.m += s.v * dt;
      let edge = false;
      if (s.m < 0) { s.m = 0; s.v = 0; edge = true; }
      if (s.m > 1) { s.m = 1; s.v = 0; edge = true; }
      const zc = 0.5 + amp * Math.sin(s.t * 0.85 * cfg.pull + s.ph);
      const inZone = Math.abs(s.m - zc) <= zoneW / 2;
      const grace = s.t < 0.9;
      s.prog += inZone ? dt / cfg.dur : -dt / (cfg.dur * 2.4);
      s.prog = Math.max(0, Math.min(1, s.prog));
      if (!grace) s.ten += inZone ? -dt * 0.7 : dt * (edge ? 1.4 : 0.85);
      s.ten = Math.max(0, s.ten);
      marker.setValue(s.m);
      zone.setValue(zc);
      prog.setValue(s.prog);
      ten.setValue(Math.min(1, s.ten / cap));
      onMove(s.m, Math.min(1, s.ten / cap));
      if (inZone && s.t - s.lastH > 0.32) { s.lastH = s.t; haptic('select'); }
      if (!inZone && s.ten / cap > 0.7 && !s.warned) { s.warned = true; haptic('warning'); }
      if (s.ten / cap < 0.5) s.warned = false;
      if (!done.current && s.prog >= 1) { done.current = true; onEnd(true); return; }
      if (!done.current && s.ten >= cap) { done.current = true; onEnd(false); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const set = (v: boolean) => { hold.current = v; setHolding(v); if (v) { haptic('light'); sfx('reel', 0.35); } };
  const rc = RARITY_COLOR[def.rarity];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: t.text, fontWeight: '800', fontSize: 15 }}>{tr('Держи маркер в зелёной зоне', 'Keep the marker in the green')}</Text>
        <View style={{ backgroundColor: rc, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>{(lang === 'ru' ? RARITY_NAME[def.rarity].ru : RARITY_NAME[def.rarity].en).toUpperCase()}</Text>
        </View>
      </View>
      <View onLayout={(e) => setBarW(e.nativeEvent.layout.width)} style={{ height: 34, borderRadius: 17, backgroundColor: t.card2, marginTop: 12, overflow: 'hidden', justifyContent: 'center' }}>
        <Animated.View style={{ position: 'absolute', top: 3, bottom: 3, width: zoneW * barW, borderRadius: 14, backgroundColor: t.good,
          transform: [{ translateX: zone.interpolate({ inputRange: [0, 1], outputRange: [-zoneW * barW / 2, barW - zoneW * barW / 2] }) }] }} />
        <Animated.View style={{ position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', borderWidth: 3, borderColor: '#3B2A1E',
          transform: [{ translateX: marker.interpolate({ inputRange: [0, 1], outputRange: [2, barW - 24] }) }] }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 12, alignItems: 'center' }}>
        <View style={{ flex: 1, gap: 8 }}>
          <View>
            <Text style={{ color: t.sub, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>{tr('Улов', 'Catch')}</Text>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: t.card2, overflow: 'hidden' }}>
              <Animated.View style={{ height: '100%', backgroundColor: rc, width: prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
            </View>
          </View>
          <View>
            <Text style={{ color: t.sub, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>{tr('Натяжение лески', 'Line strain')}</Text>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: t.card2, overflow: 'hidden' }}>
              <Animated.View style={{ height: '100%', width: ten.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                backgroundColor: ten.interpolate({ inputRange: [0, 0.6, 1], outputRange: ['#F2B631', '#F28C3A', '#E5484D'] }) as any }} />
            </View>
          </View>
        </View>
        <Pressable onPressIn={() => set(true)} onPressOut={() => set(false)}>
          <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: holding ? t.accentDark : t.accent, alignItems: 'center', justifyContent: 'center', transform: [{ scale: holding ? 0.94 : 1 }], ...shadow(t) }}>
            <Ionicons name="sync" size={24} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>{tr('ДЕРЖИ', 'HOLD')}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
