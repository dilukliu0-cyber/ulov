import { FISH, FishDef, PlaceId, Rarity } from './fish';

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const rIdx = (r: Rarity) => RARITIES.indexOf(r);

export interface Place { id: PlaceId; ru: string; en: string; descRu: string; descEn: string; }
export const PLACES: Place[] = [
  { id: 'pier', ru: 'Старый пирс', en: 'Old Pier', descRu: 'Тихий пирс на краю острова', descEn: 'A quiet pier at the island edge' },
  { id: 'bay', ru: 'Залив с лодкой', en: 'Rowboat Bay', descRu: 'Спокойная бирюзовая бухта', descEn: 'A calm turquoise bay' },
  { id: 'sea', ru: 'Открытое море', en: 'Open Sea', descRu: 'Волны, маяк и большая рыба', descEn: 'Waves, a lighthouse and big fish' },
  { id: 'trench', ru: 'Глубокий жёлоб', en: 'Deep Trench', descRu: 'Тёмная вода и светящиеся кристаллы', descEn: 'Dark water and glowing crystals' },
];
export const placeOf = (id: PlaceId) => PLACES.find((p) => p.id === id)!;

export const BOAT_COST = 3000;
export const SEA_COST = 25000;
export const SEA_ROD = 5;
export const TRENCH_COST = 120000;
export const TRENCH_SPECIES = 30;

// ---------- улучшения ----------
export type UpgKind = 'rod' | 'line' | 'bait' | 'bucket';
export const MAX_LV = 10;
export const UPG_BASE: Record<UpgKind, number> = { rod: 150, line: 200, bait: 120, bucket: 180 };
export const upgCost = (k: UpgKind, lv: number) => Math.max(10, Math.round((UPG_BASE[k] * Math.pow(1.5, lv - 1)) / 5) * 5);
const BUCKET_CAP = [10, 14, 18, 23, 28, 34, 40, 47, 55, 64];
export const bucketCap = (lv: number) => BUCKET_CAP[Math.min(MAX_LV, Math.max(1, lv)) - 1];
/** ширина зелёной зоны (доля шкалы) */
export const rodZone = (lv: number) => 0.2 + 0.028 * lv;
/** окно подсечки (мс) */
export const hookWindow = (lv: number) => 900 + 110 * lv;
/** запас прочности лески (секунды вне зоны) */
export const lineCap = (lv: number) => 1.0 + 0.16 * lv;
/** множитель шансов редких рыб от наживки */
export const baitMult = (lv: number, rarityIndex: number) => 1 + 0.22 * (lv - 1) * rarityIndex;

export const UPG_INFO: Record<UpgKind, { ru: string; en: string; img: string; effRu: (lv: number) => string; effEn: (lv: number) => string }> = {
  rod: { ru: 'Удочка', en: 'Rod', img: 'rod_bamboo',
    effRu: (lv) => `Зелёная зона ${Math.round(rodZone(lv) * 100)}%, окно подсечки ${(hookWindow(lv) / 1000).toFixed(1)} с`,
    effEn: (lv) => `Green zone ${Math.round(rodZone(lv) * 100)}%, hook window ${(hookWindow(lv) / 1000).toFixed(1)}s` },
  line: { ru: 'Леска', en: 'Line', img: 'icon_line',
    effRu: (lv) => `Выдерживает ${lineCap(lv).toFixed(1)} с натяжения`,
    effEn: (lv) => `Holds ${lineCap(lv).toFixed(1)}s of strain` },
  bait: { ru: 'Наживка', en: 'Bait', img: 'icon_bait',
    effRu: (lv) => `Редкая рыба +${Math.round(22 * (lv - 1))}% за ступень`,
    effEn: (lv) => `Rarer fish +${Math.round(22 * (lv - 1))}% per tier` },
  bucket: { ru: 'Ведро', en: 'Bucket', img: 'icon_bucket',
    effRu: (lv) => `Вмещает ${bucketCap(lv)} рыб`,
    effEn: (lv) => `Holds ${bucketCap(lv)} fish` },
};

