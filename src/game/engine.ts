import { FISH, FishDef, PlaceId, Rarity } from '../data/fish';
import {
  rarityWeights, FISH_BY_PLACE, SHINY_CHANCE, SHINY_MULT, rIdx, CATS, catRate, bucketCap, OFFLINE_HOURS, CatDef,
} from '../data/game';
import type { Save, CaughtFish } from '../state/store';

export const rand = Math.random;

export function pickWeighted<T>(items: [T, number][]): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [it, w] of items) {
    r -= w;
    if (r <= 0) return it;
  }
  return items[items.length - 1][0];
}

export function priceOf(def: FishDef, kg: number, shiny: boolean) {
  return Math.max(1, Math.round(kg * def.ppk * (shiny ? SHINY_MULT : 1)));
}

export function rollWeight(def: FishDef, rodLv = 1) {
  const u = Math.pow(rand(), Math.max(1.2, 2.2 - 0.08 * rodLv));
  const kg = def.kgMin + (def.kgMax - def.kgMin) * u;
  return Math.round(kg * (kg < 1 ? 1000 : 100)) / (kg < 1 ? 1000 : 100);
}

let uidN = 0;
export const uid = () => Date.now().toString(36) + '-' + (uidN++).toString(36) + Math.floor(rand() * 1e4).toString(36);

export function makeFish(def: FishDef, kg: number, shiny: boolean): CaughtFish {
  return { uid: uid(), id: def.id, kg, shiny, value: priceOf(def, kg, shiny), locked: rIdx(def.rarity) >= 2 || shiny, t: Date.now() };
}

/** Какая рыба клюнет на этом месте с этой наживкой */
export function rollBite(place: PlaceId, baitLv: number, rodLv: number): CaughtFish {
  const rar = pickWeighted(rarityWeights(place, baitLv));
  const pool = FISH_BY_PLACE(place).filter((f) => f.rarity === rar);
  const def = pool[Math.floor(rand() * pool.length)];
  const shiny = rand() < SHINY_CHANCE * (1 + 0.1 * (baitLv - 1));
  return makeFish(def, rollWeight(def, rodLv), shiny);
}

/** Пул котов: только обычные и необычные рыбы места */
export function catPool(place: PlaceId): FishDef[] {
  return FISH_BY_PLACE(place).filter((f) => rIdx(f.rarity) <= 1);
}
export const catCanFish = (place: PlaceId) => catPool(place).length > 0;

export function catCatch(place: PlaceId): CaughtFish | null {
  const pool = catPool(place);
  if (!pool.length) return null;
  const items: [FishDef, number][] = pool.map((f) => [f, f.rarity === 'common' ? 3 : 1]);
  const def = pickWeighted(items);
  const f = makeFish(def, rollWeight(def, 1), false);
  f.locked = false;
  return f;
}

/** Средний доход кота в монетах в минуту (для подписи) */
export function catIncomePerMin(cat: CatDef, lv: number, place: PlaceId) {
  const pool = catPool(place);
  if (!pool.length) return 0;
  const tot = pool.reduce((a, f) => a + (f.rarity === 'common' ? 3 : 1), 0);
  const avg = pool.reduce((a, f) => {
    const w = f.rarity === 'common' ? 3 : 1;
    const kg = f.kgMin + (f.kgMax - f.kgMin) * 0.32;
    return a + (w / tot) * kg * f.ppk;
  }, 0);
  return catRate(cat, lv) * avg;
}

export interface CatBatch { added: CaughtFish[]; autoSold: number; coins: number; perCat: { id: string; n: number }[]; }

/** Коты наловили n рыб: в ведро сколько влезет, остальное — автопродажа. */
export function runCats(s: Save, seconds: number, acc: Record<string, number>): CatBatch {
  const out: CatBatch = { added: [], autoSold: 0, coins: 0, perCat: [] };
  let free = bucketCap(s.upgrades.bucket) - s.bucket.length;
  for (const c of CATS) {
    const st = s.cats[c.id];
    if (!st?.hired || !catCanFish(st.place)) continue;
    const exact = (catRate(c, st.level) * seconds) / 60 + (acc[c.id] || 0);
    const n = Math.floor(exact);
    acc[c.id] = exact - n;
    if (n <= 0) continue;
    out.perCat.push({ id: c.id, n });
    for (let i = 0; i < n; i++) {
      const f = catCatch(st.place);
      if (!f) break;
      if (free > 0) {
        out.added.push(f);
        free--;
      } else {
        out.autoSold++;
        out.coins += f.value;
      }
    }
  }
  return out;
}

export const offlineCap = (s: Save) => OFFLINE_HOURS(s.upgrades.bucket) * 3600;

export const speciesCount = (s: Save) => Object.keys(s.collection).length;
export const rarityComplete = (s: Save, r: Rarity) => FISH.filter((f) => f.rarity === r).every((f) => s.collection[f.id]);

export function fmt(n: number, lang: 'ru' | 'en' = 'ru') {
  const v = Math.floor(n);
  const str = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'ru' ? ' ' : ',');
  return (v < 0 ? '−' : '') + str;
}
export function fmtShort(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace('.0', '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.0', '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace('.0', '') + 'K';
  return fmt(n);
}
export function fmtKg(kg: number, lang: 'ru' | 'en' = 'ru') {
  const s = kg < 1 ? (Math.round(kg * 1000) / 1000).toString() : kg.toFixed(kg < 10 ? 2 : 1);
  return (lang === 'ru' ? s.replace('.', ',') : s) + (lang === 'ru' ? ' кг' : ' kg');
}
export function fmtDuration(sec: number, lang: 'ru' | 'en') {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (lang === 'ru') return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
