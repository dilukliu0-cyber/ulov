import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { getState } from '../state/store';

type HKind = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'select';

export function haptic(kind: HKind = 'light') {
  if (Platform.OS === 'web') return;
  if (!getState().settings.vibration) return;
  try {
    switch (kind) {
      case 'light': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); break;
      case 'medium': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); break;
      case 'heavy': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); break;
      case 'success': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); break;
      case 'error': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); break;
      case 'warning': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); break;
      case 'select': Haptics.selectionAsync().catch(() => {}); break;
    }
  } catch {}
}

// ---------- звуки ----------
const SRC: Record<string, any> = {
  cast: require('../../assets/sounds/cast.wav'),
  splash: require('../../assets/sounds/splash.wav'),
  bite: require('../../assets/sounds/bite.wav'),
  coin: require('../../assets/sounds/coin.wav'),
  success: require('../../assets/sounds/success.wav'),
  fail: require('../../assets/sounds/fail.wav'),
  tap: require('../../assets/sounds/tap.wav'),
  reel: require('../../assets/sounds/reel.wav'),
  rare: require('../../assets/sounds/rare.wav'),
};
export type SoundName = keyof typeof SRC;

let audio: any = null;
const players: Record<string, any> = {};
let inited = false;

export async function initSounds() {
  if (inited) return;
  inited = true;
  try {
    audio = require('expo-audio');
    await audio.setAudioModeAsync?.({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch?.(() => {});
  } catch {
    audio = null;
  }
}

export function sfx(name: SoundName, volume = 0.8) {
  if (!getState().settings.sound || !audio) return;
  try {
    let p = players[name];
    if (!p) {
      p = audio.createAudioPlayer(SRC[name]);
      players[name] = p;
    }
    p.volume = volume;
    p.seekTo?.(0);
    p.play();
  } catch {}
}