// ---------- коты ----------
export interface CatDef { id: string; ru: string; en: string; cost: number; rate: number; base: number; outfit: string; }
export const CATS: CatDef[] = [
  { id: 'kitten', ru: 'Котёнок', en: 'Kitten', cost: 0, rate: 0.5, base: 150, outfit: 'sailor' },
  { id: 'tabby', ru: 'Табби', en: 'Tabby', cost: 600, rate: 0.8, base: 500, outfit: 'raincoat' },
  { id: 'ginger', ru: 'Рыжик', en: 'Ginger', cost: 3000, rate: 1.2, base: 1800, outfit: 'hoodie' },
  { id: 'murka', ru: 'Мурка', en: 'Murka', cost: 15000, rate: 1.8, base: 7000, outfit: 'pirate' },
  { id: 'captain', ru: 'Капитан Вискерс', en: 'Captain Whiskers', cost: 60000, rate: 2.6, base: 25000, outfit: 'captain' },
];
export const catUpgCost = (c: CatDef, lv: number) => Math.round((c.base * Math.pow(1.5, lv - 1)) / 5) * 5;
export const catRate = (c: CatDef, lv: number) => c.rate * Math.pow(1.3, lv - 1); // рыб в минуту
export const catTier = (lv: number) => (lv >= 10 ? 2 : lv >= 5 ? 1 : 0);

