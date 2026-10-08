import { useColorScheme } from 'react-native';
import { useGame } from './state/store';
import type { Rarity } from './data/fish';

export interface Palette {
  bg: string; card: string; card2: string; text: string; sub: string; line: string;
  accent: string; accentDark: string; good: string; warn: string; danger: string;
  sheet: string; overlay: string; onAccent: string; dark: boolean;
}

export const LIGHT: Palette = {
  bg: '#FBF5EA', card: '#FFFFFF', card2: '#F6EBD9', text: '#4A3425', sub: '#9B8672', line: '#EADBC3',
  accent: '#F26B5B', accentDark: '#D9503F', good: '#4FB26A', warn: '#F2B631', danger: '#E5484D',
  sheet: '#FFF9EE', overlay: 'rgba(40,25,15,0.45)', onAccent: '#FFFFFF', dark: false,
};
export const DARK: Palette = {
  bg: '#17161D', card: '#252430', card2: '#2E2C3A', text: '#F6EBD9', sub: '#A99C8B', line: '#3A3847',
  accent: '#F26B5B', accentDark: '#D9503F', good: '#6BD08A', warn: '#F2B631', danger: '#FF6A6A',
  sheet: '#1F1E27', overlay: 'rgba(0,0,0,0.6)', onAccent: '#FFFFFF', dark: true,
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9AA5B1', uncommon: '#5BBF72', rare: '#4A8DF0', epic: '#A05BF0', legendary: '#F2B631',
};
export const RARITY_NAME: Record<Rarity, { ru: string; en: string }> = {
  common: { ru: 'Обычная', en: 'Common' },
  uncommon: { ru: 'Необычная', en: 'Uncommon' },
  rare: { ru: 'Редкая', en: 'Rare' },
  epic: { ru: 'Эпическая', en: 'Epic' },
  legendary: { ru: 'Легендарная', en: 'Legendary' },
};

export function useIsDark(): boolean {
  const mode = useGame((s) => s.settings.theme);
  const sys = useColorScheme();
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return sys === 'dark';
}

export function useTheme(): Palette {
  return useIsDark() ? DARK : LIGHT;
}

export function useLang(): 'ru' | 'en' {
  return useGame((s) => s.settings.lang);
}

/** tr('привет', 'hello') -> строка на языке игры */
export function useT(): (ru: string, en: string) => string {
  const lang = useLang();
  return (ru, en) => (lang === 'ru' ? ru : en);
}

export const R = 22; // базовый радиус скругления
