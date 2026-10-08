import React, { useEffect, useRef } from 'react';
import {
  Animated, Easing, Image, Modal, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ITEM_IMG } from '../data/assets';
import { fmt, fmtShort } from '../game/engine';
import { setUi, useUi } from '../state/store';
import { Palette, useLang, useTheme } from '../theme';
import { haptic, sfx } from './feedback';

export function Tap({ onPress, style, children, disabled, scale = 0.96, hapt = 'light', sound = true, onLongPress, onPressIn, onPressOut, hitSlop }: {
  onPress?: () => void; style?: StyleProp<ViewStyle>; children: React.ReactNode; disabled?: boolean; scale?: number;
  hapt?: 'light' | 'medium' | 'select' | null; sound?: boolean; onLongPress?: () => void; onPressIn?: () => void; onPressOut?: () => void; hitSlop?: number;
}) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (x: number) => Animated.spring(v, { toValue: x, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  // размеры/flex должны быть у внешнего Pressable, иначе карточки не растягиваются
  const flat = (StyleSheet.flatten(style) || {}) as ViewStyle;
  const outer: ViewStyle = {};
  for (const k of ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'position', 'left', 'right', 'top', 'bottom'] as const) {
    if ((flat as any)[k] !== undefined) (outer as any)[k] = (flat as any)[k];
  }
  return (
    <Pressable
      style={outer}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => { to(scale); onPressIn?.(); }}
      onPressOut={() => { to(1); onPressOut?.(); }}
      onLongPress={onLongPress}
      onPress={() => {
        if (hapt) haptic(hapt);
        if (sound) sfx('tap', 0.35);
        onPress?.();
      }}
    >
      <Animated.View style={[style, outer.position ? { position: 'relative', left: undefined, right: undefined, top: undefined, bottom: undefined } : null, outer.flex ? { flex: undefined, flexGrow: 1 } : null, { transform: [{ scale: v }] }, disabled && { opacity: 0.45 }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Txt({ style, children, numberOfLines, weight }: { style?: StyleProp<TextStyle>; children: React.ReactNode; numberOfLines?: number; weight?: '400' | '500' | '600' | '700' | '800' }) {
  const t = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ color: t.text, fontSize: 15, fontWeight: weight }, style]}>{children}</Text>;
}

export function Coin({ size = 18 }: { size?: number }) {
  return <Image source={ITEM_IMG.coin} style={{ width: size, height: size }} />;
}

export function CoinText({ value, size = 15, short, color, bold = true }: { value: number; size?: number; short?: boolean; color?: string; bold?: boolean }) {
  const lang = useLang();
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Coin size={size + 3} />
      <Text style={{ fontSize: size, fontWeight: bold ? '700' : '500', color: color || t.text, fontVariant: ['tabular-nums'] }}>
        {short ? fmtShort(value) : fmt(value, lang)}
      </Text>
    </View>
  );
}

export function Card({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.card, borderRadius: 20, padding: 14, ...shadow(t) }, style]}>{children}</View>;
}

export function shadow(t: Palette): ViewStyle {
  return t.dark
    ? { borderWidth: StyleSheet.hairlineWidth, borderColor: t.line }
    : { shadowColor: '#7a5a30', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 };
}

export function Bar({ value, color, height = 8, track }: { value: number; color: string; height?: number; track?: string }) {
  const t = useTheme();
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track || t.card2, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export function Btn({ title, onPress, kind = 'primary', disabled, style, icon, small }: {
  title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; disabled?: boolean; style?: StyleProp<ViewStyle>; icon?: React.ReactNode; small?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'danger' ? t.danger : kind === 'secondary' ? t.card2 : 'transparent';
  const fg = kind === 'primary' || kind === 'danger' ? '#fff' : kind === 'ghost' ? t.accent : t.text;
  return (
    <Tap onPress={onPress} disabled={disabled} style={[{ backgroundColor: bg, borderRadius: 16, paddingVertical: small ? 9 : 14, paddingHorizontal: small ? 14 : 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, style]}>
      {icon}
      <Text style={{ color: fg, fontSize: small ? 14 : 16, fontWeight: '700' }}>{title}</Text>
    </Tap>
  );
}

export function Pill({ text, color, textColor = '#fff', style }: { text: string; color: string; textColor?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: color, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' }, style]}>
      <Text style={{ color: textColor, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }}>{text}</Text>
    </View>
  );
}

/** Нижняя шторка (модальная) */
export function Sheet({ visible, onClose, children, height = '78%' }: { visible: boolean; onClose: () => void; children: React.ReactNode; height?: any }) {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const y = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (visible) Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }).start();
    else y.setValue(1);
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: t.overlay }} onPress={onClose} />
      <Animated.View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height, backgroundColor: t.sheet,
          borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: ins.bottom + 8,
          transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, 900] }) }],
        }}
      >
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: t.line }} />
        </View>
        {children}
      </Animated.View>
    </Modal>
  );
}

/** Всплывающая плашка сверху */
export function ToastHost() {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const toast = useUi((u) => u.toast);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toast) return;
    a.setValue(0);
    Animated.sequence([
      Animated.spring(a, { toValue: 1, useNativeDriver: true, damping: 14 }),
      Animated.delay(1700),
      Animated.timing(a, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(({ finished }) => finished && setUi({ toast: null }));
  }, [toast?.id]);
  if (!toast) return null;
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: ins.top + 56, alignSelf: 'center', maxWidth: '88%',
      backgroundColor: t.dark ? '#2E2C3A' : '#3B2A1E', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18,
      flexDirection: 'row', alignItems: 'center', gap: 8,
      opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
    }}>
      {toast.icon ? <Image source={ITEM_IMG[toast.icon] || null} style={{ width: 22, height: 22 }} /> : null}
      <Text style={{ color: '#FFF6E8', fontWeight: '700', fontSize: 14 }}>{toast.text}</Text>
    </Animated.View>
  );
}

export function useLoop(duration: number, deps: any[] = []) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const an = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    v.setValue(0);
    an.start();
    return () => an.stop();
  }, deps);
  return v;
}

export function Segmented<T extends string>({ value, items, onChange, style }: { value: T; items: { id: T; label: string }[]; onChange: (v: T) => void; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: t.card2, borderRadius: 14, padding: 3 }, style]}>
      {items.map((it) => {
        const on = it.id === value;
        return (
          <Tap key={it.id} hapt="select" onPress={() => onChange(it.id)} scale={0.98}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 11, alignItems: 'center', backgroundColor: on ? t.card : 'transparent', ...(on ? shadow(t) : {}) }}>
            <Text style={{ color: on ? t.text : t.sub, fontWeight: on ? '700' : '600', fontSize: 14 }}>{it.label}</Text>
          </Tap>
        );
      })}
    </View>
  );
}

export function Chip({ label, on, onPress, color }: { label: string; on: boolean; onPress: () => void; color?: string }) {
  const t = useTheme();
  return (
    <Tap hapt="select" onPress={onPress} scale={0.95}
      style={{ paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99, backgroundColor: on ? (color || t.accent) : t.card2, marginRight: 8 }}>
      <Text style={{ color: on ? '#fff' : t.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Tap>
  );
}

export function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: ins.top + 10, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 32, fontWeight: '800', color: t.text, letterSpacing: -0.5 }}>{title}</Text>
      {right}
    </View>
  );
}