// ---------- скины ----------
export type SkinCat = 'rod' | 'bobber' | 'outfit' | 'scene';
export interface SkinDef { id: string; cat: SkinCat; key: string; ru: string; en: string; price?: number; rarity: Rarity; rewardRu?: string; rewardEn?: string; }
export const SKINS: SkinDef[] = [
  { id: 'rod_bamboo', cat: 'rod', key: 'bamboo', ru: 'Бамбуковая', en: 'Bamboo', price: 0, rarity: 'common' },
  { id: 'rod_ocean', cat: 'rod', key: 'ocean', ru: 'Океанская', en: 'Ocean', price: 1500, rarity: 'rare' },
  { id: 'rod_sakura', cat: 'rod', key: 'sakura', ru: 'Сакура', en: 'Sakura', price: 1800, rarity: 'rare' },
  { id: 'rod_spooky', cat: 'rod', key: 'spooky', ru: 'Жуткая', en: 'Spooky', price: 3000, rarity: 'epic' },
  { id: 'rod_galaxy', cat: 'rod', key: 'galaxy', ru: 'Галактика', en: 'Galaxy', rarity: 'epic', rewardRu: 'Награда: 20 видов рыб', rewardEn: 'Reward: 20 species' },
  { id: 'rod_royal', cat: 'rod', key: 'royal', ru: 'Королевская', en: 'Royal', rarity: 'legendary', rewardRu: 'Награда: собрать все редкие', rewardEn: 'Reward: all Rare fish' },
  { id: 'bobber_classic', cat: 'bobber', key: 'classic', ru: 'Классика', en: 'Classic', price: 0, rarity: 'common' },
  { id: 'bobber_duck', cat: 'bobber', key: 'duck', ru: 'Уточка', en: 'Duck', price: 1000, rarity: 'rare' },
  { id: 'bobber_neon', cat: 'bobber', key: 'neon', ru: 'Неон', en: 'Neon', price: 2000, rarity: 'rare' },
  { id: 'bobber_pearl', cat: 'bobber', key: 'pearl', ru: 'Жемчуг', en: 'Pearl', price: 3500, rarity: 'epic' },
  { id: 'bobber_galaxy', cat: 'bobber', key: 'galaxy', ru: 'Звёздный', en: 'Starry', rarity: 'epic', rewardRu: 'Награда: 30 видов рыб', rewardEn: 'Reward: 30 species' },
  { id: 'bobber_gold', cat: 'bobber', key: 'gold', ru: 'Золотой', en: 'Golden', rarity: 'legendary', rewardRu: 'Награда: собрать все эпические', rewardEn: 'Reward: all Epic fish' },
  { id: 'outfit_sailor', cat: 'outfit', key: 'sailor', ru: 'Матрос', en: 'Sailor', price: 0, rarity: 'common' },
  { id: 'outfit_raincoat', cat: 'outfit', key: 'raincoat', ru: 'Дождевик', en: 'Raincoat', price: 2000, rarity: 'rare' },
  { id: 'outfit_hoodie', cat: 'outfit', key: 'hoodie', ru: 'Худи', en: 'Hoodie', price: 2500, rarity: 'rare' },
  { id: 'outfit_pirate', cat: 'outfit', key: 'pirate', ru: 'Пират', en: 'Pirate', rarity: 'epic', rewardRu: 'Награда: блестящая рыба', rewardEn: 'Reward: a shiny fish' },
  { id: 'outfit_captain', cat: 'outfit', key: 'captain', ru: 'Капитан', en: 'Captain', rarity: 'epic', rewardRu: 'Награда: звание «Мастер пирса»', rewardEn: 'Reward: Pier Master rank' },
  { id: 'outfit_royal', cat: 'outfit', key: 'royal', ru: 'Король', en: 'Royal', rarity: 'legendary', rewardRu: 'Награда: все 40 видов', rewardEn: 'Reward: all 40 species' },
  { id: 'scene_sunset', cat: 'scene', key: 'sunset', ru: 'Закат', en: 'Sunset', price: 0, rarity: 'common' },
  { id: 'scene_night', cat: 'scene', key: 'night', ru: 'Ночь', en: 'Night', price: 0, rarity: 'common' },
  { id: 'scene_dawn', cat: 'scene', key: 'dawn', ru: 'Рассвет', en: 'Dawn', price: 3000, rarity: 'rare' },
  { id: 'scene_storm', cat: 'scene', key: 'storm', ru: 'Шторм', en: 'Storm', price: 3500, rarity: 'epic' },
];
export const skin = (id: string) => SKINS.find((s) => s.id === id)!;
export const SKIN_CATS: { id: SkinCat; ru: string; en: string }[] = [
  { id: 'rod', ru: 'Удочка', en: 'Rod' },
  { id: 'bobber', ru: 'Поплавок', en: 'Bobber' },
  { id: 'outfit', ru: 'Наряд кота', en: 'Cat outfit' },
  { id: 'scene', ru: 'Фон', en: 'Scene' },
];
export const DEFAULT_SKINS = ['rod_bamboo', 'bobber_classic', 'outfit_sailor', 'scene_sunset', 'scene_night'];

/** стили удочки для SVG (цвета как у рендеров) */
export const ROD_STYLE: Record<string, { base: string; stripe: string; grip: string }> = {
  bamboo: { base: '#D9BB6C', stripe: '#9C7A34', grip: '#7A4A2A' },
  ocean: { base: '#3F95DE', stripe: '#B4E6FF', grip: '#1F4A7A' },
  galaxy: { base: '#4B2B8F', stripe: '#FFE9A0', grip: '#1C1244' },
  royal: { base: '#FFC83A', stripe: '#FFF0A8', grip: '#8A1F2F' },
  sakura: { base: '#F7A8C4', stripe: '#FFFFFF', grip: '#B0507A' },
  spooky: { base: '#2D2147', stripe: '#FF8A2A', grip: '#1A1228' },
};

// ---------- звания и награды ----------
export const xpForLevel = (lv: number) => 25 * (lv - 1) * (lv - 1);
export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 25)) + 1;
export interface Rank { minLv: number; ru: string; en: string; reward?: string; }
export const RANKS: Rank[] = [
  { minLv: 1, ru: 'Новичок', en: 'Novice' },
  { minLv: 5, ru: 'Рыбак', en: 'Angler', reward: 'bobber_duck' },
  { minLv: 10, ru: 'Мастер пирса', en: 'Pier Master', reward: 'outfit_captain' },
  { minLv: 20, ru: 'Морской волк', en: 'Sea Wolf', reward: 'scene_storm' },
  { minLv: 35, ru: 'Легенда', en: 'Legend', reward: 'scene_dawn' },
];
export const rankOf = (lv: number) => [...RANKS].reverse().find((r) => lv >= r.minLv)!;

