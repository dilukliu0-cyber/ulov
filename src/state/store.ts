import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlaceId } from '../data/fish';
import { CATS, DEFAULT_SKINS, UpgKind } from '../data/game';

export interface CaughtFish { uid: string; id: string; kg: number; shiny: boolean; locked: boolean; value: number; t: number; }
export interface CollEntry { count: number; best: number; shiny: boolean; first: number; }
export interface CatState { hired: boolean; level: number; name: string; place: PlaceId; }
export interface Settings {
  sound: boolean; music: boolean; vibration: boolean; notifications: boolean;
  theme: 'auto' | 'light' | 'dark'; lang: 'ru' | 'en';
}
export interface Save {
  v: 1;
  coins: number;
  xp: number;
  upgrades: Record<UpgKind, number>;
  boat: boolean;
  unlocked: Record<PlaceId, boolean>;
  place: PlaceId;
  bucket: CaughtFish[];
  collection: Record<string, CollEntry>;
  cats: Record<string, CatState>;
  owned: string[];
  equipped: { rod: string; bobber: string; outfit: string; scene: string }; // scene: 'auto' | skin id
  stats: { caught: number; heaviest: number; heaviestId: string; sold: number; earned: number; lost: number };
  settings: Settings;
  claimed: string[];
  lastSeen: number;
  onboarded: boolean;
  notifAsked: boolean;
}

export const defaultSave = (): Save => ({
  v: 1,
  coins: 0,
  xp: 0,
  upgrades: { rod: 1, line: 1, bait: 1, bucket: 1 },
  boat: false,
  unlocked: { pier: true, bay: false, sea: false, trench: false },
  place: 'pier',
  bucket: [],
  collection: {},
  cats: Object.fromEntries(CATS.map((c) => [c.id, { hired: false, level: 1, name: '', place: 'pier' as PlaceId }])),
  owned: [...DEFAULT_SKINS],
  equipped: { rod: 'rod_bamboo', bobber: 'bobber_classic', outfit: 'outfit_sailor', scene: 'auto' },
  stats: { caught: 0, heaviest: 0, heaviestId: '', sold: 0, earned: 0, lost: 0 },
  settings: { sound: true, music: true, vibration: true, notifications: true, theme: 'auto', lang: 'ru' },
  claimed: [],
  lastSeen: Date.now(),
  onboarded: false,
  notifAsked: false,
});

const KEY = 'ulov.save.v1';
let state: Save = defaultSave();
let ready = false;
let saveError: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getState(): Save {
  return state;
}
export function isReady() {
  return ready;
}
export function getSaveError() {
  return saveError;
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

/** Изменить состояние: fn получает копию и правит её. */
export function setState(fn: (d: Save) => void) {
  const d = clone(state);
  fn(d);
  state = d;
  emit();
  schedulePersist();
}

let timer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(persistNow, 400);
}
export async function persistNow() {
  timer = null;
  try {
    state.lastSeen = Date.now();
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
    if (saveError) {
      saveError = null;
      emit();
    }
  } catch (e: any) {
    saveError = String(e?.message || e);
    emit();
  }
}

/** Загрузка сохранения; возвращает время отсутствия (сек). */
export async function load(): Promise<number> {
  let away = 0;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const loaded = JSON.parse(raw) as Save;
      const base = defaultSave();
      // мягкое слияние на случай новых полей
      state = {
        ...base, ...loaded,
        upgrades: { ...base.upgrades, ...loaded.upgrades },
        unlocked: { ...base.unlocked, ...loaded.unlocked },
        cats: { ...base.cats, ...loaded.cats },
        equipped: { ...base.equipped, ...loaded.equipped },
        stats: { ...base.stats, ...loaded.stats },
        settings: { ...base.settings, ...loaded.settings },
      };
      away = Math.max(0, (Date.now() - (loaded.lastSeen || Date.now())) / 1000);
    } else {
      // язык по умолчанию — по системе
      try {
        const loc = Intl.DateTimeFormat().resolvedOptions().locale || 'ru';
        state.settings.lang = loc.startsWith('ru') || loc.startsWith('uk') || loc.startsWith('be') ? 'ru' : 'en';
      } catch {}
    }
  } catch (e: any) {
    saveError = String(e?.message || e);
  }
  ready = true;
  emit();
  return away;
}

export async function wipe() {
  state = defaultSave();
  state.onboarded = true;
  emit();
  await persistNow();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Подписка на часть состояния. Селектор должен возвращать примитив или ссылку из state. */
export function useGame<T>(sel: (s: Save) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}
export function useReady() {
  return useSyncExternalStore(subscribe, () => ready, () => ready);
}
export function useSaveError() {
  return useSyncExternalStore(subscribe, () => saveError, () => saveError);
}

// ---------- UI-события (не сохраняются) ----------
export interface NewFishEvent { fish: CaughtFish; isNew: boolean; isRecord: boolean; prevBest: number; inBucket: boolean; soldInstead: boolean; }
export interface WelcomeEvent { seconds: number; perCat: { id: string; n: number }[]; toBucket: number; autoSold: number; coins: number; }
export interface UiState {
  newFish: NewFishEvent | null;
  welcome: WelcomeEvent | null;
  toast: { id: number; text: string; icon?: string } | null;
  rewards: { ru: string; en: string; coins?: number; skin?: string }[];
  rankUp: { ru: string; en: string; skin?: string } | null;
  setDone: { ru: string; en: string } | null;
  tab: 'fish' | 'collection' | 'shop' | 'cats' | 'profile';
  sheet: null | 'bucket' | 'spots';
  fishCard: string | null;
  coinFly: number;
}
let ui: UiState = { newFish: null, welcome: null, toast: null, rewards: [], rankUp: null, setDone: null, tab: 'fish', sheet: null, fishCard: null, coinFly: 0 };
const uiListeners = new Set<() => void>();
export function getUi() {
  return ui;
}
export function setUi(p: Partial<UiState>) {
  ui = { ...ui, ...p };
  uiListeners.forEach((l) => l());
}
export function useUi<T>(sel: (u: UiState) => T): T {
  return useSyncExternalStore(
    (l) => {
      uiListeners.add(l);
      return () => uiListeners.delete(l);
    },
    () => sel(ui),
    () => sel(ui),
  );
}
let toastId = 1;
export function toast(text: string, icon?: string) {
  setUi({ toast: { id: toastId++, text, icon } });
}
