import { Platform } from 'react-native';
import type { Save } from './state/store';
import { getState, setState } from './state/store';
import { CATS, catRate, bucketCap, OFFLINE_HOURS } from './data/game';
import { catCanFish } from './game/engine';

let N: any = null;
try {
  N = Platform.OS === 'web' ? null : require('expo-notifications');
  N?.setNotificationHandler?.({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
} catch {
  N = null;
}

/** Спросить разрешение один раз — после первой продажи */
export async function maybeAskAfterSale() {
  const s = getState();
  if (!N || s.notifAsked || !s.settings.notifications) return;
  setState((d) => { d.notifAsked = true; });
  try {
    await N.requestPermissionsAsync();
  } catch {}
}

export async function cancelReminders() {
  if (!N) return;
  try { await N.cancelAllScheduledNotificationsAsync(); } catch {}
}

/** Одно напоминание: когда ведро заполнится на 80% (или через 8 ч) */
export async function scheduleReminders(s: Save) {
  if (!N || !s.settings.notifications || !s.notifAsked) return;
  try {
    const perm = await N.getPermissionsAsync();
    if (!perm.granted) return;
    await N.cancelAllScheduledNotificationsAsync();
    const rate = CATS.reduce((a, c) => a + (s.cats[c.id].hired && catCanFish(s.cats[c.id].place) ? catRate(c, s.cats[c.id].level) : 0), 0);
    if (rate <= 0) return;
    const ru = s.settings.lang === 'ru';
    const cap = bucketCap(s.upgrades.bucket);
    const need = Math.ceil(cap * 0.8) - s.bucket.length;
    const maxSec = OFFLINE_HOURS(s.upgrades.bucket) * 3600;
    let sec: number, title: string, body: string;
    if (need > 0 && (need / rate) * 60 < maxSec) {
      sec = Math.max(1800, (need / rate) * 60);
      title = ru ? 'Ведро почти полное 🪣' : 'Bucket almost full 🪣';
      body = ru ? 'Коты наловили рыбы — загляни продать улов!' : 'Your cats caught plenty — come sell your catch!';
    } else {
      sec = maxSec;
      title = ru ? 'Коты наловили рыбы 🐟' : 'Your cats caught fish 🐟';
      body = ru ? 'Загляни на пирс — улов ждёт.' : 'Visit the pier — your catch is waiting.';
    }
    await N.scheduleNotificationAsync({
      content: { title, body },
      trigger: { type: 'timeInterval', seconds: Math.round(sec), repeats: false },
    });
  } catch {}
}