export interface Reward { id: string; coins?: number; skin?: string; ru: string; en: string; }
export const MILESTONES: { n: number; r: Reward }[] = [
  { n: 5, r: { id: 'm5', coins: 500, ru: '5 видов рыб', en: '5 species' } },
  { n: 10, r: { id: 'm10', skin: 'rod_sakura', ru: '10 видов рыб', en: '10 species' } },
  { n: 15, r: { id: 'm15', coins: 3000, ru: '15 видов рыб', en: '15 species' } },
  { n: 20, r: { id: 'm20', skin: 'rod_galaxy', ru: '20 видов рыб', en: '20 species' } },
  { n: 25, r: { id: 'm25', coins: 8000, ru: '25 видов рыб', en: '25 species' } },
  { n: 30, r: { id: 'm30', skin: 'bobber_galaxy', ru: '30 видов рыб', en: '30 species' } },
  { n: 35, r: { id: 'm35', coins: 25000, ru: '35 видов рыб', en: '35 species' } },
  { n: 40, r: { id: 'm40', skin: 'outfit_royal', ru: 'Все 40 видов', en: 'All 40 species' } },
];
export const RARITY_SETS: { rarity: Rarity; r: Reward }[] = [
  { rarity: 'common', r: { id: 's_common', coins: 1000, ru: 'Все обычные рыбы', en: 'All Common fish' } },
  { rarity: 'uncommon', r: { id: 's_uncommon', coins: 3000, ru: 'Все необычные рыбы', en: 'All Uncommon fish' } },
  { rarity: 'rare', r: { id: 's_rare', skin: 'rod_royal', ru: 'Все редкие рыбы', en: 'All Rare fish' } },
  { rarity: 'epic', r: { id: 's_epic', skin: 'bobber_gold', ru: 'Все эпические рыбы', en: 'All Epic fish' } },
  { rarity: 'legendary', r: { id: 's_legendary', coins: 150000, ru: 'Все легендарные рыбы', en: 'All Legendary fish' } },
];
export const SHINY_REWARD: Reward = { id: 'shiny', skin: 'outfit_pirate', ru: 'Первая блестящая рыба', en: 'First shiny fish' };

// ---------- рыбалка ----------
export const FISH_BY_PLACE = (p: PlaceId): FishDef[] => FISH.filter((f) => f.place === p);
export const fishDef = (id: string) => FISH.find((f) => f.id === id)!;
export const SHINY_CHANCE = 0.012;
export const SHINY_MULT = 5;
export const XP_BY_RARITY: Record<Rarity, number> = { common: 1, uncommon: 3, rare: 10, epic: 40, legendary: 150 };
const BASE_W: Record<Rarity, number> = { common: 55, uncommon: 28, rare: 12, epic: 4, legendary: 1 };
export const rarityWeights = (place: PlaceId, baitLv: number): [Rarity, number][] => {
  const present = new Set(FISH_BY_PLACE(place).map((f) => f.rarity));
  return RARITIES.filter((r) => present.has(r)).map((r) => [r, BASE_W[r] * baitMult(baitLv, rIdx(r))] as [Rarity, number]);
};
export interface FightCfg { dur: number; pull: number; zone: number; }
export const FIGHT: Partial<Record<Rarity, FightCfg>> = {
  uncommon: { dur: 3.5, pull: 0.9, zone: 1.0 },
  rare: { dur: 4.5, pull: 1.1, zone: 0.9 },
  epic: { dur: 7, pull: 1.3, zone: 0.8 },
  legendary: { dur: 10, pull: 1.5, zone: 0.7 },
};
export const OFFLINE_HOURS = (bucketLv: number) => (bucketLv >= 3 ? 12 : 8);
